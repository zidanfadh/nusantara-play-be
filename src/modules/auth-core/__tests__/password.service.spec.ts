import { hash as argon2Hash } from '@node-rs/argon2';
import bcrypt from 'bcryptjs';
import {
  argon2ParamsAreCurrent,
  checkPasswordPolicy,
  PasswordService,
} from '../password.service';

describe('PasswordService (Phase 07)', () => {
  const service = new PasswordService();

  it('hashes with Argon2id and the configured parameters', async () => {
    const hash = await service.hash('correct horse battery');
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(argon2ParamsAreCurrent(hash)).toBe(true);
  });

  it('verifies an Argon2id hash: right password ok, wrong password not', async () => {
    const hash = await service.hash('correct horse battery');
    await expect(
      service.verify(hash, 'argon2id', 'correct horse battery'),
    ).resolves.toEqual({ ok: true, needsRehash: false });
    await expect(
      service.verify(hash, 'argon2id', 'wrong password'),
    ).resolves.toEqual({ ok: false, needsRehash: false });
  });

  it('asks for a rehash when Argon2id parameters are outdated', async () => {
    const old = await argon2Hash('correct horse battery', {
      memoryCost: 8192,
      timeCost: 1,
      parallelism: 1,
    });
    await expect(
      service.verify(old, 'argon2id', 'correct horse battery'),
    ).resolves.toEqual({ ok: true, needsRehash: true });
  });

  it('verifies legacy bcrypt hashes ($2a$ like Supabase) and always asks for a rehash', async () => {
    const legacy = bcrypt
      .hashSync('legacy password', 4)
      .replace(/^\$2b\$/, '$2a$');
    expect(legacy.startsWith('$2a$')).toBe(true);
    await expect(
      service.verify(legacy, 'bcrypt', 'legacy password'),
    ).resolves.toEqual({ ok: true, needsRehash: true });
    await expect(
      service.verify(legacy, 'bcrypt', 'wrong password'),
    ).resolves.toEqual({ ok: false, needsRehash: false });
  });

  it('returns ok=false (no throw) for malformed hashes or mismatched algo', async () => {
    const argon = await service.hash('some password');
    await expect(
      service.verify('not-a-hash', 'argon2id', 'x'),
    ).resolves.toEqual({ ok: false, needsRehash: false });
    await expect(
      service.verify(argon, 'bcrypt', 'some password'),
    ).resolves.toEqual({ ok: false, needsRehash: false });
  });

  it('verifyDummy always resolves to false and does the Argon2 work', async () => {
    await expect(service.verifyDummy('anything')).resolves.toBe(false);
    await expect(service.verifyDummy('')).resolves.toBe(false);
  });
});

describe('checkPasswordPolicy (Phase 07)', () => {
  it('accepts 8 to 128 characters', () => {
    expect(checkPasswordPolicy('a'.repeat(8))).toEqual({ ok: true });
    expect(checkPasswordPolicy('a'.repeat(128))).toEqual({ ok: true });
  });

  it('rejects too short and too long passwords', () => {
    expect(checkPasswordPolicy('a'.repeat(7))).toEqual({
      ok: false,
      reason: 'too_short',
    });
    expect(checkPasswordPolicy('a'.repeat(129))).toEqual({
      ok: false,
      reason: 'too_long',
    });
  });

  it('counts characters, not UTF-16 units', () => {
    // 4 emoji = 8 UTF-16 code units but only 4 characters.
    expect(checkPasswordPolicy('😀😀😀😀')).toEqual({
      ok: false,
      reason: 'too_short',
    });
  });

  it('rejects the email as password, case-insensitive', () => {
    expect(
      checkPasswordPolicy('User@Example.test', 'user@example.TEST'),
    ).toEqual({ ok: false, reason: 'equals_email' });
    expect(checkPasswordPolicy('another-pass', 'user@example.test')).toEqual({
      ok: true,
    });
  });
});
