import { parseFrontendUrls } from './app.config';

describe('app config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.FRONTEND_URL;
    delete process.env.FRONTEND_URLS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('parseFrontendUrls', () => {
    it('parses comma-separated FRONTEND_URLS', () => {
      process.env.FRONTEND_URLS =
        'http://localhost:3001, https://nusantaralegacy.org,https://nusantaravirtual.org';
      process.env.FRONTEND_URL = 'https://legacy-fallback.example.com';

      expect(parseFrontendUrls()).toEqual([
        'http://localhost:3001',
        'https://nusantaralegacy.org',
        'https://nusantaravirtual.org',
      ]);
    });

    it('ignores empty comma-separated entries', () => {
      process.env.FRONTEND_URLS =
        'https://nusantaralegacy.org, ,https://nusantaravirtual.org,';

      expect(parseFrontendUrls()).toEqual([
        'https://nusantaralegacy.org',
        'https://nusantaravirtual.org',
      ]);
    });

    it('falls back to single FRONTEND_URL', () => {
      process.env.FRONTEND_URL = 'https://nusantaralegacy.org';

      expect(parseFrontendUrls()).toEqual(['https://nusantaralegacy.org']);
    });

    it('uses localhost when no frontend URL env is configured', () => {
      expect(parseFrontendUrls()).toEqual(['http://localhost:3001']);
    });
  });
});
