import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsUUID,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ShippingAddressDto {
  @IsString()
  @IsNotEmpty()
  nama_penerima: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  alamat_lengkap: string;

  @IsString()
  @IsNotEmpty()
  kota: string;

  @IsString()
  @IsNotEmpty()
  provinsi: string;

  @IsString()
  @IsOptional()
  kode_pos?: string;
}

export class OrderItemDto {
  @IsUUID()
  produk_id: string;

  @IsInt()
  @Min(1)
  qty: number;
}

export class CreateOrderDto {
  @IsUUID()
  toko_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shipping_address: ShippingAddressDto;

  @IsString()
  @IsOptional()
  catatan?: string;
}
