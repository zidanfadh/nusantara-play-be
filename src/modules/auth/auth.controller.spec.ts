/**
 * POST /api/auth/change-password (Phase 08): local path for users with
 * user_credentials, the unchanged Supabase path for everybody else.
 */
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { REFRESH_COOKIE } from '../auth-core/auth-cookies';
import { User } from '../users/entities/user.entity';

const LOCAL_USER = { id: 'u-local', email: 'a@b.test' } as User;
const SUPABASE_USER = {
  id: 'u-legacy',
  email: 'c@d.test',
  supabase_user_id: 'sb-1',
} as User;

function setup(hasCredentials: boolean) {
  const authService = {
    changePassword: jest.fn().mockResolvedValue(undefined),
  };
  const localAuth = {
    hasCredentials: jest.fn().mockResolvedValue(hasCredentials),
    changePassword: jest.fn().mockResolvedValue(undefined),
  };
  const csrf = {
    assertRequest: jest.fn(() => {
      throw new ForbiddenException('csrf');
    }),
  };
  const controller = new AuthController(
    authService as never,
    localAuth as never,
    csrf as never,
  );
  const res = {
    status: jest.fn(),
    send: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  const req = (cookie?: string) =>
    ({
      headers: {},
      cookies: cookie ? { [REFRESH_COOKIE]: cookie } : {},
    }) as unknown as Request;
  return {
    controller,
    authService,
    localAuth,
    csrf,
    res: res as typeof res & Response,
    req,
  };
}

const body = {
  currentPassword: 'Old password 1',
  newPassword: 'New password 2',
  confirmPassword: 'New password 2',
};

describe('AuthController.changePassword (Phase 08)', () => {
  it('local user without a refresh cookie: local change, 204, no CSRF check, no Supabase', async () => {
    const t = setup(true);
    await t.controller.changePassword(LOCAL_USER, body, t.req(), t.res);
    expect(t.localAuth.changePassword).toHaveBeenCalledWith(
      LOCAL_USER,
      body.currentPassword,
      body.newPassword,
      null,
    );
    expect(t.res.status).toHaveBeenCalledWith(204);
    expect(t.csrf.assertRequest).not.toHaveBeenCalled();
    expect(t.authService.changePassword).not.toHaveBeenCalled();
  });

  it('local user WITH the refresh cookie: CSRF check first (403 stops everything)', async () => {
    const t = setup(true);
    await expect(
      t.controller.changePassword(LOCAL_USER, body, t.req('raw'), t.res),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(t.localAuth.changePassword).not.toHaveBeenCalled();
  });

  it('local user WITH the cookie and a passing CSRF check: the cookie is passed on', async () => {
    const t = setup(true);
    t.csrf.assertRequest.mockImplementation(() => undefined);
    await t.controller.changePassword(LOCAL_USER, body, t.req('raw'), t.res);
    expect(t.localAuth.changePassword).toHaveBeenCalledWith(
      LOCAL_USER,
      body.currentPassword,
      body.newPassword,
      'raw',
    );
  });

  it('local user: confirmPassword is optional, but must match when sent', async () => {
    const t = setup(true);
    await t.controller.changePassword(
      LOCAL_USER,
      { currentPassword: 'a', newPassword: 'b' },
      t.req(),
      t.res,
    );
    expect(t.localAuth.changePassword).toHaveBeenCalledTimes(1);
    await expect(
      t.controller.changePassword(
        LOCAL_USER,
        { ...body, confirmPassword: 'different' },
        t.req(),
        t.res,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('local errors (wrong current password) propagate', async () => {
    const t = setup(true);
    t.localAuth.changePassword.mockRejectedValue(new UnauthorizedException());
    await expect(
      t.controller.changePassword(LOCAL_USER, body, t.req(), t.res),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('Supabase user: the legacy flow, 201 { success, message }', async () => {
    const t = setup(false);
    await t.controller.changePassword(SUPABASE_USER, body, t.req(), t.res);
    expect(t.authService.changePassword).toHaveBeenCalledWith(
      'sb-1',
      body.currentPassword,
      body.newPassword,
    );
    expect(t.res.status).toHaveBeenCalledWith(201);
    expect(t.res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Password changed successfully',
    });
    expect(t.localAuth.changePassword).not.toHaveBeenCalled();
  });

  it('Supabase user: the old validation still applies (confirmPassword required, complexity, same password)', async () => {
    const t = setup(false);
    const call = (b: object) =>
      t.controller.changePassword(SUPABASE_USER, b as never, t.req(), t.res);
    await expect(
      call({ currentPassword: 'x', newPassword: 'New password 2' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      call({
        currentPassword: 'x',
        newPassword: 'alllowercase1',
        confirmPassword: 'alllowercase1',
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      call({ ...body, currentPassword: body.newPassword }),
    ).rejects.toThrow('must be different');
    expect(t.authService.changePassword).not.toHaveBeenCalled();
  });

  it('user with neither credentials nor a Supabase id: 400 as before', async () => {
    const t = setup(false);
    await expect(
      t.controller.changePassword(
        { id: 'x', supabase_user_id: null } as User,
        body,
        t.req(),
        t.res,
      ),
    ).rejects.toThrow('not available for this account yet');
  });
});
