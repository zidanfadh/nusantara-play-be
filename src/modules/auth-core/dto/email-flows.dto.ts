import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** POST /api/auth/resend-verification and /forgot-password (Phase 09). */
export class EmailOnlyDto {
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email: string;
}

/** POST /api/auth/verify-email (Phase 09). Raw tokens are 43 characters. */
export class VerifyEmailDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  token: string;
}

/**
 * POST /api/auth/reset-password (Phase 09). The password policy is checked
 * by EmailFlowsService; MaxLength only stops huge inputs before hashing.
 */
export class ResetPasswordDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  token: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  newPassword: string;
}
