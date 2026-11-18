/**
 * Phase 09: Indonesian auth email templates and EmailService.sendTransactional
 * (never throws, logs only error name and codes).
 */
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  accountExistsEmail,
  escapeHtml,
  formatDuration,
  passwordChangedEmail,
  passwordResetEmail,
  verificationEmail,
} from './auth-email.templates';
import { EmailService } from './email.service';

const LINK = 'https://app.example.test/verify-email?token=abc_DEF-123';

describe('auth email templates', () => {
  it('formatDuration: whole hours in "jam", otherwise "menit"', () => {
    expect(formatDuration(1440)).toBe('24 jam');
    expect(formatDuration(60)).toBe('1 jam');
    expect(formatDuration(30)).toBe('30 menit');
  });

  it('verification: Indonesian subject, link and lifetime in text and HTML', () => {
    const mail = verificationEmail({
      fullName: 'Ani',
      link: LINK,
      ttlMinutes: 1440,
    });
    expect(mail.subject).toBe('Verifikasi email akun Nusantara Play Anda');
    expect(mail.text).toContain('Halo Ani,');
    expect(mail.text).toContain(LINK);
    expect(mail.text).toContain('24 jam');
    expect(mail.html).toContain(`href="${LINK}"`);
    expect(mail.html).toContain('<html lang="id">');
  });

  it('account exists: explains sign-in and "Lupa password"; works without a login URL', () => {
    const withUrl = accountExistsEmail({
      fullName: null,
      loginUrl: 'https://app.example.test/login',
    });
    expect(withUrl.subject).toBe('Akun Nusantara Play Anda sudah ada');
    expect(withUrl.text).toContain('Halo,');
    expect(withUrl.text).toContain('https://app.example.test/login');
    expect(withUrl.text).toContain('Lupa password');
    const without = accountExistsEmail({ fullName: 'Ani', loginUrl: null });
    expect(without.text).not.toContain('http');
    expect(without.html).not.toContain('href=');
  });

  it('password reset: link and 1 hour lifetime', () => {
    const mail = passwordResetEmail({
      fullName: 'Ani',
      link: LINK,
      ttlMinutes: 60,
    });
    expect(mail.subject).toBe('Atur ulang password Nusantara Play');
    expect(mail.text).toContain(LINK);
    expect(mail.text).toContain('1 jam');
    expect(mail.html).toContain('Atur ulang password');
  });

  it('password changed: tells the user what to do if it was not them', () => {
    const mail = passwordChangedEmail({ fullName: 'Ani' });
    expect(mail.subject).toBe('Password Nusantara Play Anda telah diubah');
    expect(mail.text).toContain('Lupa password');
  });

  it('escapes the name in the HTML version', () => {
    const mail = passwordChangedEmail({ fullName: '<script>x</script>' });
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(escapeHtml(`a&"'`)).toBe('a&amp;&quot;&#039;');
  });
});

describe('EmailService.sendTransactional (Phase 09)', () => {
  const message = {
    kind: 'password_reset' as const,
    to: 'someone@example.test',
    subject: 's',
    text: `t ${LINK}`,
    html: 'h',
  };
  const configFor = (env: Record<string, string>) =>
    ({ get: (key: string) => env[key] }) as unknown as ConfigService;

  afterEach(() => jest.restoreAllMocks());

  it('sends with SMTP_FROM and returns true', async () => {
    const service = new EmailService(
      configFor({ SMTP_HOST: '127.0.0.1', SMTP_FROM: 'no-reply@example.test' }),
    );
    const sendMail = jest.fn().mockResolvedValue({});
    (service as unknown as { transporter: unknown }).transporter = {
      sendMail,
    };
    await expect(service.sendTransactional(message)).resolves.toBe(true);
    expect(sendMail).toHaveBeenCalledWith({
      from: 'no-reply@example.test',
      to: message.to,
      subject: 's',
      text: message.text,
      html: 'h',
    });
  });

  it('not configured: false and a warning, no throw', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    const service = new EmailService(configFor({}));
    await expect(service.sendTransactional(message)).resolves.toBe(false);
    expect(warn).toHaveBeenCalledWith(
      'Transactional email not sent: SMTP_HOST or SMTP_FROM is not set',
    );
  });

  it('SMTP failure: false; logs name and codes only (no address, no link)', async () => {
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    const service = new EmailService(
      configFor({ SMTP_HOST: '127.0.0.1', SMTP_FROM: 'no-reply@example.test' }),
    );
    (service as unknown as { transporter: unknown }).transporter = {
      sendMail: jest.fn().mockRejectedValue(
        Object.assign(new Error(`550 <someone@example.test> ${LINK}`), {
          code: 'EENVELOPE',
          responseCode: 550,
        }),
      ),
    };
    await expect(service.sendTransactional(message)).resolves.toBe(false);
    const logged = JSON.stringify(error.mock.calls);
    expect(logged).toContain('password_reset');
    expect(logged).toContain('EENVELOPE');
    expect(logged).toContain('550');
    expect(logged).not.toContain('someone@example.test');
    expect(logged).not.toContain('token=');
  });
});
