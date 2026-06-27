import { registerAs } from '@nestjs/config';

function parseCommaSeparatedUrls(value?: string): string[] {
  return (value || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
}

export function parseFrontendUrls(): string[] {
  const frontendUrls = parseCommaSeparatedUrls(process.env.FRONTEND_URLS);

  if (frontendUrls.length > 0) {
    return frontendUrls;
  }

  return [process.env.FRONTEND_URL || 'http://localhost:3001'];
}

export default registerAs('app', () => ({
  name: process.env.APP_NAME || 'Nusantara Play',
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
  frontendUrls: parseFrontendUrls(),
}));
