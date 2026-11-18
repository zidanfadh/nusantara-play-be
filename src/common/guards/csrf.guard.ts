import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { readAuthConfig } from '../../config/auth.config';
import { parseFrontendUrls } from '../../config/app.config';

/** Required value of the X-Requested-With header (Phase 08). */
export const CSRF_HEADER_VALUE = 'nusantara-play';

export interface CsrfPolicy {
  /** Exact origins (FRONTEND_URLS). */
  origins: string[];
  /** Anchored regular expressions (FRONTEND_ORIGIN_PATTERNS). */
  patterns: RegExp[];
}

/** "https://a.b/" and "https://a.b" are the same origin. */
function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, '').toLowerCase();
}

/**
 * Compiles FRONTEND_ORIGIN_PATTERNS entries as FULL matches (^(?:...)$), so
 * "https://x\.vercel\.app" cannot be satisfied by "https://x.vercel.app.evil".
 * Invalid expressions are skipped and reported through onInvalid.
 */
export function compileOriginPatterns(
  patterns: string[],
  onInvalid: (index: number) => void = () => undefined,
): RegExp[] {
  const compiled: RegExp[] = [];
  patterns.forEach((pattern, index) => {
    try {
      compiled.push(new RegExp(`^(?:${pattern})$`, 'i'));
    } catch {
      onInvalid(index);
    }
  });
  return compiled;
}

export function isAllowedOrigin(
  origin: string | undefined,
  policy: CsrfPolicy,
): boolean {
  if (typeof origin !== 'string' || origin.trim() === '') {
    return false;
  }
  const candidate = normalizeOrigin(origin);
  if (candidate === 'null') {
    return false;
  }
  if (
    policy.origins.some((allowed) => normalizeOrigin(allowed) === candidate)
  ) {
    return true;
  }
  return policy.patterns.some((pattern) => pattern.test(candidate));
}

/** null = request passes; otherwise the reason (never logged with data). */
export function csrfFailure(
  req: Pick<Request, 'headers'>,
  policy: CsrfPolicy,
): 'missing_header' | 'bad_origin' | null {
  if (req.headers['x-requested-with'] !== CSRF_HEADER_VALUE) {
    return 'missing_header';
  }
  const origin = req.headers.origin;
  if (
    !isAllowedOrigin(typeof origin === 'string' ? origin : undefined, policy)
  ) {
    return 'bad_origin';
  }
  return null;
}

/**
 * CSRF protection for the cookie-based auth endpoints (Phase 08): requires
 * `X-Requested-With: nusantara-play` (a custom header forces a CORS
 * preflight cross-origin) AND an Origin header that is in FRONTEND_URLS or
 * fully matches one of FRONTEND_ORIGIN_PATTERNS. Otherwise 403.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly logger = new Logger(CsrfGuard.name);
  readonly policy: CsrfPolicy;

  constructor(@Optional() configService?: ConfigService) {
    const get = (key: string) =>
      configService ? configService.get<string>(key) : process.env[key];
    const config = readAuthConfig(get);
    this.policy = {
      origins:
        configService?.get<string[]>('app.frontendUrls') ?? parseFrontendUrls(),
      patterns: compileOriginPatterns(config.frontendOriginPatterns, (index) =>
        this.logger.warn(
          `FRONTEND_ORIGIN_PATTERNS entry #${index + 1} is not a valid regular expression; ignored`,
        ),
      ),
    };
  }

  /** Throws 403 when the request fails the CSRF check. */
  assertRequest(req: Pick<Request, 'headers'>): void {
    if (csrfFailure(req, this.policy)) {
      throw new ForbiddenException('Request blocked (CSRF check failed)');
    }
  }

  canActivate(context: ExecutionContext): boolean {
    this.assertRequest(context.switchToHttp().getRequest<Request>());
    return true;
  }
}
