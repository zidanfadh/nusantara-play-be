import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PublishProtDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  catatan?: string;
}
