import { describe, it, expect, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db/pool';

describe('Health Endpoints', () => {
  afterAll(async () => {
    await pool.end().catch(() => {});
  });

  describe('GET /health', () => {
    it('should return 200 and status ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('miniledger-backend');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('GET /health/db', () => {
    it('should return 200 when database query succeeds', async () => {
      const mockDbTime = new Date().toISOString();
      const querySpy = jest.spyOn(pool, 'query' as any).mockImplementation((() => {
        return Promise.resolve({
          rows: [{ db_time: mockDbTime }],
        });
      }) as any);

      const res = await request(app).get('/health/db');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'ok',
        database: 'connected',
        dbTime: mockDbTime,
      });

      querySpy.mockRestore();
    });

    it('should return 503 when database query fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const querySpy = jest.spyOn(pool, 'query' as any).mockImplementation((() => {
        return Promise.reject(new Error('Connection refused'));
      }) as any);

      const res = await request(app).get('/health/db');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('error');
      expect(res.body.database).toBe('disconnected');

      querySpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });
});
