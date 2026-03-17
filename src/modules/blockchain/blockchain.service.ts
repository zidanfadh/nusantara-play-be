import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import * as crypto from 'crypto';
import {
  BlockchainProof,
  BlockchainProofStatus,
} from './entities/blockchain-proof.entity';
import { Verifikasi } from '../prot/entities/verifikasi.entity';
import { PROT } from '../prot/entities/prot.entity';
import * as ProtVerificationABI from './abi/ProtVerification.json';

// Fields included in the content hash — stable content only, no media URLs
const HASH_FIELDS: (keyof PROT)[] = [
  'nama',
  'jenis',
  'deskripsi',
  'caraBermain',
  'nilaiMoral',
  'targetUsia',
  'peralatan',
  'statusAsalUsul',
  'provinsiKode',
  'kabkotaKode',
  'kecamatanKode',
  'desaKode',
  'jumlahPemain',
];

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private contract: ethers.Contract | null = null;

  constructor(
    @InjectRepository(BlockchainProof)
    private readonly proofRepository: Repository<BlockchainProof>,
    @InjectRepository(Verifikasi)
    private readonly verifikasiRepository: Repository<Verifikasi>,
    @InjectRepository(PROT)
    private readonly protRepository: Repository<PROT>,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    const rpcUrl = this.configService.get<string>('BLOCKCHAIN_RPC_URL');
    const privateKey = this.configService.get<string>('BLOCKCHAIN_PRIVATE_KEY');
    const contractAddress = this.configService.get<string>('BLOCKCHAIN_CONTRACT_ADDRESS');

    if (!rpcUrl || !privateKey || !contractAddress) {
      this.logger.warn(
        'Blockchain env vars not configured. BlockchainService will be inactive.',
      );
      return;
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    this.contract = new ethers.Contract(
      contractAddress,
      ProtVerificationABI.abi,
      wallet,
    );
    this.logger.log(`BlockchainService initialized. Contract: ${contractAddress}`);
  }

  /**
   * Compute deterministic SHA-256 hash of PROT content fields.
   * Keys are sorted alphabetically before stringification for determinism.
   */
  computeHash(prot: PROT): string {
    const payload: Record<string, unknown> = {};
    for (const field of [...HASH_FIELDS].sort()) {
      payload[field] = prot[field] ?? null;
    }
    const json = JSON.stringify(payload);
    return crypto.createHash('sha256').update(json).digest('hex');
  }

  /**
   * Fire-and-forget: called after verification approval.
   * Creates a pending proof row, then anchors to chain.
   */
  async anchorVerification(verifikasiId: string): Promise<void> {
    const verifikasi = await this.verifikasiRepository.findOne({
      where: { id: verifikasiId },
      relations: ['prot'],
    });

    if (!verifikasi) {
      this.logger.error(`Verifikasi ${verifikasiId} not found for blockchain anchoring`);
      return;
    }

    const prot = verifikasi.prot;
    const dataHash = this.computeHash(prot);

    // Determine next version (count existing proofs for this prot)
    const existingCount = await this.proofRepository.count({
      where: { prot_id: prot.id },
    });
    const version = existingCount + 1;

    // Create pending proof row first — scheduler can retry if sendToChain fails
    const proof = this.proofRepository.create({
      verifikasi_id: verifikasiId,
      prot_id: prot.id,
      version,
      data_hash: dataHash,
      blockchain_network:
        this.configService.get<string>('BLOCKCHAIN_NETWORK') ?? 'polygon-mumbai',
      status: BlockchainProofStatus.PENDING,
    });
    await this.proofRepository.save(proof);

    await this.sendToChain(proof, prot.id, dataHash);
  }

  /**
   * Send transaction to chain and update proof row.
   * Called by anchorVerification and by the retry scheduler.
   */
  async sendToChain(
    proof: BlockchainProof,
    protId: string,
    dataHash: string,
  ): Promise<void> {
    if (!this.contract) {
      this.logger.warn('Blockchain contract not initialized. Skipping anchor.');
      return;
    }

    try {
      const hashBytes = ('0x' + dataHash) as `0x${string}`;
      const tx = await this.contract['recordVerification'](protId, hashBytes);
      const receipt = await tx.wait();

      proof.tx_hash = receipt.hash;
      proof.block_number = String(receipt.blockNumber);
      proof.status = BlockchainProofStatus.CONFIRMED;
      proof.anchored_at = new Date();
      proof.last_error = null;
      await this.proofRepository.save(proof);

      this.logger.log(
        `Anchored PROT ${protId} at block ${receipt.blockNumber}, tx: ${receipt.hash}`,
      );
    } catch (err) {
      proof.retry_count += 1;
      proof.last_error = err instanceof Error ? err.message : String(err);
      proof.status =
        proof.retry_count >= 3
          ? BlockchainProofStatus.FAILED
          : BlockchainProofStatus.PENDING;
      await this.proofRepository.save(proof);

      this.logger.error(
        `Blockchain anchor failed for PROT ${protId} (attempt ${proof.retry_count}): ${proof.last_error}`,
      );
    }
  }

  /**
   * Integrity check: re-computes hash from current DB data and compares against on-chain record.
   */
  async checkIntegrity(protId: string): Promise<{
    dbIntact: boolean;
    chainIntact: boolean;
    fullyVerified: boolean;
    details: {
      storedHash: string | null;
      currentHash: string;
      onChainHash: string | null;
      status: string | null;
      txHash: string | null;
      blockNumber: string | null;
    };
  }> {
    const prot = await this.protRepository.findOne({ where: { id: protId } });
    if (!prot) {
      return {
        dbIntact: false,
        chainIntact: false,
        fullyVerified: false,
        details: {
          storedHash: null,
          currentHash: '',
          onChainHash: null,
          status: null,
          txHash: null,
          blockNumber: null,
        },
      };
    }

    const proof = await this.proofRepository.findOne({
      where: { prot_id: protId, status: BlockchainProofStatus.CONFIRMED },
      order: { version: 'DESC' },
    });

    const currentHash = this.computeHash(prot);
    const dbIntact = proof ? currentHash === proof.data_hash : false;

    let chainIntact = false;
    let onChainHash: string | null = null;

    if (proof && this.contract) {
      try {
        const record = await this.contract['getLatest'](protId);
        onChainHash = (record.dataHash as string).replace('0x', '');
        chainIntact = onChainHash === proof.data_hash;
      } catch {
        chainIntact = false;
      }
    }

    return {
      dbIntact,
      chainIntact,
      fullyVerified: dbIntact && chainIntact,
      details: {
        storedHash: proof?.data_hash ?? null,
        currentHash,
        onChainHash,
        status: proof?.status ?? null,
        txHash: proof?.tx_hash ?? null,
        blockNumber: proof?.block_number ?? null,
      },
    };
  }

  /**
   * Called by scheduler to retry pending proofs (max 3 attempts).
   */
  async retryPendingProofs(): Promise<void> {
    const pendingProofs = await this.proofRepository
      .createQueryBuilder('bp')
      .where('bp.status = :status', { status: BlockchainProofStatus.PENDING })
      .andWhere('bp.retry_count < :max', { max: 3 })
      .getMany();

    for (const proof of pendingProofs) {
      this.logger.log(
        `Retrying blockchain proof ${proof.id} (attempt ${proof.retry_count + 1})`,
      );
      await this.sendToChain(proof, proof.prot_id, proof.data_hash);
    }
  }
}
