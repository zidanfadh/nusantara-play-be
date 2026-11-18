import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { applyTrustProxy } from './common/http/trust-proxy';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Get config service
  const configService = app.get(ConfigService);

  // Which proxies may set X-Forwarded-For (default "loopback": a host nginx
  // on the same machine). req.ip feeds the per-IP rate limit (P3).
  applyTrustProxy(app, configService.get<string>('TRUST_PROXY'));

  // Security headers with Helmet
  app.use(helmet());

  // req.cookies for the np_refresh cookie of the auth endpoints (Phase 08).
  app.use(cookieParser());

  // CORS configuration
  app.enableCors({
    origin: configService.get<string[]>('app.frontendUrls'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // X-Requested-With: CSRF header of the cookie-based auth endpoints (Phase 08).
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // API prefix
  app.setGlobalPrefix('api');

  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port);

  console.log(`
🚀 Nusantara Play Backend is running!
📍 Environment: ${configService.get<string>('app.env')}
🌐 Server: http://localhost:${port}
📖 API: http://localhost:${port}/api
✨ Status: Ready to serve requests
  `);
}

void bootstrap();
