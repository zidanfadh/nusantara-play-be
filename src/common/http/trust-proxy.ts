import { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Express "trust proxy" from the TRUST_PROXY env var (Phase 06, P3).
 *
 * Default "loopback": trust X-Forwarded-For only when the direct peer is
 * 127.0.0.1/::1, i.e. a host nginx on the same machine. Then req.ip is the
 * address nginx saw (or put in X-Forwarded-For); anything a client writes
 * into X-Forwarded-For further left is ignored.
 *
 * Values: "true"/"false", a hop count ("1"), or anything Express accepts as
 * names/addresses/subnets ("loopback, 172.16.0.0/12", "uniquelocal").
 * "true" trusts every hop and lets any client spoof its IP; avoid it.
 */
export const DEFAULT_TRUST_PROXY = 'loopback';

export function parseTrustProxy(
  raw: string | undefined,
): boolean | number | string {
  const value = (raw ?? '').trim();
  if (value === '') {
    return DEFAULT_TRUST_PROXY;
  }
  if (/^(true|false)$/i.test(value)) {
    return value.toLowerCase() === 'true';
  }
  if (/^\d+$/.test(value)) {
    return Number(value);
  }
  return value;
}

export function applyTrustProxy(
  app: NestExpressApplication,
  raw: string | undefined,
): void {
  app.set('trust proxy', parseTrustProxy(raw));
}
