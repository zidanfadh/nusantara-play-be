import { IsOptional, IsEnum, IsString, IsInt, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { EventJenis, EventStatus } from '../entities/event.entity';

export class EventFilterDto {
  @IsOptional()
  @IsEnum(EventJenis)
  jenis?: EventJenis;

  @IsOptional()
  @IsEnum(EventJenis)
  type?: EventJenis; // Alias

  @IsOptional()
  @IsString()
  daerah_id?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sortBy?: 'tanggal_mulai' | 'created_at' | 'jumlah_peserta';

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 20;
}
