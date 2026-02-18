import { IsString, IsEnum, IsOptional, IsArray, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PROTJenis, TargetUsia } from '../entities/prot.entity';
import { PeralatanDto } from './peralatan.dto';

export class CreatePROTDto {
  @IsString()
  @MinLength(3)
  nama: string;

  @IsEnum(PROTJenis)
  jenis: PROTJenis;

  @IsString()
  @IsOptional()
  statusAsalUsul?: string;

  @IsString()
  @IsOptional()
  provinsiKode?: string;

  @IsString()
  @IsOptional()
  kabkotaKode?: string;

  @IsString()
  @IsOptional()
  kecamatanKode?: string;

  @IsString()
  @IsOptional()
  desaKode?: string;

  @IsString()
  @IsOptional()
  alamatLengkap?: string;

  @IsString()
  @IsOptional()
  caraBermain?: string;

  @IsString()
  @IsOptional()
  nilaiMoral?: string;

  @IsEnum(TargetUsia)
  targetUsia: TargetUsia;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PeralatanDto)
  @IsOptional()
  peralatan?: PeralatanDto[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  fotoKegiatan?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  videoKegiatan?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  dokumenKurikulum?: string[];
}
