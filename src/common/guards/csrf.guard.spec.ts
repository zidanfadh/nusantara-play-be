import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  compileOriginPatterns,
  CsrfGuard,
  csrfFailure,
  isAllowedOrigin,
} from './csrf.guard';

const policy = {
  origins: ['http://localhost:3001', 'https://nusantaralegacy.org/'],
  patterns: compileOriginPatterns([
    'https://nusantara-play-fe-[a-z0-9-]+\\.vercel\\.app',
  ]),
};

const headers = (h: Record<string, string>) => ({ headers: h });

describe('CSRF check (Phase 08)', () => {
  it('accepts exact FRONTEND_URLS origins (trailing slash and case ignored)', () => {
    expect(isAllowedOrigin('http://localhost:3001', policy)).toBe(true);
    expect(isAllowedOrigin('https://NusantaraLegacy.org', policy)).toBe(true);
  });

  it('accepts origins that FULLY match a pattern, nothing else', () => {
    expect(
      isAllowedOrigin('https://nusantara-play-fe-abc123.vercel.app', policy),
    ).toBe(true);
    expect(
      isAllowedOrigin(
        'https://nusantara-play-fe-abc123.vercel.app.evil.test',
        policy,
      ),
    ).toBe(false);
    expect(
      isAllowedOrigin('https://evil.test/https://nusantaralegacy.org', policy),
    ).toBe(false);
  });

  it('refuses missing, empty and "null" origins and unknown hosts', () => {
    for (const origin of [undefined, '', 'null', 'https://evil.test']) {
      expect(isAllowedOrigin(origin, policy)).toBe(false);
    }
  });

  it('skips invalid patterns and reports their index', () => {
    const invalid: number[] = [];
    const compiled = compileOriginPatterns(['(', 'https://ok\\.test'], (i) =>
      invalid.push(i),
    );
    expect(invalid).toEqual([0]);
    expect(compiled).toHaveLength(1);
  });

  it('csrfFailure: needs X-Requested-With: nusantara-play AND an allowed Origin', () => {
    expect(
      csrfFailure(
        headers({
          'x-requested-with': 'nusantara-play',
          origin: 'http://localhost:3001',
        }),
        policy,
      ),
    ).toBeNull();
    expect(
      csrfFailure(headers({ origin: 'http://localhost:3001' }), policy),
    ).toBe('missing_header');
    expect(
      csrfFailure(
        headers({
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost:3001',
        }),
        policy,
      ),
    ).toBe('missing_header');
    expect(
      csrfFailure(headers({ 'x-requested-with': 'nusantara-play' }), policy),
    ).toBe('bad_origin');
  });

  it('CsrfGuard reads FRONTEND_URLS and FRONTEND_ORIGIN_PATTERNS from config and throws 403', () => {
    const env: Record<string, unknown> = {
      'app.frontendUrls': ['https://a.test'],
      FRONTEND_ORIGIN_PATTERNS: 'https://pr-\\d+\\.b\\.test',
    };
    const guard = new CsrfGuard({
      get: (key: string) => env[key],
    } as unknown as ConfigService);
    const ctx = (h: Record<string, string>) =>
      ({
        switchToHttp: () => ({ getRequest: () => headers(h) }),
      }) as unknown as ExecutionContext;

    expect(
      guard.canActivate(
        ctx({ 'x-requested-with': 'nusantara-play', origin: 'https://a.test' }),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        ctx({
          'x-requested-with': 'nusantara-play',
          origin: 'https://pr-12.b.test',
        }),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(
        ctx({ 'x-requested-with': 'nusantara-play', origin: 'https://c.test' }),
      ),
    ).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx({ origin: 'https://a.test' }))).toThrow(
      ForbiddenException,
    );
  });
});
