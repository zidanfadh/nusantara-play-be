import { HttpException } from '@nestjs/common';
import { ThrottlerStorageService } from '@nestjs/throttler';
import {
  LOGIN_EMAIL_LIMIT,
  LoginEmailLimiter,
} from '../login-email-limiter.service';

describe('LoginEmailLimiter (Phase 08)', () => {
  let storage: ThrottlerStorageService;
  let limiter: LoginEmailLimiter;

  beforeEach(() => {
    storage = new ThrottlerStorageService();
    limiter = new LoginEmailLimiter(storage);
  });

  afterEach(() => storage.onApplicationShutdown());

  it('allows 10 attempts per email, then 429', async () => {
    for (let i = 0; i < LOGIN_EMAIL_LIMIT; i += 1) {
      await expect(limiter.consume('a@example.test')).resolves.toBeUndefined();
    }
    const blocked = limiter.consume('a@example.test');
    await expect(blocked).rejects.toBeInstanceOf(HttpException);
    await expect(blocked).rejects.toMatchObject({ status: 429 });
    // Another email is a separate bucket.
    await expect(limiter.consume('b@example.test')).resolves.toBeUndefined();
  });

  it('keys are a hash: no email in the storage key', () => {
    const key = LoginEmailLimiter.key('a@example.test');
    expect(key).toMatch(/^login-email:[0-9a-f]{64}$/);
    expect(key).not.toContain('example');
  });
});
