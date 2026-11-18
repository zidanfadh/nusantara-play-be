import { DEFAULT_TRUST_PROXY, parseTrustProxy } from './trust-proxy';

describe('parseTrustProxy (P3)', () => {
  it('defaults to "loopback" (host nginx on the same machine)', () => {
    expect(DEFAULT_TRUST_PROXY).toBe('loopback');
    expect(parseTrustProxy(undefined)).toBe('loopback');
    expect(parseTrustProxy('')).toBe('loopback');
    expect(parseTrustProxy('   ')).toBe('loopback');
  });

  it('maps "true" and "false" to booleans', () => {
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('FALSE')).toBe(false);
  });

  it('maps a whole number to a hop count', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy(' 2 ')).toBe(2);
  });

  it('passes names, addresses and subnet lists through (trimmed)', () => {
    expect(parseTrustProxy(' loopback, 172.16.0.0/12 ')).toBe(
      'loopback, 172.16.0.0/12',
    );
    expect(parseTrustProxy('uniquelocal')).toBe('uniquelocal');
  });
});
