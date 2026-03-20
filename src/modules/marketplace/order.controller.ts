import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { KirimOrderDto } from './dto/kirim-order.dto';

@Controller('marketplace/order')
export class OrderController {
  constructor(private readonly service: OrderService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateOrderDto) {
    return this.service.create(user.id, dto);
  }

  @Get()
  findMyOrders(@CurrentUser() user: any) {
    return this.service.findMyOrders(user.id);
  }

  @Get('seller')
  findSellerOrders(@CurrentUser() user: any) {
    return this.service.findSellerOrders(user.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user.id);
  }

  @Patch(':id/konfirmasi')
  konfirmasi(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.konfirmasi(id, user.id);
  }

  @Patch(':id/kirim')
  kirim(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body() dto: KirimOrderDto,
  ) {
    return this.service.kirim(id, user.id, dto);
  }

  @Patch(':id/selesai')
  selesai(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.selesai(id, user.id);
  }

  @Patch(':id/batalkan')
  batalkan(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.batalkan(id, user.id);
  }
}
