/**
 * Phase 06, P2: the audit log never stores passwords, tokens or secrets.
 */
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';
import { REDACTED, redactSecrets } from './redact';

function contextFor(body: unknown, url = '/api/auth/change-password') {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: { id: 'user-1' },
        method: 'POST',
        url,
        ip: '127.0.0.1',
        body,
        get: () => 'jest',
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('AuditInterceptor (P2)', () => {
  it('stores change-password requests without the passwords', async () => {
    const log = jest.fn();
    const interceptor = new AuditInterceptor({
      log,
    } as unknown as AuditService);
    const next: CallHandler = { handle: () => of({ message: 'ok' }) };

    await lastValueFrom(
      interceptor.intercept(
        contextFor({
          currentPassword: 'OldPassw0rd',
          newPassword: 'NewPassw0rd',
          confirmPassword: 'NewPassw0rd',
        }),
        next,
      ),
    );

    expect(log).toHaveBeenCalledTimes(1);
    const [[entry]] = log.mock.calls as [[Record<string, unknown>]];
    const stored = JSON.stringify(entry);
    expect(stored).not.toContain('OldPassw0rd');
    expect(stored).not.toContain('NewPassw0rd');
    expect(entry).toMatchObject({
      user_id: 'user-1',
      changes: {
        currentPassword: REDACTED,
        newPassword: REDACTED,
        confirmPassword: REDACTED,
      },
    });
  });
});

describe('redactSecrets', () => {
  it('redacts secret-looking keys at any depth and keeps the rest', () => {
    expect(
      redactSecrets({
        nama: 'Gasing',
        password: 'x',
        nested: { refresh_token: 'y', apiKey: 'z', items: [{ secret: 's' }] },
      }),
    ).toEqual({
      nama: 'Gasing',
      password: REDACTED,
      nested: {
        refresh_token: REDACTED,
        apiKey: REDACTED,
        items: [{ secret: REDACTED }],
      },
    });
  });

  it('passes non-objects through', () => {
    expect(redactSecrets(undefined)).toBeUndefined();
    expect(redactSecrets('text')).toBe('text');
  });
});
