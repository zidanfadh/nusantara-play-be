/**
 * npm run auth:generate-keys
 *
 * Prints a NEW RS256 key pair, a key id and the matching .env lines to
 * stdout. Writes nothing to disk: copy the lines into the git-ignored
 * .env.local (dev) or into the server's secret env (production: generate
 * the production keys ON the server, never reuse dev keys).
 *
 * Optional: -- --prefix=<key id prefix> (default "np").
 */
import { generateAuthKeyPair } from '../key-pair.util';

const prefixArg = process.argv.find((arg) => arg.startsWith('--prefix='));
const prefix = prefixArg ? prefixArg.slice('--prefix='.length) : '';
const keys = generateAuthKeyPair(prefix || 'np');

const out = [
  '# ---- Self-hosted auth keys (RS256). SECRET: never commit JWT_PRIVATE_KEY. ----',
  `# Key id: ${keys.keyId}`,
  '',
  '# Public key (PEM), for reference:',
  keys.publicKeyPem.trim(),
  '',
  '# Private key (PEM), SECRET:',
  keys.privateKeyPem.trim(),
  '',
  '# .env lines (each PEM base64-encoded on one line):',
  `JWT_PRIVATE_KEY=${keys.privateKeyBase64}`,
  `JWT_PUBLIC_KEY=${keys.publicKeyBase64}`,
  `JWT_KEY_ID=${keys.keyId}`,
  '',
];
process.stdout.write(out.join('\n') + '\n');
