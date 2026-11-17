import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

/** Reads one environment value by name (process.env, ConfigService, ...). */
export type EnvGetter = (key: string) => string | undefined;

/**
 * Deprecated migration-CLI names and the DATABASE_* names that replace them.
 * Only used when `allowLegacyDbVars` is true.
 */
export const LEGACY_DB_ENV_NAMES: Readonly<Record<string, string>> = {
  DATABASE_HOST: 'DB_HOST',
  DATABASE_PORT: 'DB_PORT',
  DATABASE_USER: 'DB_USERNAME',
  DATABASE_PASSWORD: 'DB_PASSWORD',
  DATABASE_NAME: 'DB_DATABASE',
  DATABASE_SSL: 'DB_SSL',
};

export interface BuildDataSourceOptionsParams {
  /**
   * If true and a DATABASE_* variable is not set, fall back to its old DB_*
   * name (see LEGACY_DB_ENV_NAMES) and report it through `warn` once.
   * Only the migration CLI enables this, so the app's behavior is unchanged.
   */
  allowLegacyDbVars?: boolean;
  /** Called at most once, with the variable names only (never values). */
  warn?: (message: string) => void;
}

/**
 * Builds the TypeORM PostgreSQL connection options from env vars.
 * Single source of truth for the app (DatabaseModule) and the migration CLI
 * (typeorm.config.ts), so both always connect to the same database.
 *
 * Rules:
 * - DATABASE_URL set (non-empty): connect with the URL only.
 * - Otherwise DATABASE_HOST (default localhost), DATABASE_PORT (default 5432),
 *   DATABASE_USER (default postgres), DATABASE_PASSWORD,
 *   DATABASE_NAME (default nusantara_play).
 * - DATABASE_SSL === 'true': ssl with rejectUnauthorized false; else no ssl.
 */
export function buildDataSourceOptions(
  getEnv: EnvGetter,
  params: BuildDataSourceOptionsParams = {},
): PostgresConnectionOptions {
  const usedLegacyNames: string[] = [];

  const read = (name: string): string | undefined => {
    const value = getEnv(name);
    if (value || !params.allowLegacyDbVars) {
      return value;
    }
    const legacyName = LEGACY_DB_ENV_NAMES[name];
    const legacyValue = legacyName ? getEnv(legacyName) : undefined;
    if (legacyValue) {
      usedLegacyNames.push(legacyName);
      return legacyValue;
    }
    return value;
  };

  const url = getEnv('DATABASE_URL');
  const ssl = read('DATABASE_SSL') === 'true';

  const common = {
    type: 'postgres' as const,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    synchronize: false,
    ssl: ssl ? { rejectUnauthorized: false } : false,
  };

  let options: PostgresConnectionOptions;
  if (url) {
    options = { ...common, url };
  } else {
    options = {
      ...common,
      host: read('DATABASE_HOST') || 'localhost',
      port: parseInt(read('DATABASE_PORT') || '5432', 10),
      username: read('DATABASE_USER') || 'postgres',
      password: read('DATABASE_PASSWORD'),
      database: read('DATABASE_NAME') || 'nusantara_play',
    };
  }

  if (usedLegacyNames.length > 0 && params.warn) {
    params.warn(
      `Deprecated database env vars used: ${usedLegacyNames.join(', ')}. ` +
        'DB_* names are deprecated; use DATABASE_HOST, DATABASE_PORT, ' +
        'DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME and DATABASE_SSL.',
    );
  }

  return options;
}
