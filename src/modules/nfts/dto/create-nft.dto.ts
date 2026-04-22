import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateNftDto {
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

  @IsString()
  @IsOptional()
  about?: string;

  @IsUrl({ require_protocol: true })
  @IsOptional()
  image_url?: string;

  @IsArray()
  @IsUrl({ require_protocol: true }, { each: true })
  @IsOptional()
  gallery_urls?: string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  blockchain_network: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  contract_address: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  token_id: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  token_standard?: string;

  @IsUrl({ require_protocol: true })
  @IsOptional()
  metadata_uri?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  marketplace_name?: string;

  @IsUrl({ require_protocol: true })
  @IsOptional()
  marketplace_url?: string;

  @IsUrl({ require_protocol: true })
  @IsOptional()
  external_url?: string;

  @IsUUID()
  @IsOptional()
  prot_id?: string;
}
