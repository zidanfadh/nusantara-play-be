import { ConfigService } from '@nestjs/config';
import { generateAuthKeyPair, GeneratedAuthKeyPair } from '../key-pair.util';
import { KeyService } from '../key.service';
import { TokenService } from '../token.service';

/** One key pair per test file (RSA generation takes ~100 ms). */
let shared: GeneratedAuthKeyPair | undefined;
export function testKeys(): GeneratedAuthKeyPair {
  shared ??= generateAuthKeyPair('unit');
  return shared;
}

export function authEnv(
  overrides: Record<string, string | undefined> = {},
  keys: GeneratedAuthKeyPair = testKeys(),
): Record<string, string | undefined> {
  return {
    JWT_PRIVATE_KEY: keys.privateKeyBase64,
    JWT_PUBLIC_KEY: keys.publicKeyBase64,
    JWT_KEY_ID: keys.keyId,
    JWT_ISSUER: 'unit-issuer',
    JWT_AUDIENCE: 'unit-audience',
    ...overrides,
  };
}

export function fakeConfig(
  env: Record<string, string | undefined>,
): ConfigService {
  return { get: (key: string) => env[key] } as unknown as ConfigService;
}

export function tokenServiceFor(env: Record<string, string | undefined>): {
  keyService: KeyService;
  tokens: TokenService;
} {
  const keyService = new KeyService(fakeConfig(env));
  return { keyService, tokens: new TokenService(keyService) };
}
