import { IsOptional, IsString, IsUUID, IsArray } from 'class-validator';
import { IsAvatarUrl } from './avatar-url.validation';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  full_name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsAvatarUrl()
  avatar_url?: string | null;

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
