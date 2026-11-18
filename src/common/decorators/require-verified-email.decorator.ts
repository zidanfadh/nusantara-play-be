import { applyDecorators, UseFilters, UseGuards } from '@nestjs/common';
import {
  EmailNotVerifiedFilter,
  VerifiedEmailGuard,
} from '../guards/verified-email.guard';

/**
 * Route (or controller) needs a logged-in user with a verified email
 * (Phase 09): otherwise 403 `{ code: "EMAIL_NOT_VERIFIED", message }`.
 * Not applied to any existing route yet; Points (a later phase) will use it.
 */
export const RequireVerifiedEmail = () =>
  applyDecorators(
    UseGuards(VerifiedEmailGuard),
    UseFilters(EmailNotVerifiedFilter),
  );
