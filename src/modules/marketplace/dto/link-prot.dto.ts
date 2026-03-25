import { IsUUID } from 'class-validator';

export class LinkProtDto {
  @IsUUID()
  prot_id: string;
}
