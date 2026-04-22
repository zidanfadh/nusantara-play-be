import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { BlockchainProof, BlockchainProofStatus } from './entities/blockchain-proof.entity';
import { Verifikasi } from '../prot/entities/verifikasi.entity';
import { PROT } from '../prot/entities/prot.entity';

const mockProofRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockVerifikasiRepository = {
  findOne: jest.fn(),
};

const mockProtRepository = {
  findOne: jest.fn(),
};

const mockConfigService = {
  get: jest.fn(),
};

describe('BlockchainService', () => {
  let service: BlockchainService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainService,
        { provide: getRepositoryToken(BlockchainProof), useValue: mockProofRepository },
        { provide: getRepositoryToken(Verifikasi), useValue: mockVerifikasiRepository },
        { provide: getRepositoryToken(PROT), useValue: mockProtRepository },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<BlockchainService>(BlockchainService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProofForProt', () => {
    it('returns null when no proof exists', async () => {
      mockProofRepository.findOne.mockResolvedValue(null);

      const result = await service.getProofForProt('prot-uuid-1');

      expect(result).toBeNull();
      expect(mockProofRepository.findOne).toHaveBeenCalledWith({
        where: { prot_id: 'prot-uuid-1' },
        order: { version: 'DESC' },
      });
    });

    it('returns proof data without integrity check when status is PENDING', async () => {
      const proof = {
        id: 'proof-1',
        prot_id: 'prot-uuid-1',
        status: BlockchainProofStatus.PENDING,
        version: 1,
        tx_hash: null,
        block_number: null,
        blockchain_network: 'polygon-amoy',
        anchored_at: null,
        data_hash: 'abc123',
      } as BlockchainProof;

      mockProofRepository.findOne.mockResolvedValue(proof);

      const result = await service.getProofForProt('prot-uuid-1');

      expect(result).not.toBeNull();
      expect(result!.status).toBe(BlockchainProofStatus.PENDING);
      expect(result!.txHash).toBeNull();
      expect(result!.integrity.dbIntact).toBe(false);
      expect(result!.integrity.chainIntact).toBe(false);
      expect(result!.integrity.fullyVerified).toBe(false);
      // Should NOT query PROT for hash recomputation when status is PENDING
      expect(mockProtRepository.findOne).not.toHaveBeenCalled();
    });

    it('returns proof data without integrity check when status is FAILED', async () => {
      const proof = {
        prot_id: 'prot-uuid-1',
        status: BlockchainProofStatus.FAILED,
        version: 1,
        tx_hash: null,
        block_number: null,
        blockchain_network: 'polygon-amoy',
        anchored_at: null,
        data_hash: 'abc123',
      } as BlockchainProof;

      mockProofRepository.findOne.mockResolvedValue(proof);

      const result = await service.getProofForProt('prot-uuid-1');

      expect(result!.status).toBe(BlockchainProofStatus.FAILED);
      expect(result!.integrity.fullyVerified).toBe(false);
      expect(mockProtRepository.findOne).not.toHaveBeenCalled();
    });

    it('returns proof data with dbIntact=true when hash matches for CONFIRMED proof', async () => {
      const proof = {
        prot_id: 'prot-uuid-1',
        status: BlockchainProofStatus.CONFIRMED,
        version: 1,
        tx_hash: '0xabc',
        block_number: '12345',
        blockchain_network: 'polygon-amoy',
        anchored_at: new Date('2026-03-17T10:00:05.000Z'),
        data_hash: 'will-be-replaced-by-computed-hash',
      } as BlockchainProof;

      const prot = { id: 'prot-uuid-1', nama: 'Gobak Sodor' } as PROT;

      mockProofRepository.findOne.mockResolvedValue(proof);
      mockProtRepository.findOne.mockResolvedValue(prot);

      // Compute the real hash so we can set it on the proof
      // We'll spy on computeHash to control the test
      jest.spyOn(service, 'computeHash').mockReturnValue('fixed-hash-abc');
      proof.data_hash = 'fixed-hash-abc'; // matches computed hash → dbIntact = true

      const result = await service.getProofForProt('prot-uuid-1');

      expect(result!.status).toBe(BlockchainProofStatus.CONFIRMED);
      expect(result!.integrity.dbIntact).toBe(true);
      expect(result!.txHash).toBe('0xabc');
      expect(result!.blockNumber).toBe('12345');
    });

    it('returns dbIntact=false when computed hash does not match stored hash', async () => {
      const proof = {
        prot_id: 'prot-uuid-1',
        status: BlockchainProofStatus.CONFIRMED,
        version: 1,
        tx_hash: '0xabc',
        block_number: '12345',
        blockchain_network: 'polygon-amoy',
        anchored_at: new Date(),
        data_hash: 'original-hash',
      } as BlockchainProof;

      mockProofRepository.findOne.mockResolvedValue(proof);
      mockProtRepository.findOne.mockResolvedValue({ id: 'prot-uuid-1' } as PROT);
      jest.spyOn(service, 'computeHash').mockReturnValue('tampered-hash');
      // proof.data_hash = 'original-hash' !== 'tampered-hash' → dbIntact = false

      const result = await service.getProofForProt('prot-uuid-1');

      expect(result!.integrity.dbIntact).toBe(false);
      expect(result!.integrity.fullyVerified).toBe(false);
    });

    it('maps all proof fields to response correctly', async () => {
      const proof = {
        prot_id: 'prot-uuid-1',
        status: BlockchainProofStatus.PENDING,
        version: 2,
        tx_hash: null,
        block_number: null,
        blockchain_network: 'localhost',
        anchored_at: null,
        data_hash: 'hash-abc',
      } as BlockchainProof;

      mockProofRepository.findOne.mockResolvedValue(proof);

      const result = await service.getProofForProt('prot-uuid-1');

      expect(result).toMatchObject({
        protId: 'prot-uuid-1',
        status: BlockchainProofStatus.PENDING,
        version: 2,
        txHash: null,
        blockNumber: null,
        network: 'localhost',
        anchoredAt: null,
      });
    });
  });

  describe('triggerReanchor', () => {
    it('throws NotFoundException when no proof exists for the PROT', async () => {
      mockProofRepository.findOne.mockResolvedValue(null);

      await expect(service.triggerReanchor('prot-uuid-1')).rejects.toThrow(
        'No blockchain proof record found for PROT prot-uuid-1',
      );
    });

    it('throws ConflictException when proof is already CONFIRMED', async () => {
      const proof = {
        id: 'proof-uuid-1',
        prot_id: 'prot-uuid-1',
        status: BlockchainProofStatus.CONFIRMED,
        prot: { id: 'prot-uuid-1' } as PROT,
      } as BlockchainProof;

      mockProofRepository.findOne.mockResolvedValue(proof);

      await expect(service.triggerReanchor('prot-uuid-1')).rejects.toThrow(
        'Blockchain proof is already confirmed',
      );
    });

    it('resets retry_count and status, then calls sendToChain for FAILED proof', async () => {
      const proof = {
        id: 'proof-1',
        prot_id: 'prot-uuid-1',
        status: BlockchainProofStatus.FAILED,
        retry_count: 3,
        data_hash: 'hash-abc',
        last_error: 'some error',
        prot: { id: 'prot-uuid-1' } as PROT,
      } as BlockchainProof;

      mockProofRepository.findOne.mockResolvedValue(proof);
      mockProofRepository.save.mockResolvedValue(proof);

      jest.spyOn(service, 'computeHash').mockReturnValue('hash-abc');

      const sendToChainSpy = jest
        .spyOn(service, 'sendToChain')
        .mockResolvedValue(undefined);

      const result = await service.triggerReanchor('prot-uuid-1');

      expect(mockProofRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          retry_count: 0,
          status: BlockchainProofStatus.PENDING,
          last_error: null,
          data_hash: 'hash-abc',
        }),
      );
      expect(sendToChainSpy).toHaveBeenCalledWith(proof, 'prot-uuid-1', 'hash-abc');
      expect(result).toMatchObject({ message: 'Reanchor initiated', proofId: 'proof-1' });
    });

    it('resets retry_count and calls sendToChain for PENDING proof with maxed retries', async () => {
      const proof = {
        id: 'proof-2',
        prot_id: 'prot-uuid-1',
        status: BlockchainProofStatus.PENDING,
        retry_count: 3,
        data_hash: 'hash-xyz',
        last_error: null,
        prot: { id: 'prot-uuid-1' } as PROT,
      } as BlockchainProof;

      mockProofRepository.findOne.mockResolvedValue(proof);
      mockProofRepository.save.mockResolvedValue(proof);

      jest.spyOn(service, 'computeHash').mockReturnValue('hash-xyz');
      jest.spyOn(service, 'sendToChain').mockResolvedValue(undefined);

      await service.triggerReanchor('prot-uuid-1');

      expect(mockProofRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          retry_count: 0,
          status: BlockchainProofStatus.PENDING,
          data_hash: 'hash-xyz',
        }),
      );
    });
  });
});
