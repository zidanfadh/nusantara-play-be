import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { IsAvatarUrl } from './avatar-url.validation';

export class CreateUserDto {
  @IsUUID()
  @IsNotEmpty()
  supabase_user_id: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  full_name: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsAvatarUrl()
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
}
