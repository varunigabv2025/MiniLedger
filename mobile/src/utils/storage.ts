import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { User } from '../types';

const TOKEN_KEY = 'miniledger_jwt_token';
const USER_KEY = 'miniledger_user_data';

// In-memory storage fallback for web/testing
const memoryStorage: Record<string, string> = {};

export const storage = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        await SecureStore.setItemAsync(key, value);
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      } else {
        memoryStorage[key] = value;
      }
    } catch {
      memoryStorage[key] = value;
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS !== 'web') {
        return await SecureStore.getItemAsync(key);
      } else if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      } else {
        return memoryStorage[key] || null;
      }
    } catch {
      return memoryStorage[key] || null;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        await SecureStore.deleteItemAsync(key);
      } else if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      } else {
        delete memoryStorage[key];
      }
    } catch {
      delete memoryStorage[key];
    }
  },

  async saveAuth(token: string, user: User): Promise<void> {
    await this.setItem(TOKEN_KEY, token);
    await this.setItem(USER_KEY, JSON.stringify(user));
  },

  async getToken(): Promise<string | null> {
    return this.getItem(TOKEN_KEY);
  },

  async getUser(): Promise<User | null> {
    const raw = await this.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  async clearAuth(): Promise<void> {
    await this.removeItem(TOKEN_KEY);
    await this.removeItem(USER_KEY);
  },
};
