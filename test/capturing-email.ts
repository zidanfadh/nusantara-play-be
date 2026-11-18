/**
 * Test double of EmailService (Phase 09): records every transactional email
 * in memory instead of sending it. Integration and e2e tests never depend on
 * Mailpit or any SMTP server.
 */
import type { TransactionalEmail } from '../src/modules/notifications/email.service';

export class CapturingEmailService {
  readonly sent: TransactionalEmail[] = [];

  sendTransactional(message: TransactionalEmail): Promise<boolean> {
    this.sent.push(message);
    return Promise.resolve(true);
  }

  /** Admin-created-user credential emails stay disabled in tests. */
  isCredentialEmailEnabled(): boolean {
    return false;
  }

  assertConfigured(): void {}

  sendAdminCreatedUserCredentials(): Promise<void> {
    return Promise.resolve();
  }

  /** Emails sent to one address (case-insensitive), oldest first. */
  to(address: string): TransactionalEmail[] {
    const wanted = address.trim().toLowerCase();
    return this.sent.filter((m) => m.to.toLowerCase() === wanted);
  }

  /** The raw token from the last link of that kind sent to the address. */
  tokenFor(
    address: string,
    kind: 'verification' | 'password_reset',
  ): string | null {
    const mails = this.to(address).filter((m) => m.kind === kind);
    const last = mails[mails.length - 1];
    const match = last ? /[?&]token=([A-Za-z0-9_-]+)/.exec(last.text) : null;
    return match ? decodeURIComponent(match[1]) : null;
  }
}
