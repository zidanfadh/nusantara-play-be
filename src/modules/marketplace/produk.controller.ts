import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProdukService } from './produk.service';
import { CreateProdukDto } from './dto/create-produk.dto';
import { UpdateProdukDto } from './dto/update-produk.dto';
import { QueryProdukDto } from './dto/query-produk.dto';
import { LinkProtDto } from './dto/link-prot.dto';

@Controller('marketplace/produk')
export class ProdukController {
  constructor(private readonly service: ProdukService) {}

  @Public()
  @Get()
  findAll(@Query() query: QueryProdukDto) {
    return this.service.findAll(query);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateProdukDto) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateProdukDto,
  ) {
    return this.service.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user.id);
  }

  @Post(':id/prot')
  linkProt(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body() dto: LinkProtDto,
  ) {
    return this.service.linkProt(id, user.id, dto.prot_id);
  }

  @Delete(':id/prot/:protId')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlinkProt(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('protId', ParseUUIDPipe) protId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.unlinkProt(id, user.id, protId);
  }
}
