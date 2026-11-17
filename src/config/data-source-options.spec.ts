import { buildDataSourceOptions } from './data-source-options';

const envFrom =
  (vars: Record<string, string>) =>
  (key: string): string | undefined =>
    vars[key];

describe('buildDataSourceOptions', () => {
  it('uses DATABASE_URL when set and ignores individual params', () => {
    const options = buildDataSourceOptions(
      envFrom({
        DATABASE_URL: 'postgres://u:p@db.example.com:6543/app',
        DATABASE_HOST: 'ignored-host',
        DATABASE_NAME: 'ignored-db',
      }),
    );

    expect(options).toMatchObject({
      type: 'postgres',
      url: 'postgres://u:p@db.example.com:6543/app',
      synchronize: false,
      ssl: false,
    });
    expect(options).not.toHaveProperty('host');
    expect(options).not.toHaveProperty('database');
  });

  it('uses individual DATABASE_* params when DATABASE_URL is not set', () => {
    const options = buildDataSourceOptions(
      envFrom({
        DATABASE_HOST: 'db.local',
        DATABASE_PORT: '5433',
        DATABASE_USER: 'nusantara',
        DATABASE_PASSWORD: 'secret',
        DATABASE_NAME: 'nusantara_dev',
      }),
    );

    expect(options).toMatchObject({
      type: 'postgres',
      host: 'db.local',
      port: 5433,
      username: 'nusantara',
      password: 'secret',
      database: 'nusantara_dev',
      ssl: false,
    });
    expect(options).not.toHaveProperty('url');
  });

  it('applies the same defaults as the app when nothing is set', () => {
    const options = buildDataSourceOptions(envFrom({}));

    expect(options).toMatchObject({
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: undefined,
      database: 'nusantara_play',
      ssl: false,
    });
  });

  it('treats an empty DATABASE_URL as not set', () => {
    const options = buildDataSourceOptions(
      envFrom({ DATABASE_URL: '', DATABASE_HOST: 'db.local' }),
    );

    expect(options).not.toHaveProperty('url');
    expect(options).toMatchObject({ host: 'db.local' });
  });

  it.each([
    ['true', { rejectUnauthorized: false }],
    ['false', false],
    ['1', false],
  ])('DATABASE_SSL=%s gives ssl %p', (value, expected) => {
    expect(
      buildDataSourceOptions(envFrom({ DATABASE_SSL: value })).ssl,
    ).toEqual(expected);
    expect(
      buildDataSourceOptions(
        envFrom({ DATABASE_URL: 'postgres://x/y', DATABASE_SSL: value }),
      ).ssl,
    ).toEqual(expected);
  });

  it('registers entities and migrations under src/', () => {
    const options = buildDataSourceOptions(envFrom({}));

    expect(options.entities).toEqual([
      expect.stringMatching(
        /[\\/]config[\\/]\.\.[\\/]\*\*[\\/]\*\.entity\{\.ts,\.js\}$/,
      ),
    ]);
    expect(options.migrations).toEqual([
      expect.stringMatching(
        /[\\/]config[\\/]\.\.[\\/]migrations[\\/]\*\{\.ts,\.js\}$/,
      ),
    ]);
  });

  describe('DB_* fallback', () => {
    const legacyEnv = {
      DB_HOST: 'legacy-host',
      DB_PORT: '6000',
      DB_USERNAME: 'legacy-user',
      DB_PASSWORD: 'legacy-pass',
      DB_DATABASE: 'legacy-db',
      DB_SSL: 'true',
    };

    it('uses DB_* names when allowed and DATABASE_* is missing, warning once', () => {
      const warn = jest.fn<void, [string]>();
      const options = buildDataSourceOptions(envFrom(legacyEnv), {
        allowLegacyDbVars: true,
        warn,
      });

      expect(options).toMatchObject({
        host: 'legacy-host',
        port: 6000,
        username: 'legacy-user',
        password: 'legacy-pass',
        database: 'legacy-db',
        ssl: { rejectUnauthorized: false },
      });
      expect(warn).toHaveBeenCalledTimes(1);
      const message = warn.mock.calls[0][0];
      expect(message).toContain('deprecated');
      expect(message).toContain('DB_HOST');
      // Never log values (DB_PASSWORD value must not appear).
      expect(message).not.toContain('legacy-pass');
    });

    it('prefers DATABASE_* over DB_* per variable', () => {
      const warn = jest.fn<void, [string]>();
      const options = buildDataSourceOptions(
        envFrom({
          ...legacyEnv,
          DATABASE_HOST: 'new-host',
          DATABASE_SSL: 'false',
        }),
        { allowLegacyDbVars: true, warn },
      );

      expect(options).toMatchObject({
        host: 'new-host',
        database: 'legacy-db',
        ssl: false,
      });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toMatch(
        /^Deprecated database env vars used: DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE\. /,
      );
    });

    it('does not warn when only DATABASE_* names are used', () => {
      const warn = jest.fn<void, [string]>();
      buildDataSourceOptions(envFrom({ DATABASE_HOST: 'db.local' }), {
        allowLegacyDbVars: true,
        warn,
      });

      expect(warn).not.toHaveBeenCalled();
    });

    it('ignores DB_* names unless explicitly allowed (app behavior)', () => {
      const warn = jest.fn<void, [string]>();
      const options = buildDataSourceOptions(envFrom(legacyEnv), { warn });

      expect(options).toMatchObject({
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        database: 'nusantara_play',
        ssl: false,
      });
      expect(warn).not.toHaveBeenCalled();
    });
  });
});
