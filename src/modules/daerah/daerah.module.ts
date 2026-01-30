import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DaerahService } from './daerah.service';
import { DaerahController } from './daerah.controller';
import { Daerah } from './entities/daerah.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Daerah])],
  controllers: [DaerahController],
  providers: [DaerahService],
  exports: [DaerahService],
})
export class DaerahModule {}
