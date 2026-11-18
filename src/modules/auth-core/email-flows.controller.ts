import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseFilters,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AuthErrorFilter } from './auth-error.filter';
import {
  EmailOnlyDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/email-flows.dto';
import {
  EmailFlowsService,
  FORGOT_PASSWORD_RESPONSE,
  RESEND_VERIFICATION_RESPONSE,
  RESET_PASSWORD_RESPONSE,
  VERIFY_EMAIL_RESPONSE,
} from './email-flows.service';
import { LOGIN_REGISTER_THROTTLE } from './local-auth.controller';

/**
 * Email verification and password reset (Phase 09) under /api/auth. All
 * public. Generic answers: resend-verification and forgot-password always
 * answer 200 with the same body (the email work runs in the background);
 * verify-email and reset-password answer 400 invalid_or_expired_token for
 * any unusable token. Per-tracker limit = the generous login/register limit;
 * the per-address limit (3 emails / hour) is EmailSendLimiter.
 */
@Controller('auth')
@UseFilters(AuthErrorFilter)
export class EmailFlowsController {
  constructor(private readonly flows: EmailFlowsService) {}

  @Post('verify-email')
  @Public()
  @Throttle({ default: LOGIN_REGISTER_THROTTLE })
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
  ): Promise<typeof VERIFY_EMAIL_RESPONSE> {
    await this.flows.verifyEmail(dto.token);
    return VERIFY_EMAIL_RESPONSE;
  }

  @Post('resend-verification')
  @Public()
  @Throttle({ default: LOGIN_REGISTER_THROTTLE })
  @HttpCode(HttpStatus.OK)
  resendVerification(
    @Body() dto: EmailOnlyDto,
    @Req() req: Request,
  ): typeof RESEND_VERIFICATION_RESPONSE {
    this.flows.requestVerification(dto.email, req.ip ?? null);
    return RESEND_VERIFICATION_RESPONSE;
  }

  @Post('forgot-password')
  @Public()
  @Throttle({ default: LOGIN_REGISTER_THROTTLE })
  @HttpCode(HttpStatus.OK)
  forgotPassword(
    @Body() dto: EmailOnlyDto,
    @Req() req: Request,
  ): typeof FORGOT_PASSWORD_RESPONSE {
    this.flows.requestPasswordReset(dto.email, req.ip ?? null);
    return FORGOT_PASSWORD_RESPONSE;
  }

  @Post('reset-password')
  @Public()
  @Throttle({ default: LOGIN_REGISTER_THROTTLE })
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<typeof RESET_PASSWORD_RESPONSE> {
    await this.flows.resetPassword(dto.token, dto.newPassword);
    return RESET_PASSWORD_RESPONSE;
  }
}
