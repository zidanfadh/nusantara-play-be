import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { User } from '../users/entities/user.entity';
import {
  clearAuthCookies,
  readCookie,
  REFRESH_COOKIE,
  setAuthCookies,
} from './auth-cookies';
import { RefreshTokenInvalidError } from './auth-errors';
import { AuthErrorFilter } from './auth-error.filter';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  AuthSession,
  LocalAuthService,
  normalizeEmail,
  REGISTER_RESPONSE,
  SessionUser,
} from './local-auth.service';
import { LoginEmailLimiter } from './login-email-limiter.service';
import type { RefreshTokenMeta } from './refresh-token.service';

/**
 * Per-tracker limits (UserThrottlerGuard: user id when logged in, else IP).
 * Generous on purpose: in production browser requests arrive from shared
 * Vercel IPs. The real brute-force protection is per account
 * (LoginEmailLimiter + the database lockout).
 */
const MINUTE_MS = 60_000;
export const LOGIN_REGISTER_THROTTLE = { limit: 30, ttl: MINUTE_MS };
export const REFRESH_THROTTLE = { limit: 60, ttl: MINUTE_MS };

export interface SessionResponse {
  accessToken: string;
  expiresIn: number;
  /** Same object as GET /api/users/me (users row + emailVerified). */
  user: SessionUser;
}

function metaOf(req: Request): RefreshTokenMeta {
  return { userAgent: req.get('user-agent') ?? null, ip: req.ip ?? null };
}

/**
 * Self-hosted auth endpoints (Phase 08) under /api/auth. The browser sees
 * them as /backend-api/auth/* in production (Vercel rewrite) and as
 * /api/auth/* in local development; AUTH_COOKIE_PATH matches that.
 * POST /api/auth/change-password stays in AuthController (it also serves
 * the legacy Supabase accounts).
 */
@Controller('auth')
@UseFilters(AuthErrorFilter)
export class LocalAuthController {
  constructor(
    private readonly auth: LocalAuthService,
    private readonly emailLimiter: LoginEmailLimiter,
  ) {}

  @Post('register')
  @Public()
  @Throttle({ default: LOGIN_REGISTER_THROTTLE })
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
  ): Promise<typeof REGISTER_RESPONSE> {
    await this.auth.register(dto, req.ip ?? null);
    return REGISTER_RESPONSE;
  }

  @Post('login')
  @Public()
  @Throttle({ default: LOGIN_REGISTER_THROTTLE })
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    await this.emailLimiter.consume(normalizeEmail(dto.email));
    const session = await this.auth.login(dto.email, dto.password, metaOf(req));
    return this.respond(res, session);
  }

  @Post('refresh')
  @Public()
  @UseGuards(CsrfGuard)
  @Throttle({ default: REFRESH_THROTTLE })
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    let session: AuthSession;
    try {
      session = await this.auth.refresh(
        readCookie(req, REFRESH_COOKIE),
        metaOf(req),
      );
    } catch (error) {
      // 401: the cookie is useless, remove both. 409 refresh_conflict keeps
      // the cookie (the browser already holds the newer one).
      if (error instanceof RefreshTokenInvalidError) {
        clearAuthCookies(res, this.auth.config);
      }
      throw error;
    }
    return this.respond(res, session);
  }

  @Post('logout')
  @Public()
  @UseGuards(CsrfGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(readCookie(req, REFRESH_COOKIE));
    clearAuthCookies(res, this.auth.config);
  }

  @Post('logout-all')
  @UseGuards(CsrfGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logoutAll(user.id);
    clearAuthCookies(res, this.auth.config);
  }

  private respond(res: Response, session: AuthSession): SessionResponse {
    setAuthCookies(res, this.auth.config, session.refreshToken.token);
    return {
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      user: session.user,
    };
  }
}
