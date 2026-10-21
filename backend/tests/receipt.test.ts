import { describe, it, expect, beforeEach, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import { app } from '../src/app';
import { pool } from '../src/db/pool';
import { config } from '../src/config/env';
import { RECEIPTS_DIR } from '../src/middleware/upload.middleware';

describe('Bonus Feature: Loan Receipt Photo Upload & Isolation', () => {
  const phoneUserA = '+919888880001';
  const phoneUserB = '+919888880002';
  let userAId: number;
  let userBId: number;
  let tokenUserA: string;
  let tokenUserB: string;

  // Track created files to clean up from disk
  const createdTestFiles: string[] = [];

  beforeAll(async () => {
    // 1. Clean up existing users
    await pool.query('DELETE FROM users WHERE phone IN ($1, $2)', [phoneUserA, phoneUserB]);

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
    // Clean up test DB data
    await pool.query('DELETE FROM loans WHERE user_id IN ($1, $2)', [userAId, userBId]).catch(() => {});
    await pool.query('DELETE FROM users WHERE phone IN ($1, $2)', [phoneUserA, phoneUserB]).catch(() => {});
    await pool.end().catch(() => {});

    // Clean up any test receipt files written to RECEIPTS_DIR
    for (const filename of createdTestFiles) {
      const fullPath = path.join(RECEIPTS_DIR, filename);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch {}
      }
    }
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM loans WHERE user_id IN ($1, $2)', [userAId, userBId]);
  });

  describe('Receipt Upload Validations', () => {
    it('should reject receipt upload without authorization token', async () => {
      const res = await request(app)
        .post('/api/loans/1/receipt')
        .attach('receipt', Buffer.from('fake image'), 'receipt.jpg');

      expect(res.status).toBe(401);
    });

    it('should reject receipt upload with no file attached', async () => {
      // 1. Create a loan for User A
      const createRes = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          friendName: 'Rohan Verma',
          amount: 2500,
          dueDate: '2026-11-20',
        });
      const loanId = createRes.body.id;

      // 2. Post with empty form
      const res = await request(app)
        .post(`/api/loans/${loanId}/receipt`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Receipt image file is required');
    });

    it('should reject invalid file types (e.g. .txt or .pdf)', async () => {
      const createRes = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          friendName: 'Rohan Verma',
          amount: 2500,
          dueDate: '2026-11-20',
        });
      const loanId = createRes.body.id;

      const res = await request(app)
        .post(`/api/loans/${loanId}/receipt`)
        .set('Authorization', `Bearer ${tokenUserA}`)
        .attach('receipt', Buffer.from('plain text content'), 'invoice.txt');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid file type');
    });

    it('should reject oversized receipt files exceeding 5MB', async () => {
      const createRes = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          friendName: 'Rohan Verma',
          amount: 2500,
          dueDate: '2026-11-20',
        });
      const loanId = createRes.body.id;

      // Generate a buffer slightly larger than 5MB
      const oversizedBuffer = Buffer.alloc(5.2 * 1024 * 1024);

      const res = await request(app)
        .post(`/api/loans/${loanId}/receipt`)
        .set('Authorization', `Bearer ${tokenUserA}`)
        .attach('receipt', oversizedBuffer, {
          filename: 'huge_receipt.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/too large|exceeds 5MB/i);
    });
  });

  describe('Successful Upload and Retrieval Flow', () => {
    it('should successfully upload a JPEG receipt and associate it with the loan', async () => {
      // 1. Create loan
      const createRes = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          friendName: 'Priya Patel',
          amount: 8000,
          dueDate: '2026-12-01',
        });
      const loanId = createRes.body.id;
      expect(createRes.body.hasReceipt).toBe(false);

      // 2. Upload valid JPEG image buffer (fake JPEG header)
      const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

      const uploadRes = await request(app)
        .post(`/api/loans/${loanId}/receipt`)
        .set('Authorization', `Bearer ${tokenUserA}`)
        .attach('receipt', fakeJpeg, {
          filename: 'payment_slip.jpg',
          contentType: 'image/jpeg',
        });

      expect(uploadRes.status).toBe(200);
      expect(uploadRes.body.message).toContain('Receipt photo uploaded successfully');
      expect(uploadRes.body.loan.hasReceipt).toBe(true);

      // Check DB to record filename for cleanup
      const dbCheck = await pool.query('SELECT receipt_filename FROM loans WHERE id = $1', [loanId]);
      if (dbCheck.rows[0]?.receipt_filename) {
        createdTestFiles.push(dbCheck.rows[0].receipt_filename);
      }

      // 3. Verify GET /api/loans shows hasReceipt: true
      const listRes = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`);
      const found = listRes.body.find((l: any) => l.id === loanId);
      expect(found).toBeDefined();
      expect(found.hasReceipt).toBe(true);

      // 4. Retrieve receipt via GET /api/loans/:id/receipt
      const getRes = await request(app)
        .get(`/api/loans/${loanId}/receipt`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(getRes.status).toBe(200);
      expect(getRes.headers['content-type']).toContain('image/jpeg');
      expect(getRes.body).toEqual(fakeJpeg);
    });

    it('should successfully upload a PNG receipt', async () => {
      // 1. Create loan
      const createRes = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          friendName: 'Ananya Roy',
          amount: 4500,
          dueDate: '2026-12-10',
        });
      const loanId = createRes.body.id;

      // 2. Fake PNG buffer
      const fakePng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      const uploadRes = await request(app)
        .post(`/api/loans/${loanId}/receipt`)
        .set('Authorization', `Bearer ${tokenUserA}`)
        .attach('receipt', fakePng, {
          filename: 'scanner_receipt.png',
          contentType: 'image/png',
        });

      expect(uploadRes.status).toBe(200);
      expect(uploadRes.body.loan.hasReceipt).toBe(true);

      const dbCheck = await pool.query('SELECT receipt_filename FROM loans WHERE id = $1', [loanId]);
      if (dbCheck.rows[0]?.receipt_filename) {
        createdTestFiles.push(dbCheck.rows[0].receipt_filename);
      }

      // Retrieve
      const getRes = await request(app)
        .get(`/api/loans/${loanId}/receipt`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(getRes.status).toBe(200);
      expect(getRes.headers['content-type']).toContain('image/png');
    });

    it('should successfully upload a browser Blob without filename extension (e.g. filename "blob")', async () => {
      // 1. Create loan
      const createRes = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          friendName: 'Deepak Joshi',
          amount: 6000,
          dueDate: '2026-12-15',
        });
      const loanId = createRes.body.id;

      // 2. Web browser FormData sends filename 'blob' with image/jpeg mimetype
      const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02]);

      const uploadRes = await request(app)
        .post(`/api/loans/${loanId}/receipt`)
        .set('Authorization', `Bearer ${tokenUserA}`)
        .attach('receipt', fakeJpeg, {
          filename: 'blob', // Simulating browser Blob upload without .jpg/.png extension
          contentType: 'image/jpeg',
        });

      expect(uploadRes.status).toBe(200);
      expect(uploadRes.body.loan.hasReceipt).toBe(true);

      const dbCheck = await pool.query('SELECT receipt_filename FROM loans WHERE id = $1', [loanId]);
      const savedFilename = dbCheck.rows[0]?.receipt_filename;
      expect(savedFilename).toBeDefined();
      expect(savedFilename).toMatch(/\.jpg$/);
      if (savedFilename) {
        createdTestFiles.push(savedFilename);
      }

      // Verify list endpoint reports hasReceipt: true
      const listRes = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`);
      const loanInList = listRes.body.find((l: any) => l.id === loanId);
      expect(loanInList.hasReceipt).toBe(true);

      // Verify retrieval works
      const getRes = await request(app)
        .get(`/api/loans/${loanId}/receipt`)
        .set('Authorization', `Bearer ${tokenUserA}`);
      expect(getRes.status).toBe(200);
      expect(getRes.headers['content-type']).toContain('image/jpeg');
    });

    it('should clean up old file when a receipt is replaced with a new one', async () => {
      // 1. Create loan
      const createRes = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          friendName: 'Suresh Kumar',
          amount: 3500,
          dueDate: '2026-11-28',
        });
      const loanId = createRes.body.id;

      // 2. First upload (JPEG)
      const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      await request(app)
        .post(`/api/loans/${loanId}/receipt`)
        .set('Authorization', `Bearer ${tokenUserA}`)
        .attach('receipt', fakeJpeg, { filename: 'first_receipt.jpg', contentType: 'image/jpeg' });

      const firstCheck = await pool.query('SELECT receipt_filename FROM loans WHERE id = $1', [loanId]);
      const firstFilename = firstCheck.rows[0].receipt_filename;
      const firstPath = path.resolve(RECEIPTS_DIR, firstFilename);
      expect(fs.existsSync(firstPath)).toBe(true);

      // 3. Second upload (PNG) replaces the first
      const fakePng = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      await request(app)
        .post(`/api/loans/${loanId}/receipt`)
        .set('Authorization', `Bearer ${tokenUserA}`)
        .attach('receipt', fakePng, { filename: 'second_receipt.png', contentType: 'image/png' });

      const secondCheck = await pool.query('SELECT receipt_filename FROM loans WHERE id = $1', [loanId]);
      const secondFilename = secondCheck.rows[0].receipt_filename;
      const secondPath = path.resolve(RECEIPTS_DIR, secondFilename);

      expect(secondFilename).not.toBe(firstFilename);
      expect(fs.existsSync(secondPath)).toBe(true);
      // Verify first file was unlinked from disk
      expect(fs.existsSync(firstPath)).toBe(false);

      createdTestFiles.push(secondFilename);
    });
  });

  describe('Security & Row-Level Ownership Isolation', () => {
    it('should prevent User B from uploading a receipt to User A loan (HTTP 403)', async () => {
      // User A creates a loan
      const createRes = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          friendName: 'Private Loan User A',
          amount: 15000,
          dueDate: '2026-11-25',
        });
      const loanId = createRes.body.id;

      // User B attempts to upload receipt to User A's loan
      const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      const res = await request(app)
        .post(`/api/loans/${loanId}/receipt`)
        .set('Authorization', `Bearer ${tokenUserB}`)
        .attach('receipt', fakeJpeg, {
          filename: 'intruder.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden');
    });

    it('should prevent User B from viewing User A receipt (HTTP 403)', async () => {
      // User A creates loan & uploads receipt
      const createRes = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          friendName: 'Confidential Borrower',
          amount: 20000,
          dueDate: '2026-12-25',
        });
      const loanId = createRes.body.id;

      const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      await request(app)
        .post(`/api/loans/${loanId}/receipt`)
        .set('Authorization', `Bearer ${tokenUserA}`)
        .attach('receipt', fakeJpeg, {
          filename: 'confidential_receipt.jpg',
          contentType: 'image/jpeg',
        });

      const dbCheck = await pool.query('SELECT receipt_filename FROM loans WHERE id = $1', [loanId]);
      if (dbCheck.rows[0]?.receipt_filename) {
        createdTestFiles.push(dbCheck.rows[0].receipt_filename);
      }

      // User B attempts to view User A's receipt
      const res = await request(app)
        .get(`/api/loans/${loanId}/receipt`)
        .set('Authorization', `Bearer ${tokenUserB}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden');
    });

    it('should return 404 if loan has no attached receipt', async () => {
      const createRes = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          friendName: 'No Receipt Loan',
          amount: 1000,
          dueDate: '2026-11-30',
        });
      const loanId = createRes.body.id;

      const res = await request(app)
        .get(`/api/loans/${loanId}/receipt`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('No receipt attached');
    });

    it('should return 404 when requesting receipt for non-existent loan ID', async () => {
      const res = await request(app)
        .get('/api/loans/999999/receipt')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Loan not found');
    });

    it('should return 400 for invalid loan ID parameter', async () => {
      const res = await request(app)
        .get('/api/loans/invalid_id/receipt')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid loan ID parameter');
    });
  });
});
