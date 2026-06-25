import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class UpdateRoleDto {
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;

  @IsUUID()
  @IsOptional()
  daerah_id?: string;
}
