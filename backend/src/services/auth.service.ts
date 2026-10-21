import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool';
import { config } from '../config/env';
import { AppError } from '../middleware/error.middleware';

export interface AuthResponse {
  token: string;
  user: {
    id: number;
    phone: string;
    createdAt: Date | string;
    isDemo?: boolean;
  };
}

export const DEMO_PHONE = '+910000000000';

export interface DemoSeedLoan {
  friendName: string;
  amount: number;
  daysOffset: number; // Positive = future due date (pending), Negative = past due date (overdue)
  isRepaid: boolean;
  repaidDaysAgo?: number;
}

export const DEMO_SAMPLE_LOANS: DemoSeedLoan[] = [
  {
    friendName: 'Rohan Sharma (Demo)',
    amount: 7500.0,
    daysOffset: 10, // Due in 10 days (Pending)
    isRepaid: false,
  },
  {
    friendName: 'Neha Gupta (Demo)',
    amount: 12000.0,
    daysOffset: -5, // Due 5 days ago (Overdue - prioritized in red)
    isRepaid: false,
  },
  {
    friendName: 'Vikram Malhotra (Demo)',
    amount: 4500.0,
    daysOffset: -15, // Due 15 days ago, Repaid 12 days ago (Repaid)
    isRepaid: true,
    repaidDaysAgo: 12,
  },
  {
    friendName: 'Pooja Mehta (Demo)',
    amount: 3200.0,
    daysOffset: 25, // Due in 25 days (Pending)
    isRepaid: false,
  },
];

export class AuthService {
  /**
   * Generates a cryptographically secure 6-digit OTP, hashes it,
   * stores it in the database with an expiry timestamp, and logs it to the terminal.
   */
  static async requestOtp(phone: string): Promise<{ message: string }> {
    const normalizedPhone = phone.trim();

    // 1. Rate limiting check (cooldown of 60 seconds per phone)
    const recentOtpRes = await pool.query(
      'SELECT created_at FROM otp_codes WHERE phone = $1 ORDER BY created_at DESC LIMIT 1',
      [normalizedPhone]
    );

    if (recentOtpRes.rows.length > 0) {
      const lastCreatedAt = new Date(recentOtpRes.rows[0].created_at).getTime();
      const elapsedMs = Date.now() - lastCreatedAt;
      const cooldownMs = 60 * 1000;

      if (elapsedMs < cooldownMs) {
        const remainingSec = Math.ceil((cooldownMs - elapsedMs) / 1000);
        throw new AppError(
          429,
          `Rate limit exceeded: Please wait ${remainingSec} seconds before requesting a new OTP.`
        );
      }
    }

    // 2. Invalidate any previous OTPs for this phone number
    await pool.query('DELETE FROM otp_codes WHERE phone = $1', [normalizedPhone]);

    // 3. Generate a cryptographically secure 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();

    // 4. Hash the OTP using bcrypt
    const saltRounds = 10;
    const otpHash = await bcrypt.hash(otp, saltRounds);

    // 5. Calculate expiry timestamp
    const expiresAt = new Date(Date.now() + config.OTP_EXPIRY_MINUTES * 60 * 1000);

    // 6. Store hashed OTP in database
    await pool.query(
      'INSERT INTO otp_codes (phone, otp_hash, expires_at) VALUES ($1, $2, $3)',
      [normalizedPhone, otpHash, expiresAt]
    );

    // 7. Mock demonstration: Log OTP to server terminal only (NEVER return in API response)
    console.log(
      `[MiniLedger Mock OTP] Phone: ${normalizedPhone} | Code: ${otp} (Valid for ${config.OTP_EXPIRY_MINUTES} min)`
    );

    return { message: 'OTP sent successfully' };
  }

  /**
   * Verifies the submitted OTP against the stored hash, creates user if first-time,
   * invalidates the OTP to prevent replay, and issues a JWT token.
   */
  static async verifyOtp(phone: string, otp: string): Promise<AuthResponse> {
    const normalizedPhone = phone.trim();
    const normalizedOtp = otp.trim();

    // 1. Fetch active OTP record
    const otpRes = await pool.query(
      'SELECT id, otp_hash, expires_at FROM otp_codes WHERE phone = $1 ORDER BY created_at DESC LIMIT 1',
      [normalizedPhone]
    );

    if (otpRes.rows.length === 0) {
      throw new AppError(400, 'No active OTP request found. Please request an OTP first.');
    }

    const { otp_hash, expires_at } = otpRes.rows[0];

    // 2. Check expiry
    const now = new Date();
    if (now > new Date(expires_at)) {
      // Invalidate expired OTP
      await pool.query('DELETE FROM otp_codes WHERE phone = $1', [normalizedPhone]);
      throw new AppError(400, 'OTP has expired. Please request a new OTP.');
    }

    // 3. Compare submitted OTP against hash
    const isMatch = await bcrypt.compare(normalizedOtp, otp_hash);
    if (!isMatch) {
      throw new AppError(400, 'Invalid OTP. Please check the 6-digit code and try again.');
    }

    // 4. Invalidate/consume OTP to prevent reuse
    await pool.query('DELETE FROM otp_codes WHERE phone = $1', [normalizedPhone]);

    // 5. Find or create user
    let user: { id: number; phone: string; created_at: Date };
    const userRes = await pool.query(
      'SELECT id, phone, created_at FROM users WHERE phone = $1',
      [normalizedPhone]
    );

    if (userRes.rows.length > 0) {
      user = userRes.rows[0];
    } else {
      const insertUserRes = await pool.query(
        'INSERT INTO users (phone) VALUES ($1) RETURNING id, phone, created_at',
        [normalizedPhone]
      );
      user = insertUserRes.rows[0];
    }

    // 6. Sign JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        phone: user.phone,
      },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN as any }
    );

    return {
      token,
      user: {
        id: user.id,
        phone: user.phone,
        createdAt: user.created_at,
      },
    };
  }

  /**
   * One-click demo login for recruiters and evaluators.
   * Signs in a dedicated demo user, seeds realistic sample loans without duplicating them,
   * and returns a signed JWT token without requiring OTP or terminal access.
   */
  static async demoLogin(): Promise<AuthResponse> {
    // 1. Find or create the dedicated demo user
    let demoUser: { id: number; phone: string; created_at: Date };
    const userRes = await pool.query(
      'SELECT id, phone, created_at FROM users WHERE phone = $1',
      [DEMO_PHONE]
    );

    if (userRes.rows.length > 0) {
      demoUser = userRes.rows[0];
    } else {
      const insertUserRes = await pool.query(
        'INSERT INTO users (phone) VALUES ($1) RETURNING id, phone, created_at',
        [DEMO_PHONE]
      );
      demoUser = insertUserRes.rows[0];
    }

    // 2. Ensure initial demo dataset is present without duplicating rows on repeat logins
    const countRes = await pool.query(
      'SELECT COUNT(*)::int AS count FROM loans WHERE user_id = $1',
      [demoUser.id]
    );
    const existingCount = countRes.rows[0]?.count || 0;

    if (existingCount === 0) {
      await AuthService.seedDemoLoans(demoUser.id);
    }

    // 3. Issue signed JWT token with isDemo flag
    const token = jwt.sign(
      {
        userId: demoUser.id,
        phone: demoUser.phone,
        isDemo: true,
      },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN as any }
    );

    return {
      token,
      user: {
        id: demoUser.id,
        phone: demoUser.phone,
        createdAt: demoUser.created_at,
        isDemo: true,
      },
    };
  }

  /**
   * Seeds clean, realistic sample loans for the specified user ID.
   */
  static async seedDemoLoans(userId: number): Promise<void> {
    for (const item of DEMO_SAMPLE_LOANS) {
      const dueDate = new Date(Date.now() + item.daysOffset * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      const repaidAt = item.repaidDaysAgo
        ? new Date(Date.now() - item.repaidDaysAgo * 24 * 60 * 60 * 1000).toISOString()
        : null;

      await pool.query(
        `INSERT INTO loans (user_id, friend_name, amount, due_date, is_repaid, repaid_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, item.friendName, item.amount, dueDate, item.isRepaid, repaidAt]
      );
    }
  }

  private static lastDemoResetTime = 0;

  /**
   * Resets the demo account ledger to its pristine initial sample state.
   * Strictly enforces that only the demo user account can trigger this operation.
   */
  static async resetDemoData(userId: number): Promise<{ message: string }> {
    const userCheck = await pool.query('SELECT phone FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0 || userCheck.rows[0].phone !== DEMO_PHONE) {
      throw new AppError(403, 'Forbidden: Only the demo account ledger can be reset.');
    }

    // Rate-limiting protection: prevent rapid reset spam within 2 seconds
    const now = Date.now();
    if (now - AuthService.lastDemoResetTime < 2000) {
      return { message: 'Demo ledger reset to initial sample state successfully.' };
    }
    AuthService.lastDemoResetTime = now;

    // Delete existing loans for demo user only
    await pool.query('DELETE FROM loans WHERE user_id = $1', [userId]);

    // Reseed pristine sample loans
    await AuthService.seedDemoLoans(userId);

    return { message: 'Demo ledger reset to initial sample state successfully.' };
  }
}
