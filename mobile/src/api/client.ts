import { Platform } from 'react-native';
import { storage } from '../utils/storage';
import { AuthVerifyResponse, CreateLoanPayload, Loan, Summary } from '../types';

/**
 * Configurable API base URL with EXPO_PUBLIC_API_URL support for deployed environments.
 * 
 * Default fallback environments:
 * - Standalone APK / Production: 'https://miniledger-mm1e.onrender.com/api'
 * - Local Android Emulator (DEV): 'http://10.0.2.2:5000/api'
 * - Local iOS Simulator / Web (DEV): 'http://localhost:5000/api'
 * - Cloud/Production: Set EXPO_PUBLIC_API_URL (e.g. 'https://miniledger-mm1e.onrender.com/api')
 */
const getBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  // Standalone APK and production builds must always point to the deployed Render backend
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    return 'https://miniledger-mm1e.onrender.com/api';
  }
  return Platform.select({
    android: 'http://10.0.2.2:5000/api',
    ios: 'http://localhost:5000/api',
    default: 'http://localhost:5000/api',
  });
};

export const API_BASE_URL = getBaseUrl();
export const SERVER_ROOT_URL = API_BASE_URL.replace(/\/api\/?$/, '');
export const HEALTH_CHECK_URL = `${SERVER_ROOT_URL}/health`;

export type BackendConnectionStatus = 'checking' | 'connected' | 'cold_start' | 'error';

class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

type StatusListener = (status: BackendConnectionStatus, message?: string) => void;
const statusListeners: Set<StatusListener> = new Set();
let currentStatus: BackendConnectionStatus = 'checking';
let currentStatusMessage = 'Checking connection…';
let wakeUpPromise: Promise<boolean> | null = null;
let isBackendConfirmedAwake = false;

function setConnectionStatus(status: BackendConnectionStatus, message?: string) {
  currentStatus = status;
  if (message) {
    currentStatusMessage = message;
  }
  statusListeners.forEach((listener) => {
    try {
      listener(status, currentStatusMessage);
    } catch (e) {
      console.warn('[API Client] Status listener error:', e);
    }
  });
}

/**
 * Lightweight health check using GET /health
 */
async function checkHealth(timeoutMs = 6000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(HEALTH_CHECK_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      return data?.status === 'ok';
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Proactively pings the backend when the app starts or before the first API action.
 * Handles Render free-tier cold starts gracefully with bounded retries and status updates.
 */
function wakeUpBackend(force = false): Promise<boolean> {
  if (isBackendConfirmedAwake && !force) {
    setConnectionStatus('connected', 'Connected to MiniLedger');
    return Promise.resolve(true);
  }

  if (wakeUpPromise && !force) {
    return wakeUpPromise;
  }

  wakeUpPromise = (async () => {
    setConnectionStatus('checking', 'Connecting to MiniLedger…');

    // 1. Fast initial probe (5s timeout) to see if backend is already warm
    const fastOk = await checkHealth(5000);
    if (fastOk) {
      isBackendConfirmedAwake = true;
      setConnectionStatus('connected', 'Connected to MiniLedger');
      wakeUpPromise = null;
      return true;
    }

    // 2. If initial probe failed, the server is spinning up from cold sleep
    setConnectionStatus(
      'cold_start',
      'Connecting to MiniLedger… the server may take up to a minute to wake up.'
    );

    // 3. Bounded polling with short delays between attempts (total window: ~65s)
    const MAX_WAIT_MS = 65000;
    const POLL_INTERVAL_MS = 3000;
    const PROBE_TIMEOUT_MS = 6000;
    const startTime = Date.now();

    while (Date.now() - startTime < MAX_WAIT_MS) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      const ok = await checkHealth(PROBE_TIMEOUT_MS);
      if (ok) {
        isBackendConfirmedAwake = true;
        setConnectionStatus('connected', 'Connected to MiniLedger');
        wakeUpPromise = null;
        return true;
      }
    }

    // 4. If still not responding after max wait time
    setConnectionStatus(
      'error',
      'MiniLedger server is taking longer than expected. Please check your connection or tap Retry.'
    );
    wakeUpPromise = null;
    return false;
  })();

  return wakeUpPromise;
}

/**
 * Ensures backend is awake before proceeding with a critical action.
 */
async function ensureBackendReady(maxWaitMs = 60000): Promise<boolean> {
  if (isBackendConfirmedAwake) return true;
  const p = wakeUpBackend();
  let timer: any;
  const timeoutPromise = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), maxWaitMs);
  });
  const res = await Promise.race([p, timeoutPromise]);
  clearTimeout(timer);
  return res;
}

interface RequestOptions extends RequestInit {
  isSafeToRetry?: boolean;
  maxRetries?: number;
  customTimeoutMs?: number;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = await storage.getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Safe operations (GET, or explicitly configured safe requests) can be retried once on network disconnect
  const isSafe = options.isSafeToRetry ?? (options.method === undefined || options.method === 'GET');
  const maxRetries = isSafe ? (options.maxRetries ?? 1) : 0;

  // Timeout:
  // If backend is not yet confirmed awake, give it 60s to accommodate Render cold start.
  // Once awake, standard 15s timeout is used.
  const baseTimeoutMs = isBackendConfirmedAwake ? 15000 : 60000;
  const timeoutMs = options.customTimeoutMs ?? baseTimeoutMs;

  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Short backoff delay before retry
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Successfully reached server! Mark as awake
      isBackendConfirmedAwake = true;
      if (currentStatus !== 'connected') {
        setConnectionStatus('connected', 'Connected to MiniLedger');
      }

      let data: any;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch {
          data = null;
        }
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const errorMessage =
          (data && typeof data === 'object' && (data.error || data.message)) ||
          (typeof data === 'string' && data) ||
          `Request failed with status ${response.status}`;

        if (response.status === 401) {
          await storage.clearAuth();
        }

        // Genuine HTTP errors (400 validation, 401 auth, 403 forbidden, 429 rate limit, 500)
        // must NEVER be retried!
        throw new ApiError(response.status, errorMessage);
      }

      return data as T;
    } catch (error: any) {
      // If it's already an ApiError (from HTTP response), throw immediately!
      if (error instanceof ApiError) {
        throw error;
      }

      lastError = error;

      // Trigger wake-up in background if network failure / timeout occurred
      if (!isBackendConfirmedAwake) {
        wakeUpBackend();
      }

      // If unsafe or retries exhausted, loop will end and throw below
    }
  }

  if (lastError?.name === 'AbortError') {
    throw new Error('Network timeout: Server took too long to respond. Please check your connection.');
  }

  throw new Error(
    `Cannot connect to MiniLedger backend at ${API_BASE_URL}. Ensure the backend server is reachable.`
  );
}

export const api = {
  checkHealth,
  wakeUpBackend,
  ensureBackendReady,
  getConnectionStatus: (): BackendConnectionStatus => currentStatus,
  onConnectionStatusChange: (listener: StatusListener): (() => void) => {
    statusListeners.add(listener);
    listener(currentStatus, currentStatusMessage);
    return () => statusListeners.delete(listener);
  },

  /**
   * Request 6-digit mock OTP for a phone number
   */
  requestOtp: async (phone: string): Promise<{ message: string }> => {
    // If backend hasn't been confirmed awake, ensure it's ready first
    if (!isBackendConfirmedAwake) {
      await ensureBackendReady();
    }
    return request<{ message: string }>('/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
      isSafeToRetry: false, // Non-idempotent relative to 60s cooldown; do not auto-retry
    });
  },

  /**
   * Verify 6-digit mock OTP and receive signed JWT + user info
   */
  verifyOtp: (phone: string, otp: string): Promise<AuthVerifyResponse> => {
    return request<AuthVerifyResponse>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
      isSafeToRetry: false, // Consumes OTP; never auto-retry
    });
  },

  /**
   * One-click demo login for recruiters and evaluators (no OTP required).
   * Authenticates against dedicated backend endpoint and saves session.
   */
  demoLogin: async (): Promise<AuthVerifyResponse> => {
    // Ensure backend is awake before sending demo login request
    if (!isBackendConfirmedAwake) {
      await ensureBackendReady();
    }
    const res = await request<AuthVerifyResponse>('/auth/demo-login', {
      method: 'POST',
      isSafeToRetry: true, // Idempotent on backend; safe to retry once on network glitch
      maxRetries: 1,
    });
    if (res?.token && res?.user) {
      await storage.saveAuth(res.token, res.user);
    }
    return res;
  },

  /**
   * Resets demo ledger back to pristine sample data (isolated to demo account).
   */
  resetDemoData: (): Promise<{ message: string }> => {
    return request<{ message: string }>('/auth/demo-reset', {
      method: 'POST',
      isSafeToRetry: false,
    });
  },

  /**
   * Get all loans for authenticated user (prioritized: overdue unpaid first)
   */
  getLoans: (): Promise<Loan[]> => {
    return request<Loan[]>('/loans');
  },

  /**
   * Create a new peer loan
   */
  createLoan: (payload: CreateLoanPayload): Promise<Loan> => {
    return request<Loan>('/loans', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Mark a loan as repaid
   */
  repayLoan: (loanId: number): Promise<Loan> => {
    return request<Loan>(`/loans/${loanId}/repay`, {
      method: 'PATCH',
    });
  },

  /**
   * Get real-time financial metrics summary
   */
  getSummary: (): Promise<Summary> => {
    return request<Summary>('/summary');
  },

  /**
   * Upload an optional receipt image for a loan.
   * Cross-platform: Converts web assets to valid Blob/File objects and supports native URIs.
   */
  uploadReceipt: async (
    loanId: number,
    asset: { uri: string; name?: string | null; mimeType?: string | null; file?: any }
  ): Promise<{ message: string; loan: Loan }> => {
    const token = await storage.getToken();
    const url = `${API_BASE_URL}/loans/${loanId}/receipt`;

    const formData = new FormData();
    const mimeType = (asset.mimeType || '').toLowerCase().includes('png')
      ? 'image/png'
      : 'image/jpeg';
    const ext = mimeType === 'image/png' ? '.png' : '.jpg';
    let filename = asset.name || `receipt_${loanId}${ext}`;
    if (!filename.toLowerCase().endsWith('.png') && !filename.toLowerCase().endsWith('.jpg') && !filename.toLowerCase().endsWith('.jpeg')) {
      filename = `${filename}${ext}`;
    }

    if (Platform.OS === 'web') {
      let fileToUpload: Blob;

      if (asset.file && typeof Blob !== 'undefined' && asset.file instanceof Blob) {
        // Direct browser File / Blob object from input
        fileToUpload = asset.file;
      } else if (typeof asset.uri === 'string' && asset.uri.startsWith('data:')) {
        // Base64 data URI conversion to Blob
        const [header, base64Data] = asset.uri.split(',');
        const mimeMatch = header.match(/:(.*?);/);
        const inferredMime = mimeMatch ? mimeMatch[1] : mimeType;
        const binaryStr = atob(base64Data);
        const len = binaryStr.length;
        const u8arr = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          u8arr[i] = binaryStr.charCodeAt(i);
        }
        fileToUpload = new Blob([u8arr], { type: inferredMime });
      } else if (typeof asset.uri === 'string' && (asset.uri.startsWith('blob:') || asset.uri.startsWith('http'))) {
        // Fetch Blob URL created by URL.createObjectURL
        const fileRes = await fetch(asset.uri);
        const fetchedBlob = await fileRes.blob();
        fileToUpload = new Blob([fetchedBlob], { type: mimeType });
      } else {
        throw new Error('Unsupported image format for web upload.');
      }

      // Wrap in File if supported to guarantee filename and Content-Type in multipart payload
      if (typeof File !== 'undefined' && !(fileToUpload instanceof File)) {
        try {
          fileToUpload = new File([fileToUpload], filename, { type: mimeType });
        } catch {
          // Fallback to Blob if File constructor is unavailable
        }
      }

      formData.append('receipt', fileToUpload, filename);
    } else {
      formData.append('receipt', {
        uri: asset.uri,
        name: filename,
        type: mimeType,
      } as any);
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    let data: any;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errMsg =
        (data && typeof data === 'object' && (data.error || data.message)) ||
        (typeof data === 'string' && data) ||
        `Upload failed with status ${response.status}`;
      throw new Error(errMsg);
    }

    return data;
  },

  /**
   * Securely retrieve the receipt image data for an authenticated loan owner.
   * Returns an object URL on Web or a base64 data URI on Native.
   */
  getReceiptBlobUrl: async (loanId: number): Promise<string> => {
    const token = await storage.getToken();
    const url = `${API_BASE_URL}/loans/${loanId}/receipt`;

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      headers,
    });

    if (!response.ok) {
      let errMsg = 'Failed to load receipt photo';
      try {
        const errJson = await response.json();
        if (errJson?.error) errMsg = errJson.error;
      } catch {}
      throw new Error(errMsg);
    }

    const blob = await response.blob();
    if (Platform.OS === 'web') {
      return URL.createObjectURL(blob);
    }

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },
};

