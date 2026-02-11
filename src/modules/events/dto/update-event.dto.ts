import { IsString, IsEnum, IsOptional, IsInt, IsEmail, IsObject, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { EventJenis } from '../entities/event.entity';

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  nama?: string;

  @IsOptional()
  @IsString()
  deskripsi?: string;

  @IsOptional()
  @IsEnum(EventJenis)
  jenis?: EventJenis;

  @IsOptional()
  @IsEnum(EventJenis)
  type?: EventJenis; // Alias for jenis (API compatibility)

  @IsOptional()
  @Type(() => Date)
  tanggal_mulai?: Date;

  @IsOptional()
  @Type(() => Date)
  tanggal_selesai?: Date;

  @IsOptional()
  @IsString()
  lokasi?: string;

  @IsOptional()
  @IsString()
  daerah_id?: string;

  @IsOptional()
  latitude?: number;

  @IsOptional()
  longitude?: number;

  @IsOptional()
  @IsInt()
  kuota_peserta?: number;

  @IsOptional()
  @IsString()
  banner_url?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  galeri_foto?: string[];

  @IsOptional()
  @IsString()
  persyaratan?: string;

  @IsOptional()
  @IsObject()
  formulir_custom?: Record<string, any>;

  @IsOptional()
  @IsString()
  contact_person?: string;

  @IsOptional()
  @IsString()
  contact_phone?: string;

  @IsOptional()
  @IsEmail()
  contact_email?: string;
}
