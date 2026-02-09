import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PROTService } from './prot.service';
import { PROTController } from './prot.controller';
import { VerifikasiController } from './verifikasi.controller';
import { VerifikasiService } from './verifikasi.service';
import { PROT } from './entities/prot.entity';
import { Verifikasi } from './entities/verifikasi.entity';
import { VerifikasiQueue } from './entities/verifikasi-queue.entity';
import { StorageModule } from '../storage/storage.module';
import { DaerahModule } from '../daerah/daerah.module';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PROT, Verifikasi, VerifikasiQueue]),
    StorageModule,
    DaerahModule,
    AuditModule,
    UsersModule,
  ],
  controllers: [PROTController, VerifikasiController],
  providers: [PROTService, VerifikasiService],
  exports: [PROTService, VerifikasiService],
})
export class PROTModule {}
