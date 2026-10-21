import { Router, Response, NextFunction } from 'express';
import { LoanService } from '../services/loan.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

export const summaryRouter = Router();

// Apply authentication middleware to summary endpoint
summaryRouter.use(authenticate);

// GET /api/summary — Computes real-time loan statistics for authenticated user
summaryRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const summary = await LoanService.getSummary(req.user!.userId);
    res.status(200).json(summary);
  } catch (err) {
    next(err);
  }
});
