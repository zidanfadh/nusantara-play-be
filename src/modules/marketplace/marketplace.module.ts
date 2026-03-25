import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KategoriProduk } from './entities/kategori-produk.entity';
import { Toko } from './entities/toko.entity';
import { Produk } from './entities/produk.entity';
import { ProdukProt } from './entities/produk-prot.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { PROT } from '../prot/entities/prot.entity';
import { KategoriProdukService } from './kategori-produk.service';
import { TokoService } from './toko.service';
import { ProdukService } from './produk.service';
import { OrderService } from './order.service';
import { KategoriProdukController } from './kategori-produk.controller';
import { TokoController } from './toko.controller';
import { ProdukController } from './produk.controller';
import { OrderController } from './order.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KategoriProduk,
      Toko,
      Produk,
      ProdukProt,
      Order,
      OrderItem,
      PROT,
    ]),
  ],
  controllers: [
    KategoriProdukController,
    TokoController,
    ProdukController,
    OrderController,
  ],
  providers: [
    KategoriProdukService,
    TokoService,
    ProdukService,
    OrderService,
  ],
})
export class MarketplaceModule {}
