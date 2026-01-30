import { IsOptional, IsString, IsUUID, IsArray } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  full_name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  avatar_url?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsUUID()
  @IsOptional()
  daerah_id?: string;

  @IsString()
  @IsOptional()
  institution?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  expertise?: string[];
}
