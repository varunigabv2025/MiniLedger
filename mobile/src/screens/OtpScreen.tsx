import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../theme';
import { InputField } from '../components/InputField';
import { PrimaryButton } from '../components/PrimaryButton';
import { api } from '../api/client';
import { storage } from '../utils/storage';
import { User } from '../types';

interface OtpScreenProps {
  phone: string;
  onBackToLogin: () => void;
  onAuthSuccess: (user: User, token: string) => void;
}

export const OtpScreen: React.FC<OtpScreenProps> = ({
  phone,
  onBackToLogin,
  onAuthSuccess,
}) => {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(60);

  // 60-second countdown timer for resending OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleVerifyOtp = async () => {
    const trimmedOtp = otp.trim();
    if (!trimmedOtp || trimmedOtp.length !== 6) {
      setError('Please enter the full 6-digit code');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await api.verifyOtp(phone, trimmedOtp);
      // Persist auth token and user data in secure storage
      await storage.saveAuth(response.token, response.user);
      onAuthSuccess(response.user, response.token);
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resending) return;

    setError(null);
    setResending(true);

    try {
      await api.requestOtp(phone);
      setResendCooldown(60);
      setOtp('');
    } catch (err: any) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Action */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBackToLogin}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>← Change Phone Number</Text>
          </TouchableOpacity>

          {/* Form Card */}
          <View style={[styles.card, shadows.cardHighlight]}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>🔐</Text>
            </View>

            <Text style={styles.title}>Enter Verification Code</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit verification code to{' '}
              <Text style={styles.phoneHighlight}>{phone}</Text>
            </Text>

            <InputField
              label="6-Digit OTP"
              placeholder="123456"
              keyboardType="number-pad"
              value={otp}
              onChangeText={(text) => {
                setOtp(text);
                if (error) setError(null);
              }}
              error={error || undefined}
              maxLength={6}
              autoFocus
              style={styles.otpInput}
            />

            <PrimaryButton
              title="Verify & Continue"
              onPress={handleVerifyOtp}
              loading={loading}
              disabled={loading || otp.trim().length !== 6}
              style={styles.verifyButton}
            />

            {/* Resend Cooldown Action */}
            <View style={styles.resendContainer}>
              <Text style={styles.resendPrompt}>Didn't receive code? </Text>
              {resendCooldown > 0 ? (
                <Text style={styles.cooldownText}>
                  Resend in {resendCooldown}s
                </Text>
              ) : (
                <TouchableOpacity
                  onPress={handleResendOtp}
                  disabled={resending}
                  activeOpacity={0.7}
                >
                  <Text style={styles.resendAction}>
                    {resending ? 'Sending...' : 'Resend Code'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Backend Terminal Notice */}
            <View style={styles.terminalNotice}>
              <Text style={styles.terminalNoticeHeader}>
                💻 Where to find the code:
              </Text>
              <Text style={styles.terminalNoticeBody}>
                Look in your backend console log for:{'\n'}
                <Text style={styles.codeSnippet}>[MiniLedger Mock OTP] Code: xxxxxx</Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  backButton: {
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  backButtonText: {
    fontSize: 14,
    color: colors.earthyBrown,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.surfaceCardLight,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: borderRadius.round,
    backgroundColor: colors.surfaceCardCream,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconText: {
    fontSize: 26,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.darkEspresso,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: colors.darkEspresso,
    opacity: 0.75,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  phoneHighlight: {
    fontWeight: '700',
    color: colors.darkEspresso,
  },
  otpInput: {
    fontSize: 20,
    letterSpacing: 4,
    textAlign: 'center',
  },
  verifyButton: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  resendPrompt: {
    fontSize: 13,
    color: colors.darkEspresso,
    opacity: 0.75,
  },
  cooldownText: {
    fontSize: 13,
    color: colors.placeholder,
    fontWeight: '600',
  },
  resendAction: {
    fontSize: 13,
    color: colors.earthyBrown,
    fontWeight: '800',
  },
  terminalNotice: {
    backgroundColor: colors.surfaceCardCream,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
  },
  terminalNoticeHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.darkEspresso,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  terminalNoticeBody: {
    fontSize: 12,
    color: colors.darkEspresso,
    lineHeight: 18,
  },
  codeSnippet: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    color: colors.earthyBrown,
  },
});
