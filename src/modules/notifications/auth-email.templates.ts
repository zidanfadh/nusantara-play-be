/**
 * Indonesian auth emails (Phase 09), each with a plain-text and a simple HTML
 * version. Pure functions: no I/O, no logging. Every dynamic value in the
 * HTML is escaped.
 */

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

const APP = 'Nusantara Play';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function greeting(fullName?: string | null): string {
  const name = fullName?.trim();
  return name ? `Halo ${name},` : 'Halo,';
}

/** "24 jam", "1 jam", "30 menit". */
export function formatDuration(minutes: number): string {
  if (minutes % 60 === 0) {
    return `${minutes / 60} jam`;
  }
  return `${minutes} menit`;
}

function layout(paragraphs: string[]): string {
  return [
    '<!doctype html>',
    '<html lang="id"><body style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#1f2937;">',
    ...paragraphs.map((p) => `<p>${p}</p>`),
    `<p style="color:#6b7280;font-size:12px;">Email ini dikirim otomatis oleh ${APP}. Mohon tidak membalas email ini.</p>`,
    '</body></html>',
  ].join('\n');
}

function button(url: string, label: string): string {
  const href = escapeHtml(url);
  return `<a href="${href}" style="display:inline-block;padding:10px 18px;background:#b45309;color:#ffffff;text-decoration:none;border-radius:6px;">${escapeHtml(label)}</a><br /><span style="font-size:12px;color:#6b7280;">Jika tombol tidak berfungsi, salin tautan ini ke browser Anda:<br />${href}</span>`;
}

const FOOTER_TEXT = `Email ini dikirim otomatis oleh ${APP}. Mohon tidak membalas email ini.`;

export function verificationEmail(input: {
  fullName?: string | null;
  link: string;
  ttlMinutes: number;
}): EmailContent {
  const ttl = formatDuration(input.ttlMinutes);
  return {
    subject: `Verifikasi email akun ${APP} Anda`,
    text: [
      greeting(input.fullName),
      '',
      `Terima kasih telah mendaftar di ${APP}. Silakan verifikasi alamat email Anda dengan membuka tautan berikut:`,
      '',
      input.link,
      '',
      `Tautan ini berlaku selama ${ttl} dan hanya dapat digunakan satu kali.`,
      'Jika Anda tidak merasa mendaftar, abaikan email ini.',
      '',
      FOOTER_TEXT,
    ].join('\n'),
    html: layout([
      escapeHtml(greeting(input.fullName)),
      `Terima kasih telah mendaftar di ${APP}. Silakan verifikasi alamat email Anda:`,
      button(input.link, 'Verifikasi email'),
      `Tautan ini berlaku selama ${escapeHtml(ttl)} dan hanya dapat digunakan satu kali.`,
      'Jika Anda tidak merasa mendaftar, abaikan email ini.',
    ]),
  };
}

export function accountExistsEmail(input: {
  fullName?: string | null;
  loginUrl: string | null;
}): EmailContent {
  const where = input.loginUrl
    ? `di halaman masuk (${input.loginUrl})`
    : 'di halaman masuk';
  return {
    subject: `Akun ${APP} Anda sudah ada`,
    text: [
      greeting(input.fullName),
      '',
      `Seseorang (mungkin Anda) mencoba mendaftar di ${APP} dengan alamat email ini. Akun Anda sudah ada, jadi tidak ada akun baru yang dibuat dan akun Anda tidak diubah.`,
      '',
      `Silakan masuk ${where} dengan email dan password Anda.`,
      'Lupa password? Pilih "Lupa password" di halaman masuk untuk menerima tautan atur ulang password.',
      '',
      'Jika Anda tidak mencoba mendaftar, abaikan email ini. Akun Anda tetap aman.',
      '',
      FOOTER_TEXT,
    ].join('\n'),
    html: layout([
      escapeHtml(greeting(input.fullName)),
      `Seseorang (mungkin Anda) mencoba mendaftar di ${APP} dengan alamat email ini. Akun Anda <strong>sudah ada</strong>, jadi tidak ada akun baru yang dibuat dan akun Anda tidak diubah.`,
      input.loginUrl
        ? `Silakan masuk dengan email dan password Anda:<br />${button(input.loginUrl, 'Masuk')}`
        : 'Silakan masuk di halaman masuk dengan email dan password Anda.',
      'Lupa password? Pilih <strong>"Lupa password"</strong> di halaman masuk untuk menerima tautan atur ulang password.',
      'Jika Anda tidak mencoba mendaftar, abaikan email ini. Akun Anda tetap aman.',
    ]),
  };
}

export function passwordResetEmail(input: {
  fullName?: string | null;
  link: string;
  ttlMinutes: number;
}): EmailContent {
  const ttl = formatDuration(input.ttlMinutes);
  return {
    subject: `Atur ulang password ${APP}`,
    text: [
      greeting(input.fullName),
      '',
      `Kami menerima permintaan untuk mengatur ulang password akun ${APP} Anda. Buka tautan berikut untuk membuat password baru:`,
      '',
      input.link,
      '',
      `Tautan ini berlaku selama ${ttl} dan hanya dapat digunakan satu kali.`,
      'Jika Anda tidak meminta atur ulang password, abaikan email ini. Password Anda tidak berubah.',
      '',
      FOOTER_TEXT,
    ].join('\n'),
    html: layout([
      escapeHtml(greeting(input.fullName)),
      `Kami menerima permintaan untuk mengatur ulang password akun ${APP} Anda.`,
      button(input.link, 'Atur ulang password'),
      `Tautan ini berlaku selama ${escapeHtml(ttl)} dan hanya dapat digunakan satu kali.`,
      'Jika Anda tidak meminta atur ulang password, abaikan email ini. Password Anda tidak berubah.',
    ]),
  };
}

export function passwordChangedEmail(input: {
  fullName?: string | null;
}): EmailContent {
  return {
    subject: `Password ${APP} Anda telah diubah`,
    text: [
      greeting(input.fullName),
      '',
      `Password akun ${APP} Anda baru saja diubah. Demi keamanan, sesi di perangkat lain telah dikeluarkan.`,
      '',
      'Jika Anda yang melakukannya, tidak ada yang perlu dilakukan.',
      'Jika BUKAN Anda, segera atur ulang password melalui "Lupa password" di halaman masuk dan hubungi admin.',
      '',
      FOOTER_TEXT,
    ].join('\n'),
    html: layout([
      escapeHtml(greeting(input.fullName)),
      `Password akun ${APP} Anda baru saja diubah. Demi keamanan, sesi di perangkat lain telah dikeluarkan.`,
      'Jika Anda yang melakukannya, tidak ada yang perlu dilakukan.',
      'Jika <strong>bukan</strong> Anda, segera atur ulang password melalui "Lupa password" di halaman masuk dan hubungi admin.',
    ]),
  };
}
