/**
 * Builds the full AppModule the way src/main.ts does (Phase 08): cookie
 * parser, trust proxy (default "loopback", so tests can set the client IP
 * with X-Forwarded-For), /api prefix, the same ValidationPipe and the
 * global HttpExceptionFilter.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { applyTrustProxy } from '../src/common/http/trust-proxy';

export async function createE2eApp(): Promise<{
  app: NestExpressApplication;
  moduleRef: TestingModule;
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  applyTrustProxy(app, undefined);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('api');
  await app.init();
  return { app, moduleRef };
}

/** One parsed Set-Cookie header. */
export interface SetCookie {
  name: string;
  value: string;
  /** Lower-cased attribute names -> value ('' for flags). */
  attributes: Record<string, string>;
  raw: string;
}

export function parseSetCookies(
  header: string | string[] | undefined,
): SetCookie[] {
  const list = header === undefined ? [] : [header].flat();
  return list.map((raw) => {
    const [pair, ...attrs] = raw.split(';').map((part) => part.trim());
    const index = pair.indexOf('=');
    const attributes: Record<string, string> = {};
    for (const attr of attrs) {
      const eq = attr.indexOf('=');
      if (eq === -1) {
        attributes[attr.toLowerCase()] = '';
      } else {
        attributes[attr.slice(0, eq).toLowerCase()] = attr.slice(eq + 1);
      }
    }
    return {
      name: pair.slice(0, index),
      value: decodeURIComponent(pair.slice(index + 1)),
      attributes,
      raw,
    };
  });
}

/** True when a Set-Cookie deletes the cookie (expired in the past). */
export function isCleared(cookie: SetCookie | undefined): boolean {
  if (!cookie) {
    return false;
  }
  const expires = cookie.attributes.expires;
  return (
    cookie.value === '' &&
    expires !== undefined &&
    new Date(expires).getTime() < Date.now()
  );
}
