import path from 'path';
import fs from 'fs';
import { pool } from '../db/pool';
import { AppError } from '../middleware/error.middleware';
import { RECEIPTS_DIR } from '../middleware/upload.middleware';

export interface LoanRecord {
  id: number;
  userId: number;
  friendName: string;
  amount: string;
  dueDate: string;
  isRepaid: boolean;
  repaidAt: string | null;
  createdAt: string;
  hasReceipt: boolean;
}

export interface LoanSummary {
  totalLent: string;
  totalRepaid: string;
  totalOutstanding: string;
  overdueAmount: string;
  totalLoans: number;
  repaidLoans: number;
  pendingLoans: number;
}

export interface CreateLoanInput {
  friendName: string;
  amount: number;
  dueDate: string;
}

export class LoanService {
  /**
   * Creates a new peer loan scoped to the authenticated user.
   */
  static async createLoan(userId: number, input: CreateLoanInput): Promise<LoanRecord> {
    const friendName = input.friendName.trim();
    const amount = Number(input.amount.toFixed(2));
    const dueDate = input.dueDate.trim();

    if (amount <= 0) {
      throw new AppError(400, 'Amount must be a positive number greater than zero.');
    }

    const query = `
      INSERT INTO loans (user_id, friend_name, amount, due_date, is_repaid)
      VALUES ($1, $2, $3, $4, FALSE)
      RETURNING
        id,
        user_id AS "userId",
        friend_name AS "friendName",
        amount::text AS "amount",
        due_date::text AS "dueDate",
        is_repaid AS "isRepaid",
        repaid_at::text AS "repaidAt",
        created_at::text AS "createdAt",
        (receipt_filename IS NOT NULL) AS "hasReceipt";
    `;

    const result = await pool.query(query, [userId, friendName, amount, dueDate]);
    return result.rows[0];
  }

  /**
   * Retrieves all loans for the authenticated user, prioritized:
   * 1. Unpaid overdue loans first
   * 2. Unpaid upcoming loans second
   * 3. Repaid loans last
   */
  static async getLoans(userId: number): Promise<LoanRecord[]> {
    const query = `
      SELECT
        id,
        user_id AS "userId",
        friend_name AS "friendName",
        amount::text AS "amount",
        due_date::text AS "dueDate",
        is_repaid AS "isRepaid",
        repaid_at::text AS "repaidAt",
        created_at::text AS "createdAt",
        (receipt_filename IS NOT NULL) AS "hasReceipt"
      FROM loans
      WHERE user_id = $1
      ORDER BY
        CASE
          WHEN is_repaid = FALSE AND due_date < CURRENT_DATE THEN 0
          WHEN is_repaid = FALSE THEN 1
          ELSE 2
        END,
        due_date ASC,
        created_at DESC;
    `;

    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  /**
   * Marks a loan as repaid. Enforces row-level isolation and prevents duplicate repayment.
   */
  static async repayLoan(userId: number, loanId: number): Promise<LoanRecord> {
    // 1. Fetch loan to verify existence and ownership
    const checkQuery = `
      SELECT id, user_id, is_repaid
      FROM loans
      WHERE id = $1;
    `;

    const checkResult = await pool.query(checkQuery, [loanId]);

    if (checkResult.rows.length === 0) {
      throw new AppError(404, 'Loan not found.');
    }

    const existing = checkResult.rows[0];

    // 2. Ownership check: strictly isolate across users
    if (existing.user_id !== userId) {
      throw new AppError(403, 'Forbidden: You do not have permission to modify this loan.');
    }

    // 3. Duplicate repayment prevention
    if (existing.is_repaid) {
      throw new AppError(400, 'Loan has already been marked as repaid.');
    }

    // 4. Update loan status atomically
    const updateQuery = `
      UPDATE loans
      SET is_repaid = TRUE, repaid_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2 AND is_repaid = FALSE
      RETURNING
        id,
        user_id AS "userId",
        friend_name AS "friendName",
        amount::text AS "amount",
        due_date::text AS "dueDate",
        is_repaid AS "isRepaid",
        repaid_at::text AS "repaidAt",
        created_at::text AS "createdAt",
        (receipt_filename IS NOT NULL) AS "hasReceipt";
    `;

    const updateResult = await pool.query(updateQuery, [loanId, userId]);
    return updateResult.rows[0];
  }

  /**
   * Attaches an uploaded receipt file to a loan owned by the user.
   */
  static async attachReceipt(
    userId: number,
    loanId: number,
    filename: string,
    mimetype: string
  ): Promise<LoanRecord> {
    const checkQuery = `
      SELECT id, user_id, receipt_filename
      FROM loans
      WHERE id = $1;
    `;
    const checkResult = await pool.query(checkQuery, [loanId]);

    if (checkResult.rows.length === 0) {
      throw new AppError(404, 'Loan not found.');
    }

    const existing = checkResult.rows[0];
    if (existing.user_id !== userId) {
      throw new AppError(403, 'Forbidden: You do not have permission to modify this loan.');
    }

    // Safely remove previous receipt file from disk if replaced
    if (existing.receipt_filename && existing.receipt_filename !== filename) {
      try {
        const oldFile = path.resolve(RECEIPTS_DIR, path.basename(existing.receipt_filename));
        if (oldFile.startsWith(RECEIPTS_DIR) && fs.existsSync(oldFile)) {
          fs.unlinkSync(oldFile);
        }
      } catch {}
    }

    const updateQuery = `
      UPDATE loans
      SET receipt_filename = $1, receipt_mimetype = $2
      WHERE id = $3 AND user_id = $4
      RETURNING
        id,
        user_id AS "userId",
        friend_name AS "friendName",
        amount::text AS "amount",
        due_date::text AS "dueDate",
        is_repaid AS "isRepaid",
        repaid_at::text AS "repaidAt",
        created_at::text AS "createdAt",
        (receipt_filename IS NOT NULL) AS "hasReceipt";
    `;

    const updateResult = await pool.query(updateQuery, [filename, mimetype, loanId, userId]);
    return updateResult.rows[0];
  }

  /**
   * Retrieves receipt file metadata for an authenticated loan owner.
   * Strictly enforces user ownership.
   */
  static async getReceipt(
    userId: number,
    loanId: number
  ): Promise<{ filename: string; mimetype: string }> {
    const query = `
      SELECT id, user_id, receipt_filename, receipt_mimetype
      FROM loans
      WHERE id = $1;
    `;
    const result = await pool.query(query, [loanId]);

    if (result.rows.length === 0) {
      throw new AppError(404, 'Loan not found.');
    }

    const existing = result.rows[0];
    if (existing.user_id !== userId) {
      throw new AppError(403, 'Forbidden: You do not have permission to access this receipt.');
    }

    if (!existing.receipt_filename) {
      throw new AppError(404, 'No receipt attached to this loan.');
    }

    return {
      filename: existing.receipt_filename,
      mimetype: existing.receipt_mimetype || 'image/jpeg',
    };
  }

  /**
   * Computes real-time loan summary metrics aggregated directly in PostgreSQL.
   */
  static async getSummary(userId: number): Promise<LoanSummary> {
    const query = `
      SELECT
        ROUND(COALESCE(SUM(amount), 0), 2)::text AS "totalLent",
        ROUND(COALESCE(SUM(CASE WHEN is_repaid = TRUE THEN amount ELSE 0 END), 0), 2)::text AS "totalRepaid",
        ROUND(COALESCE(SUM(CASE WHEN is_repaid = FALSE THEN amount ELSE 0 END), 0), 2)::text AS "totalOutstanding",
        ROUND(COALESCE(SUM(CASE WHEN is_repaid = FALSE AND due_date < CURRENT_DATE THEN amount ELSE 0 END), 0), 2)::text AS "overdueAmount",
        COUNT(*)::int AS "totalLoans",
        COUNT(CASE WHEN is_repaid = TRUE THEN 1 END)::int AS "repaidLoans",
        COUNT(CASE WHEN is_repaid = FALSE THEN 1 END)::int AS "pendingLoans"
      FROM loans
      WHERE user_id = $1;
    `;

    const result = await pool.query(query, [userId]);
    return result.rows[0];
  }
}

