import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDaerahBPS1738826000000 implements MigrationInterface {
  name = 'SeedDaerahBPS1738826000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Delete existing provinsi data (kode 2 huruf)
    await queryRunner.query(`DELETE FROM daerah WHERE level = 'provinsi';`);

    // 2. Insert Provinsi dengan Kode BPS
    await queryRunner.query(`
      INSERT INTO daerah (id, nama, kode, provinsi, level, parent_id, latitude, longitude, metadata)
      VALUES
        (gen_random_uuid(), 'Aceh', '11', 'Aceh', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Sumatera Utara', '12', 'Sumatera Utara', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Sumatera Barat', '13', 'Sumatera Barat', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Riau', '14', 'Riau', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Jambi', '15', 'Jambi', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Sumatera Selatan', '16', 'Sumatera Selatan', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Bengkulu', '17', 'Bengkulu', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Lampung', '18', 'Lampung', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Kepulauan Bangka Belitung', '19', 'Kepulauan Bangka Belitung', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Kepulauan Riau', '21', 'Kepulauan Riau', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'DKI Jakarta', '31', 'DKI Jakarta', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Jawa Barat', '32', 'Jawa Barat', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Jawa Tengah', '33', 'Jawa Tengah', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'DI Yogyakarta', '34', 'DI Yogyakarta', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Jawa Timur', '35', 'Jawa Timur', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Banten', '36', 'Banten', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Bali', '51', 'Bali', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Nusa Tenggara Barat', '52', 'Nusa Tenggara Barat', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Nusa Tenggara Timur', '53', 'Nusa Tenggara Timur', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Kalimantan Barat', '61', 'Kalimantan Barat', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Kalimantan Tengah', '62', 'Kalimantan Tengah', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Kalimantan Selatan', '63', 'Kalimantan Selatan', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Kalimantan Timur', '64', 'Kalimantan Timur', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Kalimantan Utara', '65', 'Kalimantan Utara', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Sulawesi Utara', '71', 'Sulawesi Utara', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Sulawesi Tengah', '72', 'Sulawesi Tengah', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Sulawesi Selatan', '73', 'Sulawesi Selatan', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Sulawesi Tenggara', '74', 'Sulawesi Tenggara', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Gorontalo', '75', 'Gorontalo', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Sulawesi Barat', '76', 'Sulawesi Barat', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Maluku', '81', 'Maluku', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Maluku Utara', '82', 'Maluku Utara', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Papua', '91', 'Papua', 'provinsi', NULL, NULL, NULL, NULL),
        (gen_random_uuid(), 'Papua Barat', '92', 'Papua Barat', 'provinsi', NULL, NULL, NULL, NULL);
    `);

    // Helper function untuk insert kabupaten/kota
    const insertKabKota = async (
      queryRunner: QueryRunner,
      provNama: string,
      provKode: string,
      data: { kode: string; nama: string; level: string }[],
    ): Promise<void> => {
      const parentIdSelect = `(SELECT id FROM daerah WHERE kode = '${provKode}' AND level = 'provinsi')`;

      for (const item of data) {
        await queryRunner.query(`
          INSERT INTO daerah (id, nama, kode, provinsi, level, parent_id, latitude, longitude, metadata)
          VALUES (gen_random_uuid(), '${item.nama}', '${item.kode}', '${provNama}', '${item.level}', ${parentIdSelect}, NULL, NULL, NULL)
        `);
      }
    };

    // ACEH (11)
    await insertKabKota(queryRunner, 'Aceh', '11', [
      { kode: '11.01', nama: 'Kabupaten Simeulue', level: 'kabupaten' },
      { kode: '11.02', nama: 'Kabupaten Aceh Singkil', level: 'kabupaten' },
      { kode: '11.03', nama: 'Kabupaten Aceh Selatan', level: 'kabupaten' },
      { kode: '11.04', nama: 'Kabupaten Aceh Tenggara', level: 'kabupaten' },
      { kode: '11.05', nama: 'Kabupaten Aceh Timur', level: 'kabupaten' },
      { kode: '11.06', nama: 'Kabupaten Aceh Tengah', level: 'kabupaten' },
      { kode: '11.07', nama: 'Kabupaten Aceh Jaya', level: 'kabupaten' },
      { kode: '11.08', nama: 'Kabupaten Bener Meriah', level: 'kabupaten' },
      { kode: '11.09', nama: 'Kabupaten Pidie Jaya', level: 'kabupaten' },
      { kode: '11.10', nama: 'Kabupaten Bireuen', level: 'kabupaten' },
      { kode: '11.11', nama: 'Kabupaten Pidie', level: 'kabupaten' },
      { kode: '11.12', nama: 'Kabupaten Aceh Utara', level: 'kabupaten' },
      { kode: '11.71', nama: 'Kota Banda Aceh', level: 'kota' },
      { kode: '11.72', nama: 'Kota Sabang', level: 'kota' },
      { kode: '11.73', nama: 'Kota Langsa', level: 'kota' },
      { kode: '11.74', nama: 'Kota Lhokseumawe', level: 'kota' },
      { kode: '11.75', nama: 'Kota Subulussalam', level: 'kota' },
    ]);

    // DKI JAKARTA (31)
    await insertKabKota(queryRunner, 'DKI Jakarta', '31', [
      { kode: '31.71', nama: 'Kota Jakarta Pusat', level: 'kota' },
      { kode: '31.72', nama: 'Kota Jakarta Utara', level: 'kota' },
      { kode: '31.73', nama: 'Kota Jakarta Barat', level: 'kota' },
      { kode: '31.74', nama: 'Kota Jakarta Selatan', level: 'kota' },
      { kode: '31.75', nama: 'Kota Jakarta Timur', level: 'kota' },
      { kode: '31.76', nama: 'Kabupaten Kepulauan Seribu', level: 'kabupaten' },
    ]);

    // JAWA BARAT (32)
    await insertKabKota(queryRunner, 'Jawa Barat', '32', [
      { kode: '32.01', nama: 'Kabupaten Bogor', level: 'kabupaten' },
      { kode: '32.02', nama: 'Kabupaten Sukabumi', level: 'kabupaten' },
      { kode: '32.03', nama: 'Kabupaten Cianjur', level: 'kabupaten' },
      { kode: '32.04', nama: 'Kabupaten Bandung', level: 'kabupaten' },
      { kode: '32.05', nama: 'Kabupaten Garut', level: 'kabupaten' },
      { kode: '32.06', nama: 'Kabupaten Tasikmalaya', level: 'kabupaten' },
      { kode: '32.07', nama: 'Kabupaten Ciamis', level: 'kabupaten' },
      { kode: '32.08', nama: 'Kabupaten Kuningan', level: 'kabupaten' },
      { kode: '32.09', nama: 'Kabupaten Cirebon', level: 'kabupaten' },
      { kode: '32.10', nama: 'Kabupaten Majalengka', level: 'kabupaten' },
      { kode: '32.11', nama: 'Kabupaten Sumedang', level: 'kabupaten' },
      { kode: '32.12', nama: 'Kabupaten Indramayu', level: 'kabupaten' },
      { kode: '32.13', nama: 'Kabupaten Subang', level: 'kabupaten' },
      { kode: '32.14', nama: 'Kabupaten Purwakarta', level: 'kabupaten' },
      { kode: '32.15', nama: 'Kabupaten Karawang', level: 'kabupaten' },
      { kode: '32.16', nama: 'Kabupaten Bekasi', level: 'kabupaten' },
      { kode: '32.17', nama: 'Kabupaten Bandung Barat', level: 'kabupaten' },
      { kode: '32.18', nama: 'Kabupaten Pangandaran', level: 'kabupaten' },
      { kode: '32.71', nama: 'Kota Bogor', level: 'kota' },
      { kode: '32.72', nama: 'Kota Sukabumi', level: 'kota' },
      { kode: '32.73', nama: 'Kota Bandung', level: 'kota' },
      { kode: '32.74', nama: 'Kota Cirebon', level: 'kota' },
      { kode: '32.75', nama: 'Kota Bekasi', level: 'kota' },
      { kode: '32.76', nama: 'Kota Depok', level: 'kota' },
      { kode: '32.77', nama: 'Kota Cimahi', level: 'kota' },
      { kode: '32.78', nama: 'Kota Tasikmalaya', level: 'kota' },
      { kode: '32.79', nama: 'Kota Banjar', level: 'kota' },
    ]);

    // JAWA TENGAH (33)
    await insertKabKota(queryRunner, 'Jawa Tengah', '33', [
      { kode: '33.01', nama: 'Kabupaten Cilacap', level: 'kabupaten' },
      { kode: '33.02', nama: 'Kabupaten Banyumas', level: 'kabupaten' },
      { kode: '33.03', nama: 'Kabupaten Purbalingga', level: 'kabupaten' },
      { kode: '33.04', nama: 'Kabupaten Banjarnegara', level: 'kabupaten' },
      { kode: '33.05', nama: 'Kabupaten Kebumen', level: 'kabupaten' },
      { kode: '33.06', nama: 'Kabupaten Purworejo', level: 'kabupaten' },
      { kode: '33.07', nama: 'Kabupaten Wonosobo', level: 'kabupaten' },
      { kode: '33.08', nama: 'Kabupaten Magelang', level: 'kabupaten' },
      { kode: '33.09', nama: 'Kabupaten Boyolali', level: 'kabupaten' },
      { kode: '33.10', nama: 'Kabupaten Klaten', level: 'kabupaten' },
      { kode: '33.11', nama: 'Kabupaten Sukoharjo', level: 'kabupaten' },
      { kode: '33.12', nama: 'Kabupaten Wonogiri', level: 'kabupaten' },
      { kode: '33.13', nama: 'Kabupaten Karanganyar', level: 'kabupaten' },
      { kode: '33.14', nama: 'Kabupaten Sragen', level: 'kabupaten' },
      { kode: '33.15', nama: 'Kabupaten Grobogan', level: 'kabupaten' },
      { kode: '33.16', nama: 'Kabupaten Blora', level: 'kabupaten' },
      { kode: '33.17', nama: 'Kabupaten Rembang', level: 'kabupaten' },
      { kode: '33.18', nama: 'Kabupaten Pati', level: 'kabupaten' },
      { kode: '33.19', nama: 'Kabupaten Kudus', level: 'kabupaten' },
      { kode: '33.20', nama: 'Kabupaten Jepara', level: 'kabupaten' },
      { kode: '33.21', nama: 'Kabupaten Demak', level: 'kabupaten' },
      { kode: '33.22', nama: 'Kabupaten Semarang', level: 'kabupaten' },
      { kode: '33.23', nama: 'Kabupaten Temanggung', level: 'kabupaten' },
      { kode: '33.24', nama: 'Kabupaten Kendal', level: 'kabupaten' },
      { kode: '33.25', nama: 'Kabupaten Batang', level: 'kabupaten' },
      { kode: '33.26', nama: 'Kabupaten Pekalongan', level: 'kabupaten' },
      { kode: '33.27', nama: 'Kabupaten Pemalang', level: 'kabupaten' },
      { kode: '33.28', nama: 'Kabupaten Tegal', level: 'kabupaten' },
      { kode: '33.29', nama: 'Kabupaten Brebes', level: 'kabupaten' },
      { kode: '33.71', nama: 'Kota Magelang', level: 'kota' },
      { kode: '33.72', nama: 'Kota Surakarta', level: 'kota' },
      { kode: '33.73', nama: 'Kota Salatiga', level: 'kota' },
      { kode: '33.74', nama: 'Kota Semarang', level: 'kota' },
      { kode: '33.75', nama: 'Kota Pekalongan', level: 'kota' },
      { kode: '33.76', nama: 'Kota Tegal', level: 'kota' },
    ]);

    // DI YOGYAKARTA (34)
    await insertKabKota(queryRunner, 'DI Yogyakarta', '34', [
      { kode: '34.01', nama: 'Kabupaten Kulon Progo', level: 'kabupaten' },
      { kode: '34.02', nama: 'Kabupaten Bantul', level: 'kabupaten' },
      { kode: '34.03', nama: 'Kabupaten Gunung Kidul', level: 'kabupaten' },
      { kode: '34.04', nama: 'Kabupaten Sleman', level: 'kabupaten' },
      { kode: '34.71', nama: 'Kota Yogyakarta', level: 'kota' },
    ]);

    // JAWA TIMUR (35)
    await insertKabKota(queryRunner, 'Jawa Timur', '35', [
      { kode: '35.01', nama: 'Kabupaten Pacitan', level: 'kabupaten' },
      { kode: '35.02', nama: 'Kabupaten Ponorogo', level: 'kabupaten' },
      { kode: '35.03', nama: 'Kabupaten Trenggalek', level: 'kabupaten' },
      { kode: '35.04', nama: 'Kabupaten Tulungagung', level: 'kabupaten' },
      { kode: '35.05', nama: 'Kabupaten Blitar', level: 'kabupaten' },
      { kode: '35.06', nama: 'Kabupaten Kediri', level: 'kabupaten' },
      { kode: '35.07', nama: 'Kabupaten Malang', level: 'kabupaten' },
      { kode: '35.08', nama: 'Kabupaten Lumajang', level: 'kabupaten' },
      { kode: '35.09', nama: 'Kabupaten Jember', level: 'kabupaten' },
      { kode: '35.10', nama: 'Kabupaten Banyuwangi', level: 'kabupaten' },
      { kode: '35.11', nama: 'Kabupaten Bondowoso', level: 'kabupaten' },
      { kode: '35.12', nama: 'Kabupaten Situbondo', level: 'kabupaten' },
      { kode: '35.13', nama: 'Kabupaten Probolinggo', level: 'kabupaten' },
      { kode: '35.14', nama: 'Kabupaten Pasuruan', level: 'kabupaten' },
      { kode: '35.15', nama: 'Kabupaten Sidoarjo', level: 'kabupaten' },
      { kode: '35.16', nama: 'Kabupaten Mojokerto', level: 'kabupaten' },
      { kode: '35.17', nama: 'Kabupaten Jombang', level: 'kabupaten' },
      { kode: '35.18', nama: 'Kabupaten Nganjuk', level: 'kabupaten' },
      { kode: '35.19', nama: 'Kabupaten Madiun', level: 'kabupaten' },
      { kode: '35.20', nama: 'Kabupaten Magetan', level: 'kabupaten' },
      { kode: '35.21', nama: 'Kabupaten Pamekasan', level: 'kabupaten' },
      { kode: '35.22', nama: 'Kabupaten Sampang', level: 'kabupaten' },
      { kode: '35.23', nama: 'Kabupaten Bangkalan', level: 'kabupaten' },
      { kode: '35.24', nama: 'Kabupaten Bojonegoro', level: 'kabupaten' },
      { kode: '35.25', nama: 'Kabupaten Tuban', level: 'kabupaten' },
      { kode: '35.26', nama: 'Kabupaten Lamongan', level: 'kabupaten' },
      { kode: '35.27', nama: 'Kabupaten Gresik', level: 'kabupaten' },
      { kode: '35.71', nama: 'Kota Kediri', level: 'kota' },
      { kode: '35.72', nama: 'Kota Blitar', level: 'kota' },
      { kode: '35.73', nama: 'Kota Malang', level: 'kota' },
      { kode: '35.74', nama: 'Kota Probolinggo', level: 'kota' },
      { kode: '35.75', nama: 'Kota Pasuruan', level: 'kota' },
      { kode: '35.76', nama: 'Kota Mojokerto', level: 'kota' },
      { kode: '35.77', nama: 'Kota Surabaya', level: 'kota' },
      { kode: '35.78', nama: 'Kota Madiun', level: 'kota' },
      { kode: '35.79', nama: 'Kota Batu', level: 'kota' },
    ]);

    // BANTEN (36)
    await insertKabKota(queryRunner, 'Banten', '36', [
      { kode: '36.01', nama: 'Kabupaten Pandeglang', level: 'kabupaten' },
      { kode: '36.02', nama: 'Kabupaten Lebak', level: 'kabupaten' },
      { kode: '36.03', nama: 'Kabupaten Tangerang', level: 'kabupaten' },
      { kode: '36.04', nama: 'Kabupaten Serang', level: 'kabupaten' },
      { kode: '36.71', nama: 'Kota Tangerang', level: 'kota' },
      { kode: '36.72', nama: 'Kota Cilegon', level: 'kota' },
      { kode: '36.73', nama: 'Kota Serang', level: 'kota' },
      { kode: '36.74', nama: 'Kota Tangerang Selatan', level: 'kota' },
    ]);

    // BALI (51)
    await insertKabKota(queryRunner, 'Bali', '51', [
      { kode: '51.01', nama: 'Kabupaten Jembrana', level: 'kabupaten' },
      { kode: '51.02', nama: 'Kabupaten Tabanan', level: 'kabupaten' },
      { kode: '51.03', nama: 'Kabupaten Badung', level: 'kabupaten' },
      { kode: '51.04', nama: 'Kabupaten Gianyar', level: 'kabupaten' },
      { kode: '51.05', nama: 'Kabupaten Klungkung', level: 'kabupaten' },
      { kode: '51.06', nama: 'Kabupaten Bangli', level: 'kabupaten' },
      { kode: '51.07', nama: 'Kabupaten Karangasem', level: 'kabupaten' },
      { kode: '51.08', nama: 'Kabupaten Buleleng', level: 'kabupaten' },
      { kode: '51.71', nama: 'Kota Denpasar', level: 'kota' },
    ]);

    // SUMATERA UTARA (12)
    await insertKabKota(queryRunner, 'Sumatera Utara', '12', [
      { kode: '12.01', nama: 'Kabupaten Nias', level: 'kabupaten' },
      { kode: '12.02', nama: 'Kabupaten Mandailing Natal', level: 'kabupaten' },
      { kode: '12.03', nama: 'Kabupaten Tapanuli Selatan', level: 'kabupaten' },
      { kode: '12.04', nama: 'Kabupaten Tapanuli Tengah', level: 'kabupaten' },
      { kode: '12.05', nama: 'Kabupaten Tapanuli Utara', level: 'kabupaten' },
      { kode: '12.06', nama: 'Kabupaten Toba', level: 'kabupaten' },
      { kode: '12.07', nama: 'Kabupaten Humbang Hasundutan', level: 'kabupaten' },
      { kode: '12.08', nama: 'Kabupaten Pakpak Bharat', level: 'kabupaten' },
      { kode: '12.09', nama: 'Kabupaten Simalungun', level: 'kabupaten' },
      { kode: '12.10', nama: 'Kabupaten Dairi', level: 'kabupaten' },
      { kode: '12.11', nama: 'Kabupaten Karo', level: 'kabupaten' },
      { kode: '12.12', nama: 'Kabupaten Deli Serdang', level: 'kabupaten' },
      { kode: '12.13', nama: 'Kabupaten Langkat', level: 'kabupaten' },
      { kode: '12.14', nama: 'Kabupaten Serdang Bedagai', level: 'kabupaten' },
      { kode: '12.15', nama: 'Kabupaten Batubara', level: 'kabupaten' },
      { kode: '12.16', nama: 'Kabupaten Asahan', level: 'kabupaten' },
      { kode: '12.17', nama: 'Kabupaten Labuhanbatu', level: 'kabupaten' },
      { kode: '12.18', nama: 'Kabupaten Labuhanbatu Selatan', level: 'kabupaten' },
      { kode: '12.19', nama: 'Kabupaten Labuhanbatu Utara', level: 'kabupaten' },
      { kode: '12.20', nama: 'Kabupaten Nias Utara', level: 'kabupaten' },
      { kode: '12.21', nama: 'Kabupaten Nias Barat', level: 'kabupaten' },
      { kode: '12.22', nama: 'Kabupaten Nias Selatan', level: 'kabupaten' },
      { kode: '12.23', nama: 'Kabupaten Padang Lawas', level: 'kabupaten' },
      { kode: '12.24', nama: 'Kabupaten Padang Lawas Utara', level: 'kabupaten' },
      { kode: '12.25', nama: 'Kabupaten Samosir', level: 'kabupaten' },
      { kode: '12.71', nama: 'Kota Medan', level: 'kota' },
      { kode: '12.72', nama: 'Kota Binjai', level: 'kota' },
      { kode: '12.73', nama: 'Kota Pematangsiantar', level: 'kota' },
      { kode: '12.74', nama: 'Kota Sibolga', level: 'kota' },
      { kode: '12.75', nama: 'Kota Tanjungbalai', level: 'kota' },
      { kode: '12.76', nama: 'Kota Tebing Tinggi', level: 'kota' },
      { kode: '12.77', nama: 'Kota Gunungsitoli', level: 'kota' },
      { kode: '12.78', nama: 'Kota Padang Sidempuan', level: 'kota' },
    ]);

    // SUMATERA BARAT (13)
    await insertKabKota(queryRunner, 'Sumatera Barat', '13', [
      { kode: '13.01', nama: 'Kabupaten Kepulauan Mentawai', level: 'kabupaten' },
      { kode: '13.02', nama: 'Kabupaten Pesisir Selatan', level: 'kabupaten' },
      { kode: '13.03', nama: 'Kabupaten Solok', level: 'kabupaten' },
      { kode: '13.04', nama: 'Kabupaten Sijunjung', level: 'kabupaten' },
      { kode: '13.05', nama: 'Kabupaten Tanah Datar', level: 'kabupaten' },
      { kode: '13.06', nama: 'Kabupaten Padang Pariaman', level: 'kabupaten' },
      { kode: '13.07', nama: 'Kabupaten Agam', level: 'kabupaten' },
      { kode: '13.08', nama: 'Kabupaten Lima Puluh Koto', level: 'kabupaten' },
      { kode: '13.09', nama: 'Kabupaten Pasaman', level: 'kabupaten' },
      { kode: '13.10', nama: 'Kabupaten Pasaman Barat', level: 'kabupaten' },
      { kode: '13.11', nama: 'Kabupaten Dharmasraya', level: 'kabupaten' },
      { kode: '13.12', nama: 'Kabupaten Solok Selatan', level: 'kabupaten' },
      { kode: '13.71', nama: 'Kota Padang', level: 'kota' },
      { kode: '13.72', nama: 'Kota Solok', level: 'kota' },
      { kode: '13.73', nama: 'Kota Sawahlunto', level: 'kota' },
      { kode: '13.74', nama: 'Kota Padang Panjang', level: 'kota' },
      { kode: '13.75', nama: 'Kota Bukittinggi', level: 'kota' },
      { kode: '13.76', nama: 'Kota Payakumbuh', level: 'kota' },
      { kode: '13.77', nama: 'Kota Pariaman', level: 'kota' },
    ]);

    // RIAU (14)
    await insertKabKota(queryRunner, 'Riau', '14', [
      { kode: '14.01', nama: 'Kabupaten Kuantan Singingi', level: 'kabupaten' },
      { kode: '14.02', nama: 'Kabupaten Indragiri Hulu', level: 'kabupaten' },
      { kode: '14.03', nama: 'Kabupaten Indragiri Hilir', level: 'kabupaten' },
      { kode: '14.04', nama: 'Kabupaten Pelalawan', level: 'kabupaten' },
      { kode: '14.05', nama: 'Kabupaten Siak', level: 'kabupaten' },
      { kode: '14.06', nama: 'Kabupaten Kampar', level: 'kabupaten' },
      { kode: '14.07', nama: 'Kabupaten Rokan Hulu', level: 'kabupaten' },
      { kode: '14.08', nama: 'Kabupaten Rokan Hilir', level: 'kabupaten' },
      { kode: '14.09', nama: 'Kabupaten Bengkalis', level: 'kabupaten' },
      { kode: '14.10', nama: 'Kabupaten Meranti', level: 'kabupaten' },
      { kode: '14.71', nama: 'Kota Pekanbaru', level: 'kota' },
      { kode: '14.72', nama: 'Kota Dumai', level: 'kota' },
    ]);

    // KEPULAUAN RIAU (21)
    await insertKabKota(queryRunner, 'Kepulauan Riau', '21', [
      { kode: '21.01', nama: 'Kabupaten Bintan', level: 'kabupaten' },
      { kode: '21.02', nama: 'Kabupaten Karimun', level: 'kabupaten' },
      { kode: '21.03', nama: 'Kabupaten Natuna', level: 'kabupaten' },
      { kode: '21.04', nama: 'Kabupaten Lingga', level: 'kabupaten' },
      { kode: '21.05', nama: 'Kabupaten Anambas', level: 'kabupaten' },
      { kode: '21.71', nama: 'Kota Batam', level: 'kota' },
      { kode: '21.72', nama: 'Kota Tanjungpinang', level: 'kota' },
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Delete all seeded data (rollback)
    await queryRunner.query(`DELETE FROM daerah WHERE level IN ('kabupaten', 'kota');`);
    await queryRunner.query(`DELETE FROM daerah WHERE level = 'provinsi';`);
  }
}
