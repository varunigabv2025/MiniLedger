import { Router, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { LoanService } from '../services/loan.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { AppError } from '../middleware/error.middleware';
import { uploadReceiptFile, RECEIPTS_DIR } from '../middleware/upload.middleware';

export const loanRouter = Router();

// Apply authentication middleware to all loan routes
loanRouter.use(authenticate);

const createLoanSchema = z.object({
  friendName: z
    .string({ required_error: 'Friend name is required' })
    .trim()
    .min(1, 'Friend name cannot be empty')
    .max(255, 'Friend name cannot exceed 255 characters'),
  amount: z
    .number({ required_error: 'Amount is required' })
    .positive('Amount must be greater than zero')
    .finite('Amount must be a finite number')
    .max(1000000000, 'Amount exceeds allowed maximum limit'),
  dueDate: z
    .string({ required_error: 'Due date is required' })
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format')
    .refine((val) => {
      const [y, m, d] = val.split('-').map(Number);
      if (m < 1 || m > 12 || d < 1 || d > 31) return false;
      const date = new Date(Date.UTC(y, m - 1, d));
      return (
        !isNaN(date.getTime()) &&
        date.getUTCFullYear() === y &&
        date.getUTCMonth() + 1 === m &&
        date.getUTCDate() === d
      );
    }, 'Due date must be a valid calendar date in YYYY-MM-DD format'),
});

// Helper for strict positive integer loan ID validation
const parseLoanId = (rawId: string | string[] | undefined): number => {
  const idStr = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!idStr || !/^\d+$/.test(idStr)) {
    throw new AppError(400, 'Invalid loan ID parameter.');
  }
  const id = parseInt(idStr, 10);
  if (id <= 0) {
    throw new AppError(400, 'Invalid loan ID parameter.');
  }
  return id;
};

// GET /api/loans — List only authenticated user's loans
loanRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const loans = await LoanService.getLoans(req.user!.userId);
    res.status(200).json(loans);
  } catch (err) {
    next(err);
  }
});

// POST /api/loans — Create new loan
loanRouter.post(
  '/',
  validateBody(createLoanSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const loan = await LoanService.createLoan(req.user!.userId, req.body);
      res.status(201).json(loan);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/loans/:id/repay — Mark loan as repaid
loanRouter.patch('/:id/repay', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const loanId = parseLoanId(req.params.id);
    const updated = await LoanService.repayLoan(req.user!.userId, loanId);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /api/loans/:id/receipt — Upload and associate receipt photo
loanRouter.post(
  '/:id/receipt',
  uploadReceiptFile,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const loanId = parseLoanId(req.params.id);

      if (!req.file) {
        throw new AppError(400, 'Receipt image file is required.');
      }

      const updated = await LoanService.attachReceipt(
        req.user!.userId,
        loanId,
        req.file.filename,
        req.file.mimetype
      );

      res.status(200).json({
        message: 'Receipt photo uploaded successfully.',
        loan: updated,
      });
    } catch (err) {
      // Clean up orphaned uploaded file on unexpected errors
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlink(req.file.path, () => {});
      }
      next(err);
    }
  }
);

// GET /api/loans/:id/receipt — View/stream receipt photo (strictly owner only)
loanRouter.get('/:id/receipt', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const loanId = parseLoanId(req.params.id);
    const receipt = await LoanService.getReceipt(req.user!.userId, loanId);

    // Prevent directory traversal attacks by isolating base name
    const safeFilename = path.basename(receipt.filename);
    const filePath = path.resolve(RECEIPTS_DIR, safeFilename);

    if (!filePath.startsWith(RECEIPTS_DIR) || !fs.existsSync(filePath)) {
      throw new AppError(404, 'Receipt image file not found on disk.');
    }

    res.setHeader('Content-Type', receipt.mimetype);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});

