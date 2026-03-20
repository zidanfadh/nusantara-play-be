import { IsString, IsNotEmpty, IsOptional, Matches, MaxLength } from 'class-validator';

export class CreateKategoriDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nama: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug hanya boleh huruf kecil, angka, dan tanda hubung' })
  @MaxLength(100)
  slug: string;

  @IsString()
  @IsOptional()
  deskripsi?: string;
}
