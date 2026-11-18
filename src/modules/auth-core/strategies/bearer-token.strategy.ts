import passport from 'passport';
import type { Request } from 'express';

type VerifyDone = (err: unknown, user?: unknown, info?: unknown) => void;
type Verify = (token: string, done: VerifyDone) => void;

/** Raw bearer token from `Authorization: Bearer <token>`, else null. */
export function extractBearerToken(
  req: Pick<Request, 'headers'>,
): string | null {
  const header = req.headers?.authorization;
  if (typeof header !== 'string') {
    return null;
  }
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match ? match[1] : null;
}

/**
 * Minimal passport strategy: hands the bearer token to `verify`. A falsy
 * user means "not authenticated by this strategy" (fail), so passport moves
 * on to the next strategy; an error aborts the chain.
 * Used through PassportStrategy(), which supplies `verify` (-> validate()).
 */
export class BearerTokenStrategy extends passport.Strategy {
  declare success: (user: unknown, info?: unknown) => void;
  declare fail: (challenge?: unknown, status?: number) => void;
  declare error: (err: unknown) => void;

  constructor(private readonly verifyToken: Verify) {
    super();
  }

  authenticate(req: Request): void {
    const token = extractBearerToken(req);
    if (!token) {
      this.fail({ message: 'No bearer token' }, 401);
      return;
    }
    this.verifyToken(token, (err, user, info) => {
      if (err) {
        this.error(err);
      } else if (!user) {
        this.fail(info ?? { message: 'Invalid token' }, 401);
      } else {
        this.success(user, info);
      }
    });
  }
}
