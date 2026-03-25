import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TokoService } from './toko.service';
import { CreateTokoDto } from './dto/create-toko.dto';
import { UpdateTokoDto } from './dto/update-toko.dto';

@Controller('marketplace/toko')
export class TokoController {
  constructor(private readonly service: TokoService) {}

  @Public()
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('my')
  findMy(@CurrentUser() user: any) {
    return this.service.findMy(user.id);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateTokoDto) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateTokoDto,
  ) {
    return this.service.update(id, user.id, dto);
  }
}
