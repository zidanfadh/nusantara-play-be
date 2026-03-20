import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Produk } from './produk.entity';
import { PROT } from '../../prot/entities/prot.entity';

@Entity('produk_prot')
export class ProdukProt {
  @PrimaryColumn({ name: 'produk_id', type: 'uuid' })
  produk_id: string;

  @PrimaryColumn({ name: 'prot_id', type: 'uuid' })
  prot_id: string;

  @ManyToOne(() => Produk)
  @JoinColumn({ name: 'produk_id' })
  produk: Produk;

  @ManyToOne(() => PROT)
  @JoinColumn({ name: 'prot_id' })
  prot: PROT;
}
