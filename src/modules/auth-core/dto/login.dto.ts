import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** POST /api/auth/login (Phase 08). */
export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  password: string;
}
