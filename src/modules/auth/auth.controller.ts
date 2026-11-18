import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { readCookie, REFRESH_COOKIE } from '../auth-core/auth-cookies';
import { LocalAuthService } from '../auth-core/local-auth.service';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  LegacyChangePasswordDto,
} from './dto/change-password.dto';
import { User } from '../users/entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly localAuth: LocalAuthService,
    private readonly csrf: CsrfGuard,
  ) {}

  @Get('health')
  @Public()
  healthCheck() {
    return {
      status: 'ok',
      message: 'Auth service is running',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Users WITH user_credentials (Phase 08): local change-password, 204.
   * Users without (Supabase accounts): the pre-Phase-08 Supabase flow,
   * unchanged (same validation, 201 with { success, message }).
   * Audited; the stored body has every password replaced by [REDACTED].
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(AuditInterceptor)
  async changePassword(
    @CurrentUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (await this.localAuth.hasCredentials(user.id)) {
      const refreshToken = readCookie(req, REFRESH_COOKIE);
      // The refresh cookie is read (to keep this session alive), so the
      // request must pass the same CSRF check as the cookie endpoints.
      if (refreshToken) {
        this.csrf.assertRequest(req);
      }
      if (
        changePasswordDto.confirmPassword !== undefined &&
        changePasswordDto.confirmPassword !== changePasswordDto.newPassword
      ) {
        throw new BadRequestException(
          'New password and confirmation do not match',
        );
      }
      await this.localAuth.changePassword(
        user,
        changePasswordDto.currentPassword,
        changePasswordDto.newPassword,
        refreshToken,
      );
      res.status(204).send();
      return;
    }

    res
      .status(201)
      .json(await this.changeSupabasePassword(user, changePasswordDto));
  }

  /** LEGACY Supabase path, behavior as before Phase 08. */
  private async changeSupabasePassword(
    user: User,
    body: ChangePasswordDto,
  ): Promise<{ success: true; message: string }> {
    const legacy = plainToInstance(LegacyChangePasswordDto, body);
    const errors = await validate(legacy);
    if (errors.length > 0) {
      throw new BadRequestException(
        errors.flatMap((error) => Object.values(error.constraints ?? {})),
      );
    }

    // Validate password confirmation
    if (legacy.newPassword !== legacy.confirmPassword) {
      throw new BadRequestException(
        'New password and confirmation do not match',
      );
    }

    // Prevent using same password
    if (legacy.currentPassword === legacy.newPassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    // The password lives in Supabase. Accounts without a Supabase id and
    // without a local password cannot change a password.
    if (!user.supabase_user_id) {
      throw new BadRequestException(
        'Password change is not available for this account yet',
      );
    }

    await this.authService.changePassword(
      user.supabase_user_id,
      legacy.currentPassword,
      legacy.newPassword,
    );

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }
}
