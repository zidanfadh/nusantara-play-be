import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPrivateKey,
  createPublicKey,
  KeyObject,
  sign,
  verify,
} from 'node:crypto';
import { exportJWK, type JWK } from 'jose';
import {
  AuthConfig,
  AuthKeyConfig,
  readAuthConfig,
} from '../../config/auth.config';
import { LocalAuthDisabledError } from './auth-errors';

export interface LoadedKeys {
  privateKey: KeyObject;
  publicKey: KeyObject;
  keyId: string;
  issuer: string;
  audience: string;
}

export interface Jwks {
  keys: (JWK & { kid: string; alg: 'RS256'; use: 'sig' })[];
}

/**
 * Loads the RS256 key pair and the iss/aud/kid settings ONCE at startup
 * (Phase 07). When a JWT_* variable is missing or the keys are invalid,
 * local auth is disabled: one warning is logged, the app still boots, and
 * every method that needs keys throws LocalAuthDisabledError.
 * Never logs key material, only variable names.
 */
@Injectable()
export class KeyService {
  private readonly logger = new Logger(KeyService.name);
  readonly config: AuthConfig;
  private readonly keys: LoadedKeys | null;
  private readonly disabledReason: string | null;

  constructor(@Optional() configService?: ConfigService) {
    this.config = readAuthConfig((key) =>
      configService ? configService.get<string>(key) : process.env[key],
    );
    const { keys, reason } = KeyService.load(this.config);
    this.keys = keys;
    this.disabledReason = reason;
    if (reason) {
      this.logger.warn(
        `Local auth (self-hosted tokens) is DISABLED: ${reason}. ` +
          'Only legacy Supabase tokens are accepted (if AUTH_ACCEPT_SUPABASE_TOKENS is true).',
      );
    }
  }

  private static load(config: AuthConfig): {
    keys: LoadedKeys | null;
    reason: string | null;
  } {
    if (!config.keys) {
      return { keys: null, reason: `missing ${config.missing.join(', ')}` };
    }
    try {
      return { keys: KeyService.parseKeys(config.keys), reason: null };
    } catch (error) {
      return {
        keys: null,
        reason: `invalid JWT_PRIVATE_KEY/JWT_PUBLIC_KEY (${(error as Error).message})`,
      };
    }
  }

  /** Parses and cross-checks the PEM keys. Error messages contain no key data. */
  static parseKeys(config: AuthKeyConfig): LoadedKeys {
    let privateKey: KeyObject;
    let publicKey: KeyObject;
    try {
      privateKey = createPrivateKey(config.privateKeyPem);
    } catch {
      throw new Error('private key is not a valid PEM');
    }
    try {
      publicKey = createPublicKey(config.publicKeyPem);
    } catch {
      throw new Error('public key is not a valid PEM');
    }
    if (
      privateKey.asymmetricKeyType !== 'rsa' ||
      publicKey.asymmetricKeyType !== 'rsa'
    ) {
      throw new Error('keys must be RSA keys');
    }
    if ((publicKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) {
      throw new Error('RSA keys must be at least 2048 bits');
    }
    const probe = Buffer.from('nusantara-play-key-check');
    const signature = sign('sha256', probe, privateKey);
    if (!verify('sha256', probe, publicKey, signature)) {
      throw new Error('public key does not match the private key');
    }
    return {
      privateKey,
      publicKey,
      keyId: config.keyId,
      issuer: config.issuer,
      audience: config.audience,
    };
  }

  isEnabled(): boolean {
    return this.keys !== null;
  }

  /** The loaded keys; throws LocalAuthDisabledError when disabled. */
  getKeys(): LoadedKeys {
    if (!this.keys) {
      throw new LocalAuthDisabledError(this.disabledReason ?? 'no keys');
    }
    return this.keys;
  }

  /** Public key as a JWKS (RFC 7517) for GET /api/auth/jwks.json. */
  async getJwks(): Promise<Jwks> {
    const keys = this.getKeys();
    const jwk = await exportJWK(keys.publicKey);
    return {
      keys: [
        {
          kty: jwk.kty,
          n: jwk.n,
          e: jwk.e,
          kid: keys.keyId,
          alg: 'RS256',
          use: 'sig',
        },
      ],
    };
  }
}
