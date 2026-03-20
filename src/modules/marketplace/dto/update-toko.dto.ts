import { PartialType } from '@nestjs/mapped-types';
import { CreateTokoDto } from './create-toko.dto';

export class UpdateTokoDto extends PartialType(CreateTokoDto) {}
