/**
 * Small fixture helpers for integration tests (Phase 06). Every row gets a
 * random suffix so tests never collide with the DEMO seed or with each other,
 * and cleanup() deletes exactly the rows a test created (children first).
 */
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { User, UserRole } from '../../src/modules/users/entities/user.entity';
import { Toko } from '../../src/modules/marketplace/entities/toko.entity';
import { Produk } from '../../src/modules/marketplace/entities/produk.entity';
import {
  PROT,
  PROTJenis,
  PROTStatus,
  TargetUsia,
} from '../../src/modules/prot/entities/prot.entity';

export class Fixtures {
  private readonly userIds: string[] = [];
  private readonly tokoIds: string[] = [];
  private readonly produkIds: string[] = [];
  private readonly protIds: string[] = [];

  constructor(private readonly dataSource: DataSource) {}

  async user(role: UserRole = UserRole.PUBLIK): Promise<User> {
    const suffix = randomUUID().slice(0, 8);
    const user = await this.dataSource.getRepository(User).save({
      supabase_user_id: randomUUID(),
      email: `int-${suffix}@example.test`,
      full_name: `INT ${role} ${suffix}`,
      role,
      phone: '+62 800 0000 0000',
      last_login_at: new Date(),
    });
    this.userIds.push(user.id);
    return user;
  }

  async toko(owner: User): Promise<Toko> {
    const suffix = randomUUID().slice(0, 8);
    const toko = await this.dataSource.getRepository(Toko).save({
      user_id: owner.id,
      nama: `INT Toko ${suffix}`,
      slug: `int-toko-${suffix}`,
    });
    this.tokoIds.push(toko.id);
    return toko;
  }

  async produk(toko: Toko, stok: number, harga = 15000): Promise<Produk> {
    const suffix = randomUUID().slice(0, 8);
    const produk = await this.dataSource.getRepository(Produk).save({
      toko_id: toko.id,
      nama: `INT Produk ${suffix}`,
      slug: `int-produk-${suffix}`,
      harga,
      stok,
      prots: [],
    });
    this.produkIds.push(produk.id);
    return produk;
  }

  async prot(owner: User, status: PROTStatus): Promise<PROT> {
    const prot = await this.dataSource.getRepository(PROT).save({
      nama: `INT PROT ${randomUUID().slice(0, 8)}`,
      jenis: PROTJenis.PERMAINAN_RAKYAT,
      targetUsia: TargetUsia.SEMUA_USIA,
      status,
      created_by: owner.id,
    });
    this.protIds.push(prot.id);
    return prot;
  }

  async stok(produkId: string): Promise<number> {
    const produk = await this.dataSource
      .getRepository(Produk)
      .findOneByOrFail({ id: produkId });
    return produk.stok;
  }

  async cleanup(): Promise<void> {
    const q = (sql: string, ids: string[]) =>
      ids.length ? this.dataSource.query(sql, [ids]) : Promise.resolve();
    await q(
      `DELETE FROM order_item WHERE order_id IN (SELECT id FROM marketplace_order WHERE toko_id = ANY($1))`,
      this.tokoIds,
    );
    await q(
      `DELETE FROM marketplace_order WHERE toko_id = ANY($1)`,
      this.tokoIds,
    );
    await q(`DELETE FROM produk WHERE id = ANY($1)`, this.produkIds);
    await q(`DELETE FROM toko WHERE id = ANY($1)`, this.tokoIds);
    await q(
      `DELETE FROM verifikasi_queue WHERE prot_id = ANY($1)`,
      this.protIds,
    );
    await q(`DELETE FROM verifikasi WHERE prot_id = ANY($1)`, this.protIds);
    await q(`DELETE FROM prot WHERE id = ANY($1)`, this.protIds);
    await q(`DELETE FROM users WHERE id = ANY($1)`, this.userIds);
  }
}
