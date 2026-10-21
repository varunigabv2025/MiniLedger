import { app } from './app';
import { config } from './config/env';
import { pool } from './db/pool';

const server = app.listen(config.PORT, () => {
  console.log(`[MiniLedger] Backend listening on port ${config.PORT} (NODE_ENV: ${config.NODE_ENV})`);
});

const gracefulShutdown = async (signal: string) => {
  console.log(`[MiniLedger] Received ${signal}. Closing HTTP server and database pool...`);
  server.close(async () => {
    try {
      await pool.end();
      console.log('[MiniLedger] Database pool closed cleanly.');
      process.exit(0);
    } catch (err: any) {
      console.error('[MiniLedger] Error closing database pool:', err.message);
      process.exit(1);
    }
  });
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
