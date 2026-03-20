import { IsUUID, IsOptional, IsString } from 'class-validator';

export class QueryProdukDto {
  @IsUUID()
  @IsOptional()
  toko_id?: string;

  @IsUUID()
  @IsOptional()
  kategori_id?: string;

  @IsUUID()
  @IsOptional()
  prot_id?: string;

  @IsString()
  @IsOptional()
  search?: string;
}
