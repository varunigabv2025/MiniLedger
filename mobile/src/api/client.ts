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

class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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

  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12-second timeout

    response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Network timeout: Server took too long to respond. Please check your connection.');
    }
    throw new Error(
      `Cannot connect to MiniLedger backend at ${API_BASE_URL}. Ensure the backend server is running.`
    );
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

    // If unauthorized, clear invalid session
    if (response.status === 401) {
      await storage.clearAuth();
    }

    throw new ApiError(response.status, errorMessage);
  }

  return data as T;
}

export const api = {
  /**
   * Request 6-digit mock OTP for a phone number
   */
  requestOtp: (phone: string): Promise<{ message: string }> => {
    return request<{ message: string }>('/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  },

  /**
   * Verify 6-digit mock OTP and receive signed JWT + user info
   */
  verifyOtp: (phone: string, otp: string): Promise<AuthVerifyResponse> => {
    return request<AuthVerifyResponse>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    });
  },

  /**
   * One-click demo login for recruiters and evaluators (no OTP required).
   * Authenticates against dedicated backend endpoint and saves session.
   */
  demoLogin: async (): Promise<AuthVerifyResponse> => {
    const res = await request<AuthVerifyResponse>('/auth/demo-login', {
      method: 'POST',
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

