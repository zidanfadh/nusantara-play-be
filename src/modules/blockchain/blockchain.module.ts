import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainService } from './blockchain.service';
import { BlockchainScheduler } from './blockchain.scheduler';
import { BlockchainProof } from './entities/blockchain-proof.entity';
import { Verifikasi } from '../prot/entities/verifikasi.entity';
import { PROT } from '../prot/entities/prot.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BlockchainProof, Verifikasi, PROT])],
  providers: [BlockchainService, BlockchainScheduler],
  exports: [BlockchainService],
})
export class BlockchainModule {}
