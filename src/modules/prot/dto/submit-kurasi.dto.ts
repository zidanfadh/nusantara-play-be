import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitKurasiDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  catatan?: string;
}
