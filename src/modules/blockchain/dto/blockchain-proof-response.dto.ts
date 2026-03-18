import { BlockchainProofStatus } from '../entities/blockchain-proof.entity';

export class BlockchainProofResponseDto {
  protId: string;
  status: BlockchainProofStatus | null;
  version: number | null;
  txHash: string | null;
  blockNumber: string | null;
  network: string | null;
  anchoredAt: Date | null;
  integrity: {
    dbIntact: boolean;
    chainIntact: boolean;
    fullyVerified: boolean;
  };
}
