import React, { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, BackHandler } from 'react-native';
import { colors } from '../theme';
import { storage } from '../utils/storage';
import { api } from '../api/client';
import { User } from '../types';
import { LoginScreen } from '../screens/LoginScreen';
import { OtpScreen } from '../screens/OtpScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { AddLoanScreen } from '../screens/AddLoanScreen';

type Screen = 'LOGIN' | 'OTP' | 'DASHBOARD' | 'ADD_LOAN';

export const AppNavigator: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('LOGIN');
  const [user, setUser] = useState<User | null>(null);
  const [pendingPhone, setPendingPhone] = useState<string>('');
  const [initializing, setInitializing] = useState(true);

  // 1. Restore authenticated session & kick off lightweight backend wake-up on app start
  useEffect(() => {
    // Proactively ping health check to begin container spin-up immediately on app launch
    api.wakeUpBackend();

    const restoreSession = async () => {
      try {
        const token = await storage.getToken();
        const savedUser = await storage.getUser();

        if (token && savedUser) {
          setUser(savedUser);
          setCurrentScreen('DASHBOARD');
        } else {
          setCurrentScreen('LOGIN');
        }
      } catch {
        setCurrentScreen('LOGIN');
      } finally {
        setInitializing(false);
      }
    };

    restoreSession();
  }, []);

  // 2. Hardware Android Back Button Handler
  useEffect(() => {
    const onHardwareBack = () => {
      if (currentScreen === 'OTP') {
        setCurrentScreen('LOGIN');
        return true; // handled
      }
      if (currentScreen === 'ADD_LOAN') {
        setCurrentScreen('DASHBOARD');
        return true; // handled
      }
      return false; // default exit
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onHardwareBack
    );
    return () => subscription.remove();
  }, [currentScreen]);

  // Auth Action Handlers
  const handleOtpRequested = (phone: string) => {
    setPendingPhone(phone);
    setCurrentScreen('OTP');
  };

  const handleAuthSuccess = (authenticatedUser: User) => {
    setUser(authenticatedUser);
    setCurrentScreen('DASHBOARD');
  };

  const handleLogout = useCallback(async () => {
    await storage.clearAuth();
    setUser(null);
    setPendingPhone('');
    setCurrentScreen('LOGIN');
  }, []);

  // Splash Loading State during Session Check
  if (initializing) {
    return (
      <View style={styles.splashContainer}>
        <ActivityIndicator size="large" color={colors.earthyBrown} />
      </View>
    );
  }

  // Unauthenticated Flow
  if (!user || currentScreen === 'LOGIN' || currentScreen === 'OTP') {
    if (currentScreen === 'OTP') {
      return (
        <OtpScreen
          phone={pendingPhone}
          onBackToLogin={() => setCurrentScreen('LOGIN')}
          onAuthSuccess={handleAuthSuccess}
        />
      );
    }
    return (
      <LoginScreen
        onOtpRequested={handleOtpRequested}
        onAuthSuccess={handleAuthSuccess}
      />
    );
  }

  // Authenticated Flow
  if (currentScreen === 'ADD_LOAN') {
    return (
      <AddLoanScreen
        onBack={() => setCurrentScreen('DASHBOARD')}
        onLoanCreated={() => setCurrentScreen('DASHBOARD')}
      />
    );
  }

  return (
    <DashboardScreen
      user={user}
      onLogout={handleLogout}
      onNavigateToAddLoan={() => setCurrentScreen('ADD_LOAN')}
    />
  );
};

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.cream,
  },
});
