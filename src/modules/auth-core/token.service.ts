import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { errors as joseErrors, jwtVerify, SignJWT } from 'jose';
import { User, UserRole } from '../users/entities/user.entity';
import { AccessTokenInvalidError } from './auth-errors';
import { KeyService } from './key.service';

export const ACCESS_TOKEN_ALG = 'RS256';

export interface AccessTokenClaims {
  /** users.id */
  sub: string;
  role: UserRole;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  jti: string;
}

export interface SignedAccessToken {
  token: string;
  /** Seconds until expiry (ACCESS_TOKEN_TTL_SECONDS). */
  expiresIn: number;
  expiresAt: Date;
  jti: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Signs and verifies our own RS256 access tokens (Phase 07).
 * Claims: sub (users.id), role, iss, aud, iat, exp, jti; header kid.
 * Every method throws LocalAuthDisabledError while local auth is disabled.
 */
@Injectable()
export class TokenService {
  constructor(private readonly keyService: KeyService) {}

  isEnabled(): boolean {
    return this.keyService.isEnabled();
  }

  async signAccessToken(
    user: Pick<User, 'id' | 'role'>,
    now: Date = new Date(),
  ): Promise<SignedAccessToken> {
    const keys = this.keyService.getKeys();
    const ttl = this.keyService.config.accessTokenTtlSeconds;
    const iat = Math.floor(now.getTime() / 1000);
    const exp = iat + ttl;
    const jti = randomUUID();
    const token = await new SignJWT({ role: user.role })
      .setProtectedHeader({
        alg: ACCESS_TOKEN_ALG,
        typ: 'JWT',
        kid: keys.keyId,
      })
      .setSubject(user.id)
      .setIssuer(keys.issuer)
      .setAudience(keys.audience)
      .setIssuedAt(iat)
      .setExpirationTime(exp)
      .setJti(jti)
      .sign(keys.privateKey);
    return { token, expiresIn: ttl, expiresAt: new Date(exp * 1000), jti };
  }

  /**
   * Verifies signature (RS256 only), kid, iss, aud and exp, and the shape of
   * the claims. Throws AccessTokenInvalidError for any invalid token (and
   * LocalAuthDisabledError when disabled).
   */
  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    const keys = this.keyService.getKeys();
    let payload: Record<string, unknown>;
    try {
      const result = await jwtVerify(
        token,
        (header) => {
          if (header.kid !== keys.keyId) {
            throw new AccessTokenInvalidError('unknown kid');
          }
          return keys.publicKey;
        },
        {
          algorithms: [ACCESS_TOKEN_ALG],
          issuer: keys.issuer,
          audience: keys.audience,
          requiredClaims: ['sub', 'iat', 'exp', 'jti'],
        },
      );
      payload = result.payload as Record<string, unknown>;
    } catch (error) {
      if (error instanceof AccessTokenInvalidError) {
        throw error;
      }
      if (error instanceof joseErrors.JWTExpired) {
        throw new AccessTokenInvalidError('expired');
      }
      if (error instanceof joseErrors.JOSEError) {
        throw new AccessTokenInvalidError(error.code);
      }
      throw new AccessTokenInvalidError('malformed');
    }

    const { sub, role, jti, iat, exp, iss, aud } = payload;
    if (typeof sub !== 'string' || !UUID_RE.test(sub)) {
      throw new AccessTokenInvalidError('bad sub');
    }
    if (
      typeof role !== 'string' ||
      !Object.values(UserRole).includes(role as UserRole)
    ) {
      throw new AccessTokenInvalidError('bad role');
    }
    return {
      sub,
      role: role as UserRole,
      iss: iss as string,
      aud: aud as string,
      iat: iat as number,
      exp: exp as number,
      jti: jti as string,
    };
  }
}
