import { Pool, PoolConfig } from 'pg';
import { config } from '../config/env';

const connectionString = config.DATABASE_URL || process.env.DATABASE_URL;

const isSslRequired = Boolean(
  connectionString && (
    connectionString.includes('neon.tech') ||
    connectionString.includes('sslmode=require') ||
    config.NODE_ENV === 'production' ||
    process.env.DB_SSL === 'true'
  )
);

const poolConfig: PoolConfig = connectionString
  ? {
      connectionString,
      ssl: isSslRequired ? { rejectUnauthorized: false } : undefined,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    }
  : {
      host: config.DB_HOST,
      port: config.DB_PORT,
      database: config.DB_NAME,
      user: config.DB_USER,
      password: config.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

export const pool = new Pool(poolConfig);

// Catch unexpected errors on idle database connections to prevent process crashes
pool.on('error', (err: Error) => {
  console.error('[PostgreSQL Pool Error] Unexpected idle client error:', err.message);
});

// Helper for single query execution with connection release
export const query = (text: string, params?: any[]) => pool.query(text, params);
