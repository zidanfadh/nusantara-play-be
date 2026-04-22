import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { PROT } from '../prot/entities/prot.entity';
import { StorageModule } from '../storage/storage.module';
import { NftCatalog } from './entities/nft-catalog.entity';
import { NftsController } from './nfts.controller';
import { NftsService } from './nfts.service';

@Module({
  imports: [TypeOrmModule.forFeature([NftCatalog, PROT]), StorageModule, AuditModule],
  controllers: [NftsController],
  providers: [NftsService],
})
export class NftsModule {}
