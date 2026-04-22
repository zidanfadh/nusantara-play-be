import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
  ValueTransformer,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { PROT } from '../../prot/entities/prot.entity';

const JsonArrayTransformer: ValueTransformer = {
  to: (value: any) => JSON.stringify(value),
  from: (value: any) => {
    if (value === null || value === undefined) return null;
    return typeof value === 'string' ? JSON.parse(value) : value;
  },
};

export enum NftCatalogStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}

@Entity('nft_catalog')
@Unique(['slug'])
@Unique(['blockchain_network', 'contract_address', 'token_id'])
export class NftCatalog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nama: string;

  @Column()
  slug: string;

  @Column({ type: 'text', nullable: true })
  deskripsi: string | null;

  @Column({ type: 'text', nullable: true })
  about: string | null;

  @Column({ type: 'text', nullable: true, name: 'image_url' })
  image_url: string | null;

  @Column({
    type: 'jsonb',
    nullable: true,
    name: 'gallery_urls',
    transformer: JsonArrayTransformer,
  })
  gallery_urls: string[] | null;

  @Index()
  @Column({ name: 'blockchain_network' })
  blockchain_network: string;

  @Column({ name: 'contract_address' })
  contract_address: string;

  @Column({ name: 'token_id' })
  token_id: string;

  @Column({ type: 'varchar', nullable: true, name: 'token_standard' })
  token_standard: string | null;

  @Column({ type: 'text', nullable: true, name: 'metadata_uri' })
  metadata_uri: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'marketplace_name' })
  marketplace_name: string | null;

  @Column({ type: 'text', nullable: true, name: 'marketplace_url' })
  marketplace_url: string | null;

  @Column({ type: 'text', nullable: true, name: 'external_url' })
  external_url: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true, name: 'prot_id' })
  prot_id: string | null;

  @Index()
  @Column({
    type: 'enum',
    enum: NftCatalogStatus,
    enumName: 'nft_catalog_status',
    default: NftCatalogStatus.DRAFT,
  })
  status: NftCatalogStatus;

  @Index()
  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @Column({ type: 'uuid', name: 'created_by' })
  created_by: string;

  @Column({ type: 'uuid', nullable: true, name: 'updated_by' })
  updated_by: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'published_at' })
  published_at: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => PROT, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'prot_id' })
  prot: PROT | null;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedBy: User | null;
}
