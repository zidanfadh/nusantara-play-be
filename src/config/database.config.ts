import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  // Prioritas: DATABASE_URL > individual params
  url: process.env.DATABASE_URL,
  // Fallback individual params (optional jika DATABASE_URL sudah ada)
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME || 'nusantara_play',
  // SSL config untuk Supabase (production)
  ssl: process.env.DATABASE_SSL === 'true',
}));
