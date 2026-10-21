import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';
import { validateBody } from '../middleware/validate.middleware';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

export const authRouter = Router();

const requestOtpSchema = z.object({
  phone: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .regex(
      /^\+?[1-9]\d{9,14}$/,
      'Phone number must be a valid 10 to 15 digit number (e.g., 9876543210 or +919876543210)'
    ),
});

const verifyOtpSchema = z.object({
  phone: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .regex(/^\+?[1-9]\d{9,14}$/, 'Phone number must be a valid 10 to 15 digit number'),
  otp: z
    .string({ required_error: 'OTP is required' })
    .trim()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP must consist of 6 digits only'),
});

authRouter.post(
  '/request-otp',
  validateBody(requestOtpSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await AuthService.requestOtp(req.body.phone);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

authRouter.post(
  '/verify-otp',
  validateBody(verifyOtpSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await AuthService.verifyOtp(req.body.phone, req.body.otp);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/demo-login — One-click passwordless and OTP-free login for recruiters
authRouter.post('/demo-login', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AuthService.demoLogin();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/demo-reset — Reset demo ledger to pristine sample state (requires auth)
authRouter.post(
  '/demo-reset',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await AuthService.resetDemoData(req.user!.userId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);
