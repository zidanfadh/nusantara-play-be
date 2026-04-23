import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { NftCatalogStatus } from '../entities/nft-catalog.entity';

export class QueryNftsDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  blockchain_network?: string;

  @IsUUID()
  @IsOptional()
  prot_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class QueryAdminNftsDto extends QueryNftsDto {
  @IsEnum(NftCatalogStatus)
  @IsOptional()
  status?: NftCatalogStatus;
}
