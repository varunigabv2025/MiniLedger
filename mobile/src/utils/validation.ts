/**
 * Validates a loan due date string.
 * Format: YYYY-MM-DD
 *
 * Rules:
 * - Must match YYYY-MM-DD pattern.
 * - Month must be 01-12, Day must be 01-31.
 * - Must be a real calendar date (checks leap years, 30 vs 31 days in month).
 * - Real dates in the past (e.g. 2026-10-09) are accepted so users can record
 *   loans issued earlier; the system will categorize them as overdue.
 *
 * Returns null if valid, or a descriptive user error string if invalid.
 */
export const validateDueDate = (dueDateStr: string): string | null => {
  const trimmed = dueDateStr.trim();
  if (!trimmed) {
    return 'Due date is required';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return 'Due date must be in YYYY-MM-DD format';
  }

  const [y, m, d] = trimmed.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return 'Please enter a valid month (01-12) and day (01-31)';
  }

  // Construct UTC date to verify calendar existence without local timezone offsets
  const testDate = new Date(Date.UTC(y, m - 1, d));
  if (
    isNaN(testDate.getTime()) ||
    testDate.getUTCFullYear() !== y ||
    testDate.getUTCMonth() + 1 !== m ||
    testDate.getUTCDate() !== d
  ) {
    return 'Please enter a real calendar date (e.g. check leap years and days in month)';
  }

  return null;
};
