import { Injectable } from '@nestjs/common';
import {
  hash as argon2Hash,
  verify as argon2Verify,
  type Algorithm,
  type Options as Argon2Options,
} from '@node-rs/argon2';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import type { PasswordAlgo } from './entities/user-credential.entity';

/** Algorithm.Argon2id (an ambient const enum, so not importable as a value). */
const ARGON2ID = 2 as Algorithm;

/** Argon2id parameters (OWASP minimum): 19 MiB, 2 passes, 1 lane. */
export const ARGON2_OPTIONS: Readonly<Argon2Options> = {
  algorithm: ARGON2ID,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export interface PasswordVerifyResult {
  ok: boolean;
  /** True when the password is correct but the stored hash should be
   * replaced by a fresh Argon2id hash (legacy bcrypt or old parameters). */
  needsRehash: boolean;
}

export type PasswordPolicyResult =
  | { ok: true }
  | { ok: false; reason: 'too_short' | 'too_long' | 'equals_email' };

/**
 * Password policy: 8 to 128 characters (Unicode code points) and not equal
 * to the email (case-insensitive, surrounding whitespace ignored).
 */
export function checkPasswordPolicy(
  password: string,
  email?: string | null,
): PasswordPolicyResult {
  const length = [...password].length;
  if (length < PASSWORD_MIN_LENGTH) {
    return { ok: false, reason: 'too_short' };
  }
  if (length > PASSWORD_MAX_LENGTH) {
    return { ok: false, reason: 'too_long' };
  }
  if (email && password.trim().toLowerCase() === email.trim().toLowerCase()) {
    return { ok: false, reason: 'equals_email' };
  }
  return { ok: true };
}

/** True when an Argon2 PHC string is argon2id with exactly ARGON2_OPTIONS. */
export function argon2ParamsAreCurrent(phc: string): boolean {
  // $argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>
  const match = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(phc);
  return (
    !!match &&
    Number(match[1]) === ARGON2_OPTIONS.memoryCost &&
    Number(match[2]) === ARGON2_OPTIONS.timeCost &&
    Number(match[3]) === ARGON2_OPTIONS.parallelism
  );
}

@Injectable()
export class PasswordService {
  private dummyHash?: Promise<string>;

  /** Argon2id hash (PHC string) of a password. */
  hash(password: string): Promise<string> {
    return argon2Hash(password, ARGON2_OPTIONS);
  }

  /**
   * Verifies a password against a stored hash. Never throws for a wrong
   * password or a malformed hash; returns ok=false instead.
   * - argon2id: needsRehash when the parameters differ from ARGON2_OPTIONS.
   * - bcrypt (legacy Supabase hashes): always needsRehash on success, so the
   *   login flow (Phase 08) replaces it with Argon2id.
   */
  async verify(
    storedHash: string,
    algo: PasswordAlgo,
    password: string,
  ): Promise<PasswordVerifyResult> {
    try {
      if (algo === 'argon2id') {
        const ok = await argon2Verify(storedHash, password);
        return { ok, needsRehash: ok && !argon2ParamsAreCurrent(storedHash) };
      }
      if (algo === 'bcrypt') {
        const ok = await bcrypt.compare(password, storedHash);
        return { ok, needsRehash: ok };
      }
    } catch {
      // Malformed hash: treated like a wrong password.
    }
    return { ok: false, needsRehash: false };
  }

  /**
   * For unknown emails: one Argon2id verification against a fixed dummy
   * hash (created once per process), so the response time does not reveal
   * whether an account exists. Always resolves to false.
   */
  async verifyDummy(password: string): Promise<false> {
    this.dummyHash ??= this.hash(randomBytes(32).toString('base64url'));
    try {
      await argon2Verify(await this.dummyHash, password);
    } catch {
      // ignore
    }
    return false;
  }
}
