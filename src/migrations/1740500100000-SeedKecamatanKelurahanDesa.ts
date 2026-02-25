import { MigrationInterface, QueryRunner } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

/* ------------------------------------------------------------------ */
/*  Helper functions — derived from the user-provided region-code lib  */
/* ------------------------------------------------------------------ */

function getParentCode(code: string): string {
  let parentCodeLength = 0;
  if (code.length === 5) parentCodeLength = 2;
  else if (code.length === 8) parentCodeLength = 5;
  else if (code.length === 13) parentCodeLength = 8;
  return code.substr(0, parentCodeLength);
}

function getLevel(code: string): number {
  const len = code.length;
  if (len === 2) return 1;
  else if (len === 5) return 2;
  else if (len === 8) return 3;
  else if (len === 13) return 4;
  else return NaN;
}

function getPrefix(code: string): string {
  const level = getLevel(code);
  const level1Code = code.substr(0, 2);

  if (level === 1) {
    return 'Provinsi';
  } else if (level === 2) {
    if (level1Code === '31') {
      if (code === '31.01') return 'Kabupaten Administrasi';
      else return 'Kota Administrasi';
    } else {
      if (parseInt(code[3]) < 7) return 'Kabupaten';
      else return 'Kota';
    }
  } else if (level === 3) {
    if (level1Code === '91' || level1Code === '92') return 'Distrik';
    else if (level1Code === '34') {
      if (code[3] === '7') return 'Kemantren';
      else return 'Kapanewon';
    }
    return 'Kecamatan';
  } else if (level === 4) {
    const level2Code = code.substr(0, 5);
    if (code[9] === '1') return 'Kelurahan';

    if (level1Code === '11') return 'Gampong';
    else if (level1Code === '13') return 'Nagari';
    else if (level1Code === '34') return 'Kalurahan';
    else if (level1Code === '81' || level1Code === '82') return 'Negeri';
    else if (level1Code === '91' || level1Code === '92') return 'Kampung';
    else if (level2Code === '15.08') return 'Dusun';
    else if (level2Code === '18.12') return 'Tiyuh';
    else if (
      ['64.03', '64.07', '64.11', '18.02', '18.05', '18.12', '18.11', '18.08'].includes(
        level2Code,
      )
    )
      return 'Kampung';
    else if (['18.06', '18.10', '18.04', '18.13'].includes(level2Code)) return 'Pekon';

    return 'Desa';
  }
  return '';
}

function sanitizeName(name: string, code: string): string {
  const level = getLevel(code);
  const level1Code = code.substr(0, 2);

  name = name.replace(/Kep\./gi, 'Kepulauan');
  name = name.replaceAll('"', "'");

  if (level === 4) {
    if (level1Code === '11') {
      if (name.startsWith('Gampong')) name = name.replace(/^Gampong /, '');
      name = name.replace(/Kp(\.|\.? )/gi, 'Kampong ');
      name = name.replace(/Tgk(\.|\.? )/gi, 'Teungku ');
      name = name.replace(/Mns(\.|\.? )/gi, 'Meunasah ');
      name = name.replace(/^Meuna\./, 'Meunasah');
      name = name.replace(/^Mesj\./, 'Mesjid');
    } else if (level1Code === '12') {
      name = name.replace('J.', 'Janji');
    } else if (level1Code === '16') {
      name = name.replace(/Lb\.? /, 'Lubuk ');
    }

    name = name.replace('Sei.', 'Sei');
    name = name.replace(/^Perk\./, 'Perkebunan');
    name = name.replace(/Tj\.? /, 'Tanjung ');
    name = name.replace(/ D\.? /, ' D-');
  }

  name = name.replace(/^Gn\.? /, 'Gunung ');
  name = name.replace(/\s+/g, ' ');
  name = name.replace(/ *\/ */g, '/');

  return name.trim();
}

/* ------------------------------------------------------------------ */
/*  CSV row interface                                                   */
/* ------------------------------------------------------------------ */

interface CsvRow {
  kode: string;
  nama: string;
  jumlah: string;
  jenis: string;
  parent: string;
  provinsi: string;
}

/* ------------------------------------------------------------------ */
/*  Escape a string for use inside a SQL literal (single-quote safe)   */
/* ------------------------------------------------------------------ */

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

/* ------------------------------------------------------------------ */
/*  Migration                                                           */
/* ------------------------------------------------------------------ */

export class SeedKecamatanKelurahanDesa1740500100000 implements MigrationInterface {
  name = 'SeedKecamatanKelurahanDesa1740500100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Read & parse CSV ──────────────────────────────────────────
    const csvPath = path.resolve(__dirname, '../../docs/kecamatan_kelurahan_desa.csv');
    if (!fs.existsSync(csvPath)) {
      throw new Error(
        `CSV file not found at ${csvPath}. ` +
          `Make sure docs/kecamatan_kelurahan_desa.csv exists in the project root.`,
      );
    }

    const raw = fs.readFileSync(csvPath, 'utf-8');
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);
    const header = lines[0].split(',');
    const rows: CsvRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      rows.push({
        kode: (cols[0] || '').trim(),
        nama: (cols[1] || '').trim(),
        jumlah: (cols[2] || '').trim(),
        jenis: (cols[3] || '').trim(),
        parent: (cols[4] || '').trim(),
        provinsi: (cols[5] || '').trim(),
      });
    }

    console.log(`[SeedKecamatanKelurahanDesa] CSV loaded: ${rows.length} rows`);

    // Separate kecamatan (level 3) and kelurahan/desa (level 4)
    const kecamatanRows = rows.filter(
      (r) => r.jenis === 'Kecamatan' && getLevel(r.kode) === 3,
    );
    const kelDesaRows = rows.filter(
      (r) => r.jenis === 'Kelurahan/Desa' && getLevel(r.kode) === 4,
    );

    console.log(
      `[SeedKecamatanKelurahanDesa] Kecamatan: ${kecamatanRows.length}, Kelurahan/Desa: ${kelDesaRows.length}`,
    );

    // ── 2. Build kode→id map from existing data ─────────────────────
    const existingRows: { id: string; kode: string }[] = await queryRunner.query(
      `SELECT id, kode FROM daerah`,
    );
    const kodeToId = new Map<string, string>();
    for (const row of existingRows) {
      kodeToId.set(row.kode, row.id);
    }
    console.log(
      `[SeedKecamatanKelurahanDesa] Existing daerah in DB: ${kodeToId.size}`,
    );

    // ── 3. Insert kecamatan (batch 500) ──────────────────────────────
    const BATCH_SIZE = 500;
    let insertedKec = 0;
    let skippedKec = 0;

    for (let i = 0; i < kecamatanRows.length; i += BATCH_SIZE) {
      const batch = kecamatanRows.slice(i, i + BATCH_SIZE);
      const values: string[] = [];

      for (const row of batch) {
        if (kodeToId.has(row.kode)) {
          skippedKec++;
          continue;
        }

        const parentKode = getParentCode(row.kode);
        const parentId = kodeToId.get(parentKode);
        if (!parentId) {
          console.warn(
            `[SeedKecamatanKelurahanDesa] WARN: parent ${parentKode} not found for kecamatan ${row.kode} (${row.nama}), skipping`,
          );
          skippedKec++;
          continue;
        }

        const nama = esc(sanitizeName(row.nama, row.kode));
        const prefix = esc(getPrefix(row.kode));
        const provinsi = esc(row.provinsi);

        values.push(
          `(gen_random_uuid(), '${esc(row.kode)}', '${nama}', '${provinsi}', 'kecamatan', '${parentId}', '${prefix}')`,
        );
      }

      if (values.length > 0) {
        await queryRunner.query(
          `INSERT INTO daerah (id, kode, nama, provinsi, level, parent_id, prefix) VALUES\n${values.join(',\n')};`,
        );
        insertedKec += values.length;
      }
    }

    console.log(
      `[SeedKecamatanKelurahanDesa] Kecamatan inserted: ${insertedKec}, skipped: ${skippedKec}`,
    );

    // ── 4. Refresh kode→id map (include new kecamatan) ──────────────
    const kecRows: { id: string; kode: string }[] = await queryRunner.query(
      `SELECT id, kode FROM daerah WHERE level = 'kecamatan'`,
    );
    for (const r of kecRows) {
      kodeToId.set(r.kode, r.id);
    }

    // ── 5. Insert kelurahan / desa (batch 500) ───────────────────────
    let insertedKelDes = 0;
    let skippedKelDes = 0;

    for (let i = 0; i < kelDesaRows.length; i += BATCH_SIZE) {
      const batch = kelDesaRows.slice(i, i + BATCH_SIZE);
      const values: string[] = [];

      for (const row of batch) {
        if (kodeToId.has(row.kode)) {
          skippedKelDes++;
          continue;
        }

        const parentKode = getParentCode(row.kode);
        const parentId = kodeToId.get(parentKode);
        if (!parentId) {
          console.warn(
            `[SeedKecamatanKelurahanDesa] WARN: parent ${parentKode} not found for kel/desa ${row.kode} (${row.nama}), skipping`,
          );
          skippedKelDes++;
          continue;
        }

        const nama = esc(sanitizeName(row.nama, row.kode));
        const prefix = esc(getPrefix(row.kode));
        const provinsi = esc(row.provinsi);

        // Determine level: kelurahan if digit at index 9 is '1', else desa
        const daerahLevel = row.kode[9] === '1' ? 'kelurahan' : 'desa';

        values.push(
          `(gen_random_uuid(), '${esc(row.kode)}', '${nama}', '${provinsi}', '${daerahLevel}', '${parentId}', '${prefix}')`,
        );
      }

      if (values.length > 0) {
        await queryRunner.query(
          `INSERT INTO daerah (id, kode, nama, provinsi, level, parent_id, prefix) VALUES\n${values.join(',\n')};`,
        );
        insertedKelDes += values.length;
      }

      // Progress log every 5000 rows
      if ((i + BATCH_SIZE) % 5000 < BATCH_SIZE) {
        console.log(
          `[SeedKecamatanKelurahanDesa] Kel/Desa progress: ${Math.min(i + BATCH_SIZE, kelDesaRows.length)}/${kelDesaRows.length}`,
        );
      }
    }

    console.log(
      `[SeedKecamatanKelurahanDesa] Kelurahan/Desa inserted: ${insertedKelDes}, skipped: ${skippedKelDes}`,
    );

    // ── Summary ──────────────────────────────────────────────────────
    const totalInserted = insertedKec + insertedKelDes;
    const totalSkipped = skippedKec + skippedKelDes;
    console.log(
      `[SeedKecamatanKelurahanDesa] DONE — Total inserted: ${totalInserted}, skipped: ${totalSkipped}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove all kecamatan, kelurahan, and desa records
    await queryRunner.query(
      `DELETE FROM daerah WHERE level IN ('kecamatan', 'kelurahan', 'desa');`,
    );
    console.log(
      '[SeedKecamatanKelurahanDesa] Rolled back — all kecamatan/kelurahan/desa deleted.',
    );
  }
}
