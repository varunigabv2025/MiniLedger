import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';

// Load .env from backend directory or project root if available
const candidatePaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend', '.env'),
  path.resolve(__dirname, '../../.env'),
];

for (const candidate of candidatePaths) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
    break;
  }
}
dotenv.config(); // fallback to standard dotenv resolution

const envSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().default('5432').transform((val) => parseInt(val, 10)),
  DB_NAME: z.string().default('miniledger'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default(''),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  OTP_EXPIRY_MINUTES: z.string().default('5').transform((val) => parseInt(val, 10)),
});

// Provide a safe fallback secret strictly for test runner if JWT_SECRET is not configured in .env
if (process.env.NODE_ENV === 'test' && !process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_fallback_jwt_secret_miniledger_2026';
}

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Safe diagnostic: only report variable names with validation issues; never print values
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join(', ');
  console.error(`[Config Error] Invalid environment configuration: ${issues}`);
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
}

export const config = parsed.success
  ? parsed.data
  : {
      PORT: 5000,
      NODE_ENV: 'test' as const,
      DATABASE_URL: undefined,
      DB_HOST: 'localhost',
      DB_PORT: 5432,
      DB_NAME: 'miniledger',
      DB_USER: 'postgres',
      DB_PASSWORD: '',
      JWT_SECRET: 'test_fallback_jwt_secret_miniledger_2026',
      JWT_EXPIRES_IN: '7d',
      OTP_EXPIRY_MINUTES: 5,
    };
