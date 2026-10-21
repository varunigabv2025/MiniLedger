import { describe, it, expect } from '@jest/globals';
import { validateDueDate } from '../../mobile/src/utils/validation';

describe('Due Date Calendar Validation Unit Tests', () => {
  describe('Valid Calendar Dates', () => {
    it('should accept valid past calendar date 2026-10-09', () => {
      const error = validateDueDate('2026-10-09');
      expect(error).toBeNull();
    });

    it('should accept valid leap year date 2024-02-29', () => {
      const error = validateDueDate('2024-02-29');
      expect(error).toBeNull();
    });

    it('should accept valid leap year date 2028-02-29', () => {
      const error = validateDueDate('2028-02-29');
      expect(error).toBeNull();
    });

    it('should accept valid 31-day month dates like 2026-01-31, 2026-07-31, 2026-12-31', () => {
      expect(validateDueDate('2026-01-31')).toBeNull();
      expect(validateDueDate('2026-07-31')).toBeNull();
      expect(validateDueDate('2026-08-31')).toBeNull();
      expect(validateDueDate('2026-10-31')).toBeNull();
      expect(validateDueDate('2026-12-31')).toBeNull();
    });

    it('should accept valid 30-day month dates like 2026-04-30 and 2026-11-30', () => {
      expect(validateDueDate('2026-04-30')).toBeNull();
      expect(validateDueDate('2026-06-30')).toBeNull();
      expect(validateDueDate('2026-09-30')).toBeNull();
      expect(validateDueDate('2026-11-30')).toBeNull();
    });
  });

  describe('Invalid Calendar Dates', () => {
    it('should reject impossible date 2026-02-31', () => {
      const error = validateDueDate('2026-02-31');
      expect(error).toBe('Please enter a real calendar date (e.g. check leap years and days in month)');
    });

    it('should reject non-leap year February 29th (2026-02-29)', () => {
      const error = validateDueDate('2026-02-29');
      expect(error).toBe('Please enter a real calendar date (e.g. check leap years and days in month)');
    });

    it('should reject 31st day in 30-day months (2026-04-31, 2026-06-31, 2026-09-31, 2026-11-31)', () => {
      expect(validateDueDate('2026-04-31')).toBe(
        'Please enter a real calendar date (e.g. check leap years and days in month)'
      );
      expect(validateDueDate('2026-06-31')).toBe(
        'Please enter a real calendar date (e.g. check leap years and days in month)'
      );
      expect(validateDueDate('2026-09-31')).toBe(
        'Please enter a real calendar date (e.g. check leap years and days in month)'
      );
      expect(validateDueDate('2026-11-31')).toBe(
        'Please enter a real calendar date (e.g. check leap years and days in month)'
      );
    });

    it('should reject out-of-range month or day numbers', () => {
      expect(validateDueDate('2026-00-15')).toBe('Please enter a valid month (01-12) and day (01-31)');
      expect(validateDueDate('2026-13-15')).toBe('Please enter a valid month (01-12) and day (01-31)');
      expect(validateDueDate('2026-05-00')).toBe('Please enter a valid month (01-12) and day (01-31)');
      expect(validateDueDate('2026-05-32')).toBe('Please enter a valid month (01-12) and day (01-31)');
    });

    it('should reject malformed date strings', () => {
      expect(validateDueDate('')).toBe('Due date is required');
      expect(validateDueDate('10-09-2026')).toBe('Due date must be in YYYY-MM-DD format');
      expect(validateDueDate('2026/10/09')).toBe('Due date must be in YYYY-MM-DD format');
      expect(validateDueDate('not-a-date')).toBe('Due date must be in YYYY-MM-DD format');
    });
  });
});
