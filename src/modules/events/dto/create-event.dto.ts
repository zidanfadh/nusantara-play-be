import { IsString, IsEnum, IsOptional, IsInt, IsEmail, IsObject, IsArray, MinDate, validateSync } from 'class-validator';
import { Type } from 'class-transformer';
import { EventJenis } from '../entities/event.entity';

export class FormulirCustomDto {
  @IsOptional()
  @IsString()
  nama?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  telepon?: string;

  @IsOptional()
  @IsString()
  alamat?: string;
}

export class CreateEventDto {
  @IsString()
  nama: string;

  @IsString()
  deskripsi: string;

  @IsEnum(EventJenis)
  jenis: EventJenis;

  @IsOptional()
  @IsEnum(EventJenis)
  type?: EventJenis; // Alias for jenis (API compatibility)

  @Type(() => Date)
  tanggal_mulai: Date;

  @Type(() => Date)
  tanggal_selesai: Date;

  @IsString()
  lokasi: string;

  @IsString()
  daerah_id: string;

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
