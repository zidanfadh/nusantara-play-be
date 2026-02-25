/**
 * Utility functions for Indonesian region codes (BPS format).
 *
 * Code structure (dot-separated):
 *   Level 1 — Provinsi:        XX          (2 chars)
 *   Level 2 — Kota/Kabupaten:  XX.XX       (5 chars)
 *   Level 3 — Kecamatan:       XX.XX.XX    (8 chars)
 *   Level 4 — Kelurahan/Desa:  XX.XX.XX.XXXX (13 chars)
 */

/**
 * Derive the parent region code from a given code.
 */
export function getParentCode(code: string): string {
  let parentCodeLength = 0;
  if (code.length === 5) parentCodeLength = 2;
  else if (code.length === 8) parentCodeLength = 5;
  else if (code.length === 13) parentCodeLength = 8;

  return code.substr(0, parentCodeLength);
}

/**
 * Get the hierarchy level (1-4) from a region code.
 *   1 = Provinsi, 2 = Kota/Kab, 3 = Kecamatan, 4 = Kelurahan/Desa
 */
export function getLevel(code: string): number {
  const len = code.length;
  if (len === 2) return 1;
  else if (len === 5) return 2;
  else if (len === 8) return 3;
  else if (len === 13) return 4;
  else return NaN;
}

/**
 * Determine the administrative prefix/variant for a region.
 * Examples: Provinsi, Kabupaten, Kota, Kecamatan, Distrik, Kapanewon,
 *           Kelurahan, Desa, Gampong, Nagari, Kampung, etc.
 */
export function getPrefix(code: string): string {
  const level = getLevel(code);
  const level1Code = code.substr(0, 2);

  if (level === 1) {
    return 'Provinsi';
  } else if (level === 2) {
    if (level1Code === '31') {
      // DKI Jakarta
      if (code === '31.01') {
        return 'Kabupaten Administrasi';
      } else {
        return 'Kota Administrasi';
      }
    } else {
      if (parseInt(code[3]) < 7) {
        return 'Kabupaten';
      } else {
        return 'Kota';
      }
    }
  } else if (level === 3) {
    if (level1Code === '91' || level1Code === '92') {
      // Papua & Papua Barat use Distrik instead of Kecamatan
      return 'Distrik';
    } else if (level1Code === '34') {
      // Yogyakarta uses Kapanewon & Kemantren
      if (code[3] === '7') {
        // Kota
        return 'Kemantren';
      } else {
        return 'Kapanewon';
      }
    }
    return 'Kecamatan';
  } else if (level === 4) {
    const level2Code = code.substr(0, 5);
    if (code[9] === '1') {
      return 'Kelurahan';
    } else {
      if (level1Code === '11') {
        // Aceh
        return 'Gampong';
      } else if (level1Code === '13') {
        // Sumatera Barat
        return 'Nagari';
      } else if (level1Code === '34') {
        // Yogyakarta
        return 'Kalurahan';
      } else if (level1Code === '81' || level1Code === '82') {
        // Maluku / Maluku Utara
        return 'Negeri';
      } else if (level1Code === '91' || level1Code === '92') {
        // Papua
        return 'Kampung';
      } else if (level2Code === '15.08') {
        // Kab. Bungo, Jambi
        return 'Dusun';
      } else if (level2Code === '18.12') {
        // Kab. Tulang Bawang Barat, Lampung
        return 'Tiyuh';
      } else if (
        ['64.03', '64.07', '64.11', '18.02', '18.05', '18.12', '18.11', '18.08'].includes(
          level2Code,
        )
      ) {
        return 'Kampung';
      } else if (['18.06', '18.10', '18.04', '18.13'].includes(level2Code)) {
        return 'Pekon';
      }

      return 'Desa';
    }
  }

  return '';
}

/**
 * Determine whether a level-4 code is kelurahan or desa.
 * kelurahan if digit at index 9 === '1', otherwise desa.
 */
export function isKelurahan(code: string): boolean {
  return code.length === 13 && code[9] === '1';
}

/**
 * Sanitize a region name — expand abbreviations, normalise spacing.
 */
export function sanitizeName(name: string, code: string): string {
  const level = getLevel(code);
  const level1Code = code.substr(0, 2);

  name = name.replace(/Kep\./gi, 'Kepulauan');
  name = name.replaceAll('"', "'");

  if (level === 4) {
    if (level1Code === '11') {
      // Aceh
      if (name.startsWith('Gampong')) {
        name = name.replace(/^Gampong /, '');
      }
      name = name.replace(/Kp(\.|\.? )/gi, 'Kampong ');
      name = name.replace(/Tgk(\.|\.? )/gi, 'Teungku ');
      name = name.replace(/Mns(\.|\.? )/gi, 'Meunasah ');
      name = name.replace(/^Meuna\./, 'Meunasah');
      name = name.replace(/^Mesj\./, 'Mesjid');
    } else if (level1Code === '12') {
      // Sumatera Utara
      name = name.replace('J.', 'Janji');
    } else if (level1Code === '16') {
      // Sumatera Selatan
      name = name.replace(/Lb\.? /, 'Lubuk ');
    }

    // Fix abbreviations / mal-abbreviations
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

export const provinceCodes = [
  '11',
  '12',
  '13',
  '16',
  '14',
  '15',
  '17',
  '18',
  '19',
  '21',
  '31',
  '32',
  '33',
  '34',
  '35',
  '36',
  '51',
  '52',
  '53',
  '61',
  '62',
  '63',
  '64',
  '65',
  '71',
  '72',
  '73',
  '74',
  '75',
  '76',
  '81',
  '82',
  '91',
  '92',
];
