import { IsOptional, IsEnum, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { PROTJenis, TargetUsia } from '../entities/prot.entity';

export class QueryPROTDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 10;

  @IsOptional()
  @IsEnum(PROTJenis)
  jenis?: PROTJenis;

  @IsOptional()
  @IsString()
  provinsi?: string;

  @IsOptional()
  @IsString()
  kabkota?: string;

  @IsOptional()
  @IsString()
  kecamatan?: string;

  @IsOptional()
  @IsString()
  desa?: string;

  @IsOptional()
  @IsEnum(TargetUsia)
  targetUsia?: TargetUsia;

  @IsOptional()
  @IsString()
  search?: string;
}
