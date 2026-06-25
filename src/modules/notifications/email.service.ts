import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

interface CredentialEmailPayload {
  to: string;
  fullName: string;
  email: string;
  password: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter?: Transporter;

  constructor(private readonly configService: ConfigService) {}

  isCredentialEmailEnabled(): boolean {
    return (
      this.configService.get<string>('USER_CREDENTIAL_EMAIL_ENABLED') === 'true'
    );
  }

  assertConfigured(): void {
    if (!this.getHost() || !this.getFrom()) {
      throw new BadRequestException(
        'Email notification is not configured. Set USER_CREDENTIAL_EMAIL_ENABLED=true, SMTP_HOST, and SMTP_FROM before using send_email.',
      );
    }
  }

  async sendAdminCreatedUserCredentials(
    payload: CredentialEmailPayload,
  ): Promise<void> {
    this.assertConfigured();

    try {
      await this.getTransporter().sendMail({
        from: this.getFrom(),
        to: payload.to,
        subject: 'Akun Nusantara Play Anda telah dibuat',
        text: this.buildText(payload),
        html: this.buildHtml(payload),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown email error';
      this.logger.error(`Failed to send credential email: ${message}`);
      throw new BadRequestException('Failed to send credential email');
    }
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const auth = user && pass ? { user, pass } : undefined;

    this.transporter = nodemailer.createTransport({
      host: this.getHost(),
      port: Number(this.configService.get<string>('SMTP_PORT') || 587),
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
      auth,
    });

    return this.transporter;
  }

  private getHost(): string | undefined {
    return this.configService.get<string>('SMTP_HOST');
  }

  private getFrom(): string | undefined {
    return (
      this.configService.get<string>('SMTP_FROM') ||
      this.configService.get<string>('SMTP_USER')
    );
  }

  private buildText(payload: CredentialEmailPayload): string {
    return [
      `Halo ${payload.fullName},`,
      '',
      'Akun Nusantara Play Anda telah dibuat oleh admin.',
      '',
      `Email: ${payload.email}`,
      `Password: ${payload.password}`,
      '',
      'Silakan login dan ganti password setelah masuk.',
    ].join('\n');
  }

  private buildHtml(payload: CredentialEmailPayload): string {
    return `
      <p>Halo ${this.escapeHtml(payload.fullName)},</p>
      <p>Akun Nusantara Play Anda telah dibuat oleh admin.</p>
      <p>
        Email: <strong>${this.escapeHtml(payload.email)}</strong><br />
        Password: <strong>${this.escapeHtml(payload.password)}</strong>
      </p>
      <p>Silakan login dan ganti password setelah masuk.</p>
    `;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
