import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * POST /api/auth/register (Phase 08). The password policy (8 to 128
 * characters, not the email) is checked by LocalAuthService; MaxLength here
 * only stops huge inputs before any hashing.
 */
export class RegisterDto {
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  password: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  full_name: string;
}
