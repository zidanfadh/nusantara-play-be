import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsOptional, IsUrl, MaxLength } from 'class-validator';

export const AVATAR_URL_MAX_LENGTH = 500;

/**
 * avatar_url validation (Phase 06, P4): an https URL of at most 500
 * characters, or null / empty string to clear it. An empty or blank string
 * is turned into null, so clearing always stores NULL.
 */
export function IsAvatarUrl(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' && value.trim() === '' ? null : value,
    ),
    IsOptional(),
    IsUrl(
      {
        protocols: ['https'],
        require_protocol: true,
        require_valid_protocol: true,
        allow_protocol_relative_urls: false,
      },
      { message: 'avatar_url must be an https URL' },
    ),
    MaxLength(AVATAR_URL_MAX_LENGTH),
  );
}
