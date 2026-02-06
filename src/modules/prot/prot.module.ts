import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PROTService } from './prot.service';
import { PROTController } from './prot.controller';
import { PROT } from './entities/prot.entity';
import { StorageModule } from '../storage/storage.module';
import { DaerahModule } from '../daerah/daerah.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PROT]),
    StorageModule,
    DaerahModule,
  ],
  controllers: [PROTController],
  providers: [PROTService],
  exports: [PROTService],
})
export class PROTModule {}
