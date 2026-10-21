// Shared TypeScript interfaces for Mobile App

export interface User {
  id: number;
  phone: string;
  createdAt: string;
  isDemo?: boolean;
}

export interface Loan {
  id: number;
  userId: number;
  friendName: string;
  amount: string;
  dueDate: string;
  isRepaid: boolean;
  repaidAt: string | null;
  createdAt: string;
  hasReceipt?: boolean;
}

export interface Summary {
  totalLent: string;
  totalRepaid: string;
  totalOutstanding: string;
  overdueAmount: string;
  totalLoans: number;
  repaidLoans: number;
  pendingLoans: number;
}

export interface AuthVerifyResponse {
  token: string;
  user: User;
}

export interface CreateLoanPayload {
  friendName: string;
  amount: number;
  dueDate: string;
}
