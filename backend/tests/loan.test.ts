import { describe, it, expect, beforeEach, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { pool } from '../src/db/pool';
import { config } from '../src/config/env';

describe('Phase 4: Loan Management & Summary Calculations', () => {
  const phoneUserA = '+919999990010';
  const phoneUserB = '+919999990020';
  let userAId: number;
  let userBId: number;
  let tokenUserA: string;
  let tokenUserB: string;

  beforeAll(async () => {
    // 1. Clean up any previous test records
    await pool.query("DELETE FROM users WHERE phone IN ($1, $2)", [phoneUserA, phoneUserB]);

    // 2. Create User A and User B
    const resA = await pool.query(
      'INSERT INTO users (phone) VALUES ($1) RETURNING id, phone',
      [phoneUserA]
    );
    userAId = resA.rows[0].id;
    tokenUserA = jwt.sign({ userId: userAId, phone: phoneUserA }, config.JWT_SECRET, {
      expiresIn: '1h',
    });

    const resB = await pool.query(
      'INSERT INTO users (phone) VALUES ($1) RETURNING id, phone',
      [phoneUserB]
    );
    userBId = resB.rows[0].id;
    tokenUserB = jwt.sign({ userId: userBId, phone: phoneUserB }, config.JWT_SECRET, {
      expiresIn: '1h',
    });
  });

  afterAll(async () => {
    // Clean up test users and their loans (ON DELETE CASCADE)
    await pool.query("DELETE FROM loans WHERE user_id IN ($1, $2)", [userAId, userBId]).catch(() => {});
    await pool.query("DELETE FROM users WHERE phone IN ($1, $2)", [phoneUserA, phoneUserB]).catch(() => {});
    await pool.end().catch(() => {});
  });

  beforeEach(async () => {
    // Clear loans for test users before each test
    await pool.query('DELETE FROM loans WHERE user_id IN ($1, $2)', [userAId, userBId]);
  });

  describe('Authentication Enforcement', () => {
    it('should reject GET /api/loans without auth token', async () => {
      const res = await request(app).get('/api/loans');
      expect(res.status).toBe(401);
    });

    it('should reject POST /api/loans without auth token', async () => {
      const res = await request(app).post('/api/loans').send({
        friendName: 'Rahul',
        amount: 500,
        dueDate: '2026-11-01',
      });
      expect(res.status).toBe(401);
    });

    it('should reject PATCH /api/loans/:id/repay without auth token', async () => {
      const res = await request(app).patch('/api/loans/1/repay');
      expect(res.status).toBe(401);
    });

    it('should reject GET /api/summary without auth token', async () => {
      const res = await request(app).get('/api/summary');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/loans — Create Loan', () => {
    it('should successfully create a loan for authenticated user', async () => {
      const payload = {
        friendName: 'Aarav Sharma',
        amount: 1500.5,
        dueDate: '2026-11-15',
      };

      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.userId).toBe(userAId);
      expect(res.body.friendName).toBe('Aarav Sharma');
      expect(res.body.amount).toBe('1500.50');
      expect(res.body.dueDate).toBe('2026-11-15');
      expect(res.body.isRepaid).toBe(false);
      expect(res.body.repaidAt).toBeNull();
      expect(res.body.createdAt).toBeDefined();
    });

    it('should reject missing or empty friend name', async () => {
      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          friendName: '   ',
          amount: 500,
          dueDate: '2026-11-15',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should reject zero or negative amount', async () => {
      const zeroRes = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          friendName: 'Rohan',
          amount: 0,
          dueDate: '2026-11-15',
        });

      expect(zeroRes.status).toBe(400);

      const negativeRes = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          friendName: 'Rohan',
          amount: -250,
          dueDate: '2026-11-15',
        });

      expect(negativeRes.status).toBe(400);
    });

    it('should reject invalid due date format', async () => {
      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          friendName: 'Rohan',
          amount: 300,
          dueDate: '15-11-2026', // Wrong format
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should reject non-finite amount such as Infinity', async () => {
      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          friendName: 'Rohan',
          amount: Infinity,
          dueDate: '2026-11-15',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should successfully accept valid past calendar date 2026-10-09', async () => {
      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          friendName: 'Arjun Verma',
          amount: 1500,
          dueDate: '2026-10-09',
        });

      expect(res.status).toBe(201);
      expect(res.body.friendName).toBe('Arjun Verma');
      expect(res.body.dueDate).toBe('2026-10-09');
    });

    it('should successfully accept a valid leap-year date such as 2028-02-29', async () => {
      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          friendName: 'Leap Year Borrower',
          amount: 2500,
          dueDate: '2028-02-29',
        });

      expect(res.status).toBe(201);
      expect(res.body.dueDate).toBe('2028-02-29');
    });

    it('should reject invalid calendar dates such as 2026-02-31', async () => {
      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          friendName: 'Rohan',
          amount: 500,
          dueDate: '2026-02-31',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should reject non-leap year February 29th such as 2026-02-29', async () => {
      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          friendName: 'Rohan',
          amount: 500,
          dueDate: '2026-02-29',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should reject invalid calendar dates with 31 days in a 30-day month like 2026-04-31', async () => {
      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          friendName: 'Rohan',
          amount: 500,
          dueDate: '2026-04-31',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should reject non-numeric amount types', async () => {
      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          friendName: 'Rohan',
          amount: 'five hundred',
          dueDate: '2026-11-15',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should reject amounts exceeding maximum limit', async () => {
      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          friendName: 'Rohan',
          amount: 1000000001,
          dueDate: '2026-11-15',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });
  });

  describe('GET /api/loans — List & Prioritization', () => {
    it('should list only user loans and prioritize overdue unpaid loans first', async () => {
      // 1. Insert an overdue unpaid loan (due yesterday)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ friendName: 'Overdue Friend', amount: 400, dueDate: yesterday });

      // 2. Insert an upcoming unpaid loan (due next week)
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ friendName: 'Upcoming Friend', amount: 800, dueDate: nextWeek });

      // 3. Insert and repay a loan
      const repaidRes = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ friendName: 'Repaid Friend', amount: 600, dueDate: nextWeek });
      await request(app)
        .patch(`/api/loans/${repaidRes.body.id}/repay`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      // Query loans
      const listRes = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.length).toBe(3);

      // Verify ordering: Overdue unpaid first, upcoming unpaid second, repaid last
      expect(listRes.body[0].friendName).toBe('Overdue Friend');
      expect(listRes.body[0].isRepaid).toBe(false);

      expect(listRes.body[1].friendName).toBe('Upcoming Friend');
      expect(listRes.body[1].isRepaid).toBe(false);

      expect(listRes.body[2].friendName).toBe('Repaid Friend');
      expect(listRes.body[2].isRepaid).toBe(true);
    });

    it('should strictly isolate loans across different users', async () => {
      // User A creates a loan
      await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ friendName: 'User A Friend', amount: 1000, dueDate: '2026-11-20' });

      // User B fetches their loans — should be empty
      const listResB = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${tokenUserB}`);

      expect(listResB.status).toBe(200);
      expect(listResB.body).toEqual([]);
    });
  });

  describe('PATCH /api/loans/:id/repay — Repayment', () => {
    it('should mark loan as repaid with timestamp', async () => {
      const createRes = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ friendName: 'Devika', amount: 750, dueDate: '2026-12-01' });

      const loanId = createRes.body.id;

      const repayRes = await request(app)
        .patch(`/api/loans/${loanId}/repay`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(repayRes.status).toBe(200);
      expect(repayRes.body.id).toBe(loanId);
      expect(repayRes.body.isRepaid).toBe(true);
      expect(repayRes.body.repaidAt).not.toBeNull();
    });

    it('should prevent duplicate repayment', async () => {
      const createRes = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ friendName: 'Karan', amount: 500, dueDate: '2026-12-01' });

      const loanId = createRes.body.id;

      // First repayment
      const firstRepay = await request(app)
        .patch(`/api/loans/${loanId}/repay`)
        .set('Authorization', `Bearer ${tokenUserA}`);
      expect(firstRepay.status).toBe(200);

      // Duplicate repayment attempt
      const secondRepay = await request(app)
        .patch(`/api/loans/${loanId}/repay`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(secondRepay.status).toBe(400);
      expect(secondRepay.body.error).toMatch(/already been marked as repaid/i);
    });

    it('should prevent User B from repaying User A loan (Ownership Isolation)', async () => {
      const createRes = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ friendName: 'User A Secret Friend', amount: 2000, dueDate: '2026-12-01' });

      const loanId = createRes.body.id;

      // User B attempts to repay User A's loan
      const unauthorizedRepay = await request(app)
        .patch(`/api/loans/${loanId}/repay`)
        .set('Authorization', `Bearer ${tokenUserB}`);

      expect(unauthorizedRepay.status).toBe(403);
      expect(unauthorizedRepay.body.error).toMatch(/permission to modify this loan/i);
    });

    it('should return 404 for non-existent loan ID', async () => {
      const res = await request(app)
        .patch('/api/loans/999999/repay')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/Loan not found/i);
    });

    it('should return 400 for invalid loan ID parameter', async () => {
      const res = await request(app)
        .patch('/api/loans/invalid-id/repay')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid loan ID/i);

      const floatRes = await request(app)
        .patch('/api/loans/1.5/repay')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(floatRes.status).toBe(400);
      expect(floatRes.body.error).toMatch(/Invalid loan ID/i);

      const negRes = await request(app)
        .patch('/api/loans/-5/repay')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(negRes.status).toBe(400);
      expect(negRes.body.error).toMatch(/Invalid loan ID/i);
    });
  });

  describe('GET /api/summary — Summary Calculations', () => {
    it('should return zero values for user with no loans', async () => {
      const res = await request(app)
        .get('/api/summary')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        totalLent: '0.00',
        totalRepaid: '0.00',
        totalOutstanding: '0.00',
        overdueAmount: '0.00',
        totalLoans: 0,
        repaidLoans: 0,
        pendingLoans: 0,
      });
    });

    it('should accurately calculate totalLent, totalRepaid, totalOutstanding, and overdueAmount', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // 1. Overdue unpaid loan: ₹500.00
      await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ friendName: 'Overdue Friend', amount: 500, dueDate: yesterday });

      // 2. Upcoming unpaid loan: ₹1000.00
      await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ friendName: 'Upcoming Friend', amount: 1000, dueDate: nextMonth });

      // 3. Repaid loan: ₹300.00
      const repaidRes = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ friendName: 'Repaid Friend', amount: 300, dueDate: nextMonth });

      await request(app)
        .patch(`/api/loans/${repaidRes.body.id}/repay`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      // Query Summary
      const summaryRes = await request(app)
        .get('/api/summary')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body).toEqual({
        totalLent: '1800.00',       // 500 + 1000 + 300
        totalRepaid: '300.00',      // 300
        totalOutstanding: '1500.00', // 500 + 1000
        overdueAmount: '500.00',    // 500 (overdue date passed)
        totalLoans: 3,
        repaidLoans: 1,
        pendingLoans: 2,
      });
    });

    it('should accurately reflect zero outstanding balance when all loans are settled', async () => {
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Create and repay two loans
      const loan1 = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ friendName: 'Friend 1', amount: 250, dueDate: nextWeek });

      const loan2 = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ friendName: 'Friend 2', amount: 750, dueDate: nextWeek });

      await request(app)
        .patch(`/api/loans/${loan1.body.id}/repay`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      await request(app)
        .patch(`/api/loans/${loan2.body.id}/repay`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      const summaryRes = await request(app)
        .get('/api/summary')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(summaryRes.body).toEqual({
        totalLent: '1000.00',
        totalRepaid: '1000.00',
        totalOutstanding: '0.00',
        overdueAmount: '0.00',
        totalLoans: 2,
        repaidLoans: 2,
        pendingLoans: 0,
      });
    });

    it('should categorize past due date 2026-10-09 as overdue in summary calculation', async () => {
      // Create loan with past due date 2026-10-09
      await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          friendName: 'Past Due Borrower',
          amount: 3500,
          dueDate: '2026-10-09',
        });

      const summaryRes = await request(app)
        .get('/api/summary')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(summaryRes.status).toBe(200);
      expect(parseFloat(summaryRes.body.overdueAmount)).toBe(3500);
      expect(parseFloat(summaryRes.body.totalOutstanding)).toBe(3500);
      expect(summaryRes.body.pendingLoans).toBe(1);
    });
  });
});

