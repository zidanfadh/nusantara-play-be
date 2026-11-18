import { generateKeyPairSync, randomBytes } from 'node:crypto';

export interface GeneratedAuthKeyPair {
  privateKeyPem: string;
  publicKeyPem: string;
  /** Base64 of the PEM text: the value for JWT_PRIVATE_KEY / JWT_PUBLIC_KEY. */
  privateKeyBase64: string;
  publicKeyBase64: string;
  keyId: string;
}

/**
 * New RSA 2048 key pair for RS256 access tokens (PKCS#8 private key, SPKI
 * public key) plus a key id. Used by `npm run auth:generate-keys` and by the
 * test env (fresh keys per test process, never written to disk).
 */
export function generateAuthKeyPair(
  keyIdPrefix = 'np',
  now = new Date(),
): GeneratedAuthKeyPair {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  return {
    privateKeyPem: privateKey,
    publicKeyPem: publicKey,
    privateKeyBase64: Buffer.from(privateKey, 'utf8').toString('base64'),
    publicKeyBase64: Buffer.from(publicKey, 'utf8').toString('base64'),
    keyId: `${keyIdPrefix}-${date}-${randomBytes(4).toString('hex')}`,
  };
}
