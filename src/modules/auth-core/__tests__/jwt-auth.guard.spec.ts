/**
 * JwtAuthGuard (Phase 07): our strategy first, legacy Supabase strategy as
 * fallback only while AUTH_ACCEPT_SUPABASE_TOKENS is true; @Public()
 * behaves as before. Uses stub passport strategies registered under the
 * real names, so no keys, database or Supabase are involved.
 */
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import passport from 'passport';
import {
  JwtAuthGuard,
  jwtAuthStrategies,
} from '../../../common/guards/jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { LOCAL_JWT_STRATEGY } from '../auth-core.constants';
import { SUPABASE_JWT_STRATEGY } from '../../auth/legacy/supabase-jwt.strategy';
import { fakeConfig } from './helpers';

type Outcome = { user: unknown } | { error: Error } | 'fail';

/** Stub strategy: success/fail/error depending on the bearer token. */
function stubStrategy(
  name: string,
  outcomes: Record<string, Outcome>,
  calls: string[],
): passport.Strategy {
  const strategy = new passport.Strategy() as passport.Strategy & {
    success(user: unknown): void;
    fail(challenge: unknown, status: number): void;
    error(err: Error): void;
  };
  strategy.name = name;
  strategy.authenticate = function (this: typeof strategy, req) {
    calls.push(name);
    const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    const outcome = outcomes[token] ?? 'fail';
    if (outcome === 'fail') {
      this.fail({ message: 'no' }, 401);
    } else if ('error' in outcome) {
      this.error(outcome.error);
    } else {
      this.success(outcome.user);
    }
  };
  return strategy;
}

const LOCAL_USER = { id: 'local-user', role: 'publik' };
const LEGACY_USER = { id: 'legacy-user', role: 'pakar' };

describe('JwtAuthGuard (Phase 07)', () => {
  let calls: string[];

  beforeEach(() => {
    calls = [];
    passport.use(
      LOCAL_JWT_STRATEGY,
      stubStrategy(
        LOCAL_JWT_STRATEGY,
        {
          'local-ok': { user: LOCAL_USER },
          'local-boom': { error: new Error('db down') },
        },
        calls,
      ),
    );
    passport.use(
      SUPABASE_JWT_STRATEGY,
      stubStrategy(
        SUPABASE_JWT_STRATEGY,
        { 'legacy-ok': { user: LEGACY_USER } },
        calls,
      ),
    );
  });

  afterAll(() => {
    passport.unuse(LOCAL_JWT_STRATEGY);
    passport.unuse(SUPABASE_JWT_STRATEGY);
  });

  function guard(accept?: string) {
    return new JwtAuthGuard(
      new Reflector(),
      fakeConfig({ AUTH_ACCEPT_SUPABASE_TOKENS: accept }),
    );
  }

  function context(token: string | null, isPublic = false) {
    const req: Record<string, unknown> = {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    };
    const handler = () => undefined;
    if (isPublic) {
      Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);
    }
    const ctx = {
      getHandler: () => handler,
      getClass: () => class {},
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;
    return { ctx, req };
  }

  it('tries our strategy first, then the legacy one (default config)', () => {
    expect(guard().strategies).toEqual([
      LOCAL_JWT_STRATEGY,
      SUPABASE_JWT_STRATEGY,
    ]);
    expect(guard('true').strategies).toEqual(jwtAuthStrategies(true));
    expect(guard('false').strategies).toEqual([LOCAL_JWT_STRATEGY]);
  });

  it('accepts our token without calling the legacy strategy', async () => {
    const { ctx, req } = context('local-ok');
    await expect(guard().canActivate(ctx)).resolves.toBe(true);
    expect(req.user).toBe(LOCAL_USER);
    expect(calls).toEqual([LOCAL_JWT_STRATEGY]);
  });

  it('falls back to the legacy Supabase strategy', async () => {
    const { ctx, req } = context('legacy-ok');
    await expect(guard().canActivate(ctx)).resolves.toBe(true);
    expect(req.user).toBe(LEGACY_USER);
    expect(calls).toEqual([LOCAL_JWT_STRATEGY, SUPABASE_JWT_STRATEGY]);
  });

  it('refuses legacy tokens when AUTH_ACCEPT_SUPABASE_TOKENS=false', async () => {
    const { ctx, req } = context('legacy-ok');
    await expect(guard('false').canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(req.user).toBeUndefined();
    expect(calls).toEqual([LOCAL_JWT_STRATEGY]);
  });

  it('still accepts our tokens when AUTH_ACCEPT_SUPABASE_TOKENS=false', async () => {
    const { ctx, req } = context('local-ok');
    await expect(guard('false').canActivate(ctx)).resolves.toBe(true);
    expect(req.user).toBe(LOCAL_USER);
  });

  it('protected route: no or invalid token -> 401 "Authentication required"', async () => {
    for (const token of [null, 'garbage']) {
      const { ctx } = context(token);
      await expect(guard().canActivate(ctx)).rejects.toThrow(
        'Authentication required',
      );
    }
  });

  it('protected route: a strategy error is rethrown (not turned into 401)', async () => {
    const { ctx } = context('local-boom');
    await expect(guard().canActivate(ctx)).rejects.toThrow('db down');
  });

  it('@Public(): no token -> allowed, req.user = false (as before)', async () => {
    const { ctx, req } = context(null, true);
    await expect(guard().canActivate(ctx)).resolves.toBe(true);
    expect(req.user).toBe(false);
  });

  it('@Public(): a valid token still sets req.user (our or legacy)', async () => {
    const ours = context('local-ok', true);
    await expect(guard().canActivate(ours.ctx)).resolves.toBe(true);
    expect(ours.req.user).toBe(LOCAL_USER);

    const legacy = context('legacy-ok', true);
    await expect(guard().canActivate(legacy.ctx)).resolves.toBe(true);
    expect(legacy.req.user).toBe(LEGACY_USER);
  });

  it('@Public(): a strategy error is ignored and req.user stays unset', async () => {
    const { ctx, req } = context('local-boom', true);
    await expect(guard().canActivate(ctx)).resolves.toBe(true);
    expect('user' in req).toBe(false);
  });
});
