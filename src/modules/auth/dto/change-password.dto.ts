import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * POST /api/auth/change-password body (Phase 08: confirmPassword is
 * optional). Accounts with a local password follow the Phase 07 policy
 * (LocalAuthService); Supabase accounts are additionally validated with
 * LegacyChangePasswordDto, exactly as before Phase 08.
 */
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  currentPassword: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  newPassword: string;

  @IsOptional()
  @IsString()
  confirmPassword?: string;
}

/** The pre-Phase-08 rules, still applied to the legacy Supabase path. */
export class LegacyChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}
