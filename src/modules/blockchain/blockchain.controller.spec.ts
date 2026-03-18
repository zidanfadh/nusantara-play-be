import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { BlockchainController } from './blockchain.controller';
import { BlockchainService } from './blockchain.service';
import { BlockchainProofStatus } from './entities/blockchain-proof.entity';

const mockBlockchainService = {
  getProofForProt: jest.fn(),
  triggerReanchor: jest.fn(),
};

describe('BlockchainController', () => {
  let controller: BlockchainController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlockchainController],
      providers: [
        { provide: BlockchainService, useValue: mockBlockchainService },
      ],
    }).compile();

    controller = module.get<BlockchainController>(BlockchainController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET :id/blockchain-proof', () => {
    it('returns proof data when proof exists', async () => {
      const proofData = {
        protId: 'prot-uuid-1',
        status: BlockchainProofStatus.CONFIRMED,
        version: 1,
        txHash: '0xabc',
        blockNumber: '12345',
        network: 'polygon-amoy',
        anchoredAt: new Date(),
        integrity: { dbIntact: true, chainIntact: true, fullyVerified: true },
      };
      mockBlockchainService.getProofForProt.mockResolvedValue(proofData);

      const result = await controller.getBlockchainProof('prot-uuid-1');

      expect(result).toEqual(proofData);
      expect(mockBlockchainService.getProofForProt).toHaveBeenCalledWith('prot-uuid-1');
    });

    it('throws NotFoundException when service returns null', async () => {
      mockBlockchainService.getProofForProt.mockResolvedValue(null);

      await expect(controller.getBlockchainProof('prot-uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('POST :id/blockchain-proof/reanchor', () => {
    it('returns reanchor result on success', async () => {
      const reanchorResult = { message: 'Reanchor initiated', proofId: 'proof-1' };
      mockBlockchainService.triggerReanchor.mockResolvedValue(reanchorResult);

      const result = await controller.reanchorProof('prot-uuid-1');

      expect(result).toEqual(reanchorResult);
      expect(mockBlockchainService.triggerReanchor).toHaveBeenCalledWith('prot-uuid-1');
    });

    it('propagates NotFoundException from service', async () => {
      mockBlockchainService.triggerReanchor.mockRejectedValue(
        new NotFoundException('No blockchain proof record found for PROT prot-uuid-1'),
      );

      await expect(controller.reanchorProof('prot-uuid-1')).rejects.toThrow(NotFoundException);
    });

    it('propagates ConflictException from service', async () => {
      mockBlockchainService.triggerReanchor.mockRejectedValue(
        new ConflictException('Blockchain proof is already confirmed'),
      );

      await expect(controller.reanchorProof('prot-uuid-1')).rejects.toThrow(ConflictException);
    });
  });
});
