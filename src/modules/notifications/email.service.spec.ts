/**
 * Phase 06, P2: a failed credential email is logged without the recipient
 * address or the password (SMTP error messages often quote the address).
 */
import { BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

describe('EmailService logging (P2)', () => {
  it('logs a send failure without the address or password', async () => {
    const config = {
      get: (key: string) =>
        ({ SMTP_HOST: 'smtp.example.test', SMTP_FROM: 'noreply@example.test' })[
          key
        ],
    } as unknown as ConfigService;
    const service = new EmailService(config);
    const smtpError = Object.assign(
      new Error(
        "Can't send mail - all recipients were rejected: 550 5.1.1 <someone@example.test>: Recipient address rejected",
      ),
      { code: 'EENVELOPE', responseCode: 550 },
    );
    (service as unknown as { transporter: unknown }).transporter = {
      sendMail: jest.fn().mockRejectedValue(smtpError),
    };
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    try {
      await expect(
        service.sendAdminCreatedUserCredentials({
          to: 'someone@example.test',
          email: 'someone@example.test',
          fullName: 'Some One',
          password: 'Sup3rSecret!',
        }),
      ).rejects.toThrow(BadRequestException);

      const logged = JSON.stringify(errorSpy.mock.calls);
      expect(logged).toContain('EENVELOPE');
      expect(logged).toContain('550');
      expect(logged).not.toContain('someone@example.test');
      expect(logged).not.toContain('Sup3rSecret!');
    } finally {
      errorSpy.mockRestore();
    }
  });
});
