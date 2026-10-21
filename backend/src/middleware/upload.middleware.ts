import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';

export const RECEIPTS_DIR = path.resolve(__dirname, '../../uploads/receipts');

// Ensure destination directory exists safely
if (!fs.existsSync(RECEIPTS_DIR)) {
  fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
}

// 5 Megabytes maximum upload size
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed image MIME types and extensions
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/jpg']);
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, RECEIPTS_DIR);
  },
  filename: (_req, file, cb) => {
    const rawExt = path.extname(file.originalname || '').toLowerCase();
    let ext = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : '';
    if (!ext) {
      ext = (file.mimetype || '').includes('png') ? '.png' : '.jpg';
    }
    const randomSuffix = crypto.randomBytes(12).toString('hex');
    const filename = `receipt_${Date.now()}_${randomSuffix}${ext}`;
    cb(null, filename);
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mimetype = (file.mimetype || '').toLowerCase();

  const isAllowedMime = ALLOWED_MIME_TYPES.has(mimetype);
  const isAllowedExt = ALLOWED_EXTENSIONS.has(ext);

  // Reject files with explicit disallowed extensions (e.g. .txt, .pdf, .exe)
  if (ext && !isAllowedExt) {
    return cb(
      new AppError(
        400,
        'Invalid file type. Only JPEG and PNG images are allowed (.jpg, .jpeg, .png).'
      )
    );
  }

  // Reject files where neither MIME nor extension is an accepted image format
  if (!isAllowedMime && !isAllowedExt) {
    return cb(
      new AppError(
        400,
        'Invalid file type. Only JPEG and PNG images are allowed (.jpg, .jpeg, .png).'
      )
    );
  }

  cb(null, true);
};


const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter,
});

/**
 * Middleware that wraps multer single-file upload for field 'receipt'
 * Translates Multer errors into standard AppError (400 Bad Request).
 */
export const uploadReceiptFile = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  upload.single('receipt')(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new AppError(400, 'File too large. Maximum allowed receipt size is 5MB.')
          );
        }
        return next(new AppError(400, `Upload rejected: ${err.message}`));
      }
      return next(err);
    }
    next();
  });
};
