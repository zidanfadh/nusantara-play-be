import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import { buildDataSourceOptions } from './data-source-options';

// Load env files like the app (ConfigModule): .env.local first, then .env.
// Earlier files win; variables already set in the shell are never overridden.
dotenv.config({ path: ['.env.local', '.env'], quiet: true });

export const dataSourceOptions: DataSourceOptions = {
  // Same connection rules as the app (src/database/database.module.ts).
  ...buildDataSourceOptions((key) => process.env[key], {
    allowLegacyDbVars: true,
    warn: (message) => console.warn(`[typeorm.config] ${message}`),
  }),
  migrationsTransactionMode: 'each',
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
