import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { pool } from '../src/db/pool';
import { config } from '../src/config/env';
import { DEMO_PHONE } from '../src/services/auth.service';

describe('Recruiter Demo Account Authentication & Isolation', () => {
  const realUserPhone = '+919876500001';
  let realUserId: number;
  let realUserToken: string;

  let demoUserId: number;
  let demoToken: string;

  beforeAll(async () => {
    // 1. Clean up demo user and test real user if already present
    await pool.query('DELETE FROM users WHERE phone IN ($1, $2)', [DEMO_PHONE, realUserPhone]);

    // 2. Create standard real user User A
    const userRes = await pool.query(
      'INSERT INTO users (phone) VALUES ($1) RETURNING id, phone',
      [realUserPhone]
    );
    realUserId = userRes.rows[0].id;
    realUserToken = jwt.sign(
      { userId: realUserId, phone: realUserPhone },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM loans WHERE user_id IN ($1, $2)', [demoUserId, realUserId]).catch(() => {});
    await pool.query('DELETE FROM users WHERE phone IN ($1, $2)', [DEMO_PHONE, realUserPhone]).catch(() => {});
    await pool.end().catch(() => {});
  });

  describe('POST /api/auth/demo-login', () => {
    it('should authenticate demo user without OTP, return valid JWT, and seed sample loans', async () => {
      const res = await request(app).post('/api/auth/demo-login');

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.phone).toBe(DEMO_PHONE);
      expect(res.body.user.isDemo).toBe(true);

      demoUserId = res.body.user.id;
      demoToken = res.body.token;

      // Verify token is validly signed and contains isDemo claim
      const decoded = jwt.verify(demoToken, config.JWT_SECRET) as any;
      expect(decoded.userId).toBe(demoUserId);
      expect(decoded.phone).toBe(DEMO_PHONE);
      expect(decoded.isDemo).toBe(true);

      // Verify exactly 4 initial sample loans are seeded
      const loanRes = await pool.query(
        'SELECT id, friend_name, is_repaid FROM loans WHERE user_id = $1',
        [demoUserId]
      );
      expect(loanRes.rows.length).toBe(4);
    });

    it('should NOT duplicate sample loans on repeated demo login requests', async () => {
      // Repeat login multiple times
      const res2 = await request(app).post('/api/auth/demo-login');
      expect(res2.status).toBe(200);
      expect(res2.body.user.phone).toBe(DEMO_PHONE);

      const res3 = await request(app).post('/api/auth/demo-login');
      expect(res3.status).toBe(200);

      // Verify count in database remains strictly 4 (no duplicates)
      const loanRes = await pool.query(
        'SELECT COUNT(*)::int as count FROM loans WHERE user_id = $1',
        [demoUserId]
      );
      expect(loanRes.rows[0].count).toBe(4);
    });
  });

  describe('Demo Ledger Data & Summary Calculations', () => {
    it('should list demo loans with overdue unpaid loans prioritized first', async () => {
      const res = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${demoToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(4);

      // First loan must be overdue unpaid loan
      const firstLoan = res.body[0];
      expect(firstLoan.friendName).toContain('Neha Gupta');
      expect(firstLoan.isRepaid).toBe(false);

      // Must have repaid loan with timestamp
      const repaidLoan = res.body.find((l: any) => l.friendName.includes('Vikram Malhotra'));
      expect(repaidLoan).toBeDefined();
      expect(repaidLoan.isRepaid).toBe(true);
      expect(repaidLoan.repaidAt).not.toBeNull();

      // Must have pending loans
      const pendingLoan = res.body.find((l: any) => l.friendName.includes('Rohan Sharma'));
      expect(pendingLoan).toBeDefined();
      expect(pendingLoan.isRepaid).toBe(false);
    });

    it('should accurately calculate summary metrics for the demo ledger', async () => {
      const res = await request(app)
        .get('/api/summary')
        .set('Authorization', `Bearer ${demoToken}`);

      expect(res.status).toBe(200);
      expect(parseFloat(res.body.totalLent)).toBe(27200);
      expect(parseFloat(res.body.totalRepaid)).toBe(4500);
      expect(parseFloat(res.body.totalOutstanding)).toBe(22700);
      expect(parseFloat(res.body.overdueAmount)).toBe(12000);
      expect(res.body.totalLoans).toBe(4);
      expect(res.body.repaidLoans).toBe(1);
      expect(res.body.pendingLoans).toBe(3);
    });
  });

  describe('Strict Row-Level Isolation between Demo & Real Users', () => {
    let realUserLoanId: number;
    let demoLoanId: number;

    beforeAll(async () => {
      // Create a private loan for the real user
      const createRes = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${realUserToken}`)
        .send({
          friendName: 'Confidential Real Borrower',
          amount: 50000,
          dueDate: '2026-12-31',
        });
      realUserLoanId = createRes.body.id;

      // Get one demo loan ID
      const demoLoansRes = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${demoToken}`);
      demoLoanId = demoLoansRes.body[0].id;
    });

    it('should not allow demo user to see real user loans', async () => {
      const res = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${demoToken}`);

      const foundPrivate = res.body.find((l: any) => l.id === realUserLoanId);
      expect(foundPrivate).toBeUndefined();
    });

    it('should not allow real user to see demo loans', async () => {
      const res = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${realUserToken}`);

      const foundDemo = res.body.find((l: any) => l.id === demoLoanId);
      expect(foundDemo).toBeUndefined();
      expect(res.body.length).toBe(1);
      expect(res.body[0].id).toBe(realUserLoanId);
    });

    it('should reject demo user attempting to repay real user loan (HTTP 403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/loans/${realUserLoanId}/repay`)
        .set('Authorization', `Bearer ${demoToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden');
    });

    it('should reject real user attempting to repay demo user loan (HTTP 403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/loans/${demoLoanId}/repay`)
        .set('Authorization', `Bearer ${realUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden');
    });

    it('should prevent regular non-demo user from resetting demo data (HTTP 403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/auth/demo-reset')
        .set('Authorization', `Bearer ${realUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden');
    });

    it('should reject unauthenticated request to POST /api/auth/demo-reset (HTTP 401)', async () => {
      const res = await request(app).post('/api/auth/demo-reset');
      expect(res.status).toBe(401);
    });
  });

  describe('Demo Reset Functionality (POST /api/auth/demo-reset)', () => {
    it('should allow demo user to add loans and then reset ledger back to initial sample state', async () => {
      // 1. Demo user creates a new loan
      const createRes = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${demoToken}`)
        .send({
          friendName: 'Recruiter Custom Test Loan',
          amount: 8888,
          dueDate: '2026-11-20',
        });
      expect(createRes.status).toBe(201);

      // Count is now 5
      const beforeResetRes = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${demoToken}`);
      expect(beforeResetRes.body.length).toBe(5);

      // 2. Demo user triggers reset
      const resetRes = await request(app)
        .post('/api/auth/demo-reset')
        .set('Authorization', `Bearer ${demoToken}`);

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.message).toContain('Demo ledger reset');

      // 3. Verify ledger is restored back to the pristine 4 sample loans
      const afterResetRes = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${demoToken}`);

      expect(afterResetRes.body.length).toBe(4);
      const customFound = afterResetRes.body.find((l: any) => l.friendName === 'Recruiter Custom Test Loan');
      expect(customFound).toBeUndefined();
    });
  });
});
