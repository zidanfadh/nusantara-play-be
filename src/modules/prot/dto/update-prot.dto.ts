import { PartialType } from '@nestjs/mapped-types';
import { CreatePROTDto } from './create-prot.dto';

export class UpdatePROTDto extends PartialType(CreatePROTDto) {}
