import { describe, it, expect, beforeEach, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { pool } from '../src/db/pool';
import { config } from '../src/config/env';
import { authenticate, AuthRequest } from '../src/middleware/auth.middleware';

describe('Phase 3: Authentication & Mock OTP Flow', () => {
  const testPhone = '+919999990001';
  const testPhone2 = '+919999990002';
  let consoleLogSpy: any;

  beforeAll(async () => {
    // Suppress mock OTP terminal logs during tests to keep test output clean and secure
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Mount a temporary test endpoint to verify the authenticate middleware
    app.get('/test-auth-guard', authenticate, (req: AuthRequest, res) => {
      res.status(200).json({ status: 'success', user: req.user });
    });
  });

  afterAll(async () => {
    consoleLogSpy.mockRestore();
    // Clean up test data
    await pool.query("DELETE FROM otp_codes WHERE phone IN ($1, $2)", [testPhone, testPhone2]).catch(() => {});
    await pool.query("DELETE FROM users WHERE phone IN ($1, $2)", [testPhone, testPhone2]).catch(() => {});
    await pool.end().catch(() => {});
  });

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    // Clean up OTP codes for test phones before each test
    await pool.query("DELETE FROM otp_codes WHERE phone IN ($1, $2)", [testPhone, testPhone2]).catch(() => {});
    await pool.query("DELETE FROM users WHERE phone IN ($1, $2)", [testPhone, testPhone2]).catch(() => {});
  });

  describe('POST /api/auth/request-otp', () => {
    it('should reject request with missing or invalid phone number', async () => {
      const missingRes = await request(app)
        .post('/api/auth/request-otp')
        .send({});

      expect(missingRes.status).toBe(400);
      expect(missingRes.body.error).toBe('Validation failed');

      const invalidRes = await request(app)
        .post('/api/auth/request-otp')
        .send({ phone: '123' });

      expect(invalidRes.status).toBe(400);
      expect(invalidRes.body.error).toBe('Validation failed');

      const alphaRes = await request(app)
        .post('/api/auth/request-otp')
        .send({ phone: '98765abcde' });

      expect(alphaRes.status).toBe(400);
      expect(alphaRes.body.error).toBe('Validation failed');

      const zeroRes = await request(app)
        .post('/api/auth/request-otp')
        .send({ phone: '0000000000' });

      expect(zeroRes.status).toBe(400);
      expect(zeroRes.body.error).toBe('Validation failed');
    });

    it('should generate and store hashed OTP, returning success without revealing OTP in response', async () => {
      const res = await request(app)
        .post('/api/auth/request-otp')
        .send({ phone: testPhone });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'OTP sent successfully' });
      // Crucial: OTP must never be leaked in API response
      expect(res.body.otp).toBeUndefined();

      // Verify OTP record exists in DB with hashed value
      const dbRes = await pool.query('SELECT * FROM otp_codes WHERE phone = $1', [testPhone]);
      expect(dbRes.rows.length).toBe(1);
      expect(dbRes.rows[0].otp_hash).toBeDefined();
      expect(dbRes.rows[0].otp_hash).not.toMatch(/^\d{6}$/); // Hashed, not plain
      expect(new Date(dbRes.rows[0].expires_at).getTime()).toBeGreaterThan(Date.now());
    });

    it('should enforce rate limiting on repeated OTP requests within cooldown', async () => {
      // First request
      const firstRes = await request(app)
        .post('/api/auth/request-otp')
        .send({ phone: testPhone });
      expect(firstRes.status).toBe(200);

      // Immediate second request
      const secondRes = await request(app)
        .post('/api/auth/request-otp')
        .send({ phone: testPhone });

      expect(secondRes.status).toBe(429);
      expect(secondRes.body.error).toMatch(/Rate limit exceeded/i);
    });
  });

  describe('POST /api/auth/verify-otp', () => {
    it('should reject invalid request body format', async () => {
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: testPhone, otp: '12' }); // Not 6 digits

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');

      const alphaOtpRes = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: testPhone, otp: '12a456' });

      expect(alphaOtpRes.status).toBe(400);
      expect(alphaOtpRes.body.error).toBe('Validation failed');

      const emptyRes = await request(app)
        .post('/api/auth/verify-otp')
        .send({});

      expect(emptyRes.status).toBe(400);
      expect(emptyRes.body.error).toBe('Validation failed');
    });

    it('should reject verification when no OTP was requested', async () => {
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: testPhone, otp: '123456' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/No active OTP request found/i);
    });

    it('should reject incorrect OTP', async () => {
      // Mock crypto to generate a known OTP
      const cryptoSpy = jest.spyOn(crypto, 'randomInt').mockReturnValue(654321 as any);

      await request(app)
        .post('/api/auth/request-otp')
        .send({ phone: testPhone });

      cryptoSpy.mockRestore();

      // Submit incorrect OTP
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: testPhone, otp: '111111' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid OTP/i);
    });

    it('should reject expired OTP and delete it', async () => {
      const cryptoSpy = jest.spyOn(crypto, 'randomInt').mockReturnValue(654321 as any);

      await request(app)
        .post('/api/auth/request-otp')
        .send({ phone: testPhone });

      cryptoSpy.mockRestore();

      // Artificially expire the OTP in the database
      await pool.query(
        "UPDATE otp_codes SET expires_at = NOW() - INTERVAL '1 minute' WHERE phone = $1",
        [testPhone]
      );

      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: testPhone, otp: '654321' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/OTP has expired/i);

      // Verify record is deleted
      const checkRes = await pool.query('SELECT * FROM otp_codes WHERE phone = $1', [testPhone]);
      expect(checkRes.rows.length).toBe(0);
    });

    it('should successfully verify OTP, create user, issue JWT, and consume OTP', async () => {
      const fixedOtp = 556677;
      const cryptoSpy = jest.spyOn(crypto, 'randomInt').mockReturnValue(fixedOtp as any);

      await request(app)
        .post('/api/auth/request-otp')
        .send({ phone: testPhone });

      cryptoSpy.mockRestore();

      const verifyRes = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: testPhone, otp: fixedOtp.toString() });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.token).toBeDefined();
      expect(verifyRes.body.user).toBeDefined();
      expect(verifyRes.body.user.phone).toBe(testPhone);
      expect(verifyRes.body.user.id).toBeDefined();

      // Verify JWT payload
      const decoded = jwt.verify(verifyRes.body.token, config.JWT_SECRET) as any;
      expect(decoded.userId).toBe(verifyRes.body.user.id);
      expect(decoded.phone).toBe(testPhone);

      // Verify OTP is consumed and deleted to prevent replay
      const otpCheck = await pool.query('SELECT * FROM otp_codes WHERE phone = $1', [testPhone]);
      expect(otpCheck.rows.length).toBe(0);

      // Test OTP reuse prevention
      const reuseRes = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: testPhone, otp: fixedOtp.toString() });

      expect(reuseRes.status).toBe(400);
      expect(reuseRes.body.error).toMatch(/No active OTP request found/i);
    });
  });

  describe('Authentication Middleware (Guard)', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/test-auth-guard');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Missing or invalid Bearer token/i);
    });

    it('should return 401 when token is malformed or invalid', async () => {
      const res = await request(app)
        .get('/test-auth-guard')
        .set('Authorization', 'Bearer invalid.jwt.token');

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Invalid authentication token/i);
    });

    it('should allow request with valid JWT and attach user context', async () => {
      const validToken = jwt.sign(
        { userId: 42, phone: testPhone },
        config.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/test-auth-guard')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.user).toEqual({
        userId: 42,
        phone: testPhone,
      });
    });
  });
});
