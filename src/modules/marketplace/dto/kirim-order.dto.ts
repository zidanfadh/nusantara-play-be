import { IsString, IsNotEmpty } from 'class-validator';

export class KirimOrderDto {
  @IsString()
  @IsNotEmpty()
  kurir_pengiriman: string;

  @IsString()
  @IsNotEmpty()
  nomor_resi: string;
}
