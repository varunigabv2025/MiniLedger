import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { pool } from './db/pool';
import { authRouter } from './routes/auth.routes';
import { loanRouter } from './routes/loan.routes';
import { summaryRouter } from './routes/summary.routes';
import { errorHandler } from './middleware/error.middleware';

export const app: Application = express();

// Global Middlewares
app.use(cors());
app.use(express.json());

// Public Health Check Endpoints
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'miniledger-backend',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health/db', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT NOW() as db_time');
    res.status(200).json({
      status: 'ok',
      database: 'connected',
      dbTime: result.rows[0].db_time,
    });
  } catch (error: any) {
    console.error('[Health/DB Check Failed]:', error.message);
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      message: 'Database health check failed to connect or execute query',
    });
  }
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/loans', loanRouter);
app.use('/api/summary', summaryRouter);

// Global Error Handler
app.use(errorHandler);
