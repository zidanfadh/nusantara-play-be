import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsInt,
  Min,
  IsArray,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateProdukDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nama: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug hanya boleh huruf kecil, angka, dan tanda hubung' })
  @MaxLength(200)
  slug: string;

  @IsString()
  @IsOptional()
  deskripsi?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  harga: number;

  @IsInt()
  @Min(0)
  stok: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsUUID()
  @IsOptional()
  kategori_id?: string;
}
