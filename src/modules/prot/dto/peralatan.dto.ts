import { IsString, IsOptional, IsArray } from 'class-validator';

export class PeralatanDto {
  @IsString()
  nama: string;

  @IsString()
  @IsOptional()
  deskripsi?: string;

  @IsString()
  @IsOptional()
  kisaranHarga?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  fotoAlat?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  urlPembelian?: string[];
}
