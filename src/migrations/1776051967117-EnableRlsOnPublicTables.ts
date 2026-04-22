import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableRlsOnPublicTables1776051967117 implements MigrationInterface {
    name = 'EnableRlsOnPublicTables1776051967117';

    private readonly tables = [
        'audit_logs',
        'blockchain_proof',
        'calendar_invites',
        'calendar_items',
        'certificates',
        'communities',
        'community_members',
        'daerah',
        'event_registrations',
        'events',
        'kategori_produk',
        'marketplace_order',
        'migrations',
        'nft_catalog',
        'notifications',
        'order_item',
        'permainan',
        'produk',
        'produk_prot',
        'prot',
        'settings',
        'toko',
        'users',
        'verifikasi',
        'verifikasi_queue',
    ];

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const tableName of this.tables) {
            await queryRunner.query(
                `ALTER TABLE IF EXISTS "${tableName}" ENABLE ROW LEVEL SECURITY`,
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const tableName of this.tables) {
            await queryRunner.query(
                `ALTER TABLE IF EXISTS "${tableName}" DISABLE ROW LEVEL SECURITY`,
            );
        }
    }
}
