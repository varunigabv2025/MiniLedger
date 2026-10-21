import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../theme';
import { InputField } from '../components/InputField';
import { PrimaryButton } from '../components/PrimaryButton';
import { api } from '../api/client';
import { User } from '../types';

interface LoginScreenProps {
  onOtpRequested: (phone: string) => void;
  onAuthSuccess: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onOtpRequested,
  onAuthSuccess,
}) => {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestOtp = async () => {
    const trimmed = phone.trim();
    if (!trimmed) {
      setError('Please enter your phone number');
      return;
    }

    // Basic phone validation: 10 to 15 digits
    const cleaned = trimmed.replace(/\s+/g, '');
    if (!/^\+?[1-9]\d{9,14}$/.test(cleaned)) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await api.requestOtp(cleaned);
      onOtpRequested(cleaned);
    } catch (err: any) {
      setError(err.message || 'Failed to request OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setDemoLoading(true);

    try {
      const response = await api.demoLogin();
      onAuthSuccess(response.user);
    } catch (err: any) {
      setError(err.message || 'Demo login failed. Ensure the backend server is reachable.');
    } finally {
      setDemoLoading(false);
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
          {/* Brand Header */}
          <View style={styles.brandContainer}>
            <View style={[styles.logoBadge, shadows.card]}>
              <Text style={styles.logoIcon}>💳</Text>
            </View>
            <Text style={styles.appName}>MiniLedger</Text>
            <Text style={styles.tagline}>PEER-TO-PEER LENDING LEDGER</Text>
          </View>

          {/* Form Card */}
          <View style={[styles.formCard, shadows.cardHighlight]}>
            <Text style={styles.formTitle}>Welcome Back</Text>
            <Text style={styles.formSubtitle}>
              Log in with your phone number to access your personal ledger and track friend loans.
            </Text>

            <InputField
              label="Phone Number"
              placeholder="9876543210"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                if (error) setError(null);
              }}
              error={error || undefined}
              maxLength={15}
              autoFocus
            />

            <PrimaryButton
              title="Get OTP Code"
              onPress={handleRequestOtp}
              loading={loading}
              disabled={loading || demoLoading || phone.trim().length < 10}
              style={styles.button}
            />

            {/* Recruiter / Quick Evaluation Section */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR INSTANT EVALUATION</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={[
                styles.demoButton,
                demoLoading && styles.demoButtonDisabled,
              ]}
              onPress={handleDemoLogin}
              disabled={loading || demoLoading}
              activeOpacity={0.8}
            >
              <View style={styles.demoButtonLeft}>
                <View style={styles.demoBadge}>
                  <Text style={styles.demoBadgeIcon}>⚡</Text>
                </View>
                <View style={styles.demoTextCol}>
                  <View style={styles.demoTitleRow}>
                    <Text style={styles.demoButtonTitle}>Try Demo Account</Text>
                    <View style={styles.recruiterPill}>
                      <Text style={styles.recruiterPillText}>RECRUITER</Text>
                    </View>
                  </View>
                  <Text style={styles.demoButtonSubtitle}>
                    Instant access • Preloaded sample loans • No OTP required
                  </Text>
                </View>
              </View>

              <View style={styles.demoButtonRight}>
                {demoLoading ? (
                  <ActivityIndicator size="small" color={colors.earthyBrown} />
                ) : (
                  <Text style={styles.demoArrow}>→</Text>
                )}
              </View>
            </TouchableOpacity>

            {/* Mock OTP Information Alert */}
            <View style={styles.mockNotice}>
              <Text style={styles.mockNoticeTitle}>ℹ️ Standard OTP Flow</Text>
              <Text style={styles.mockNoticeText}>
                Entering your phone number above triggers our mock SMS flow: your 6-digit verification code will be printed to the backend terminal log.
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              MiniLedger • Secure Personal Finance Tracking
            </Text>
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
  brandContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.cardEspresso,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  logoIcon: {
    fontSize: 30,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.darkEspresso,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warmTaupe,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  formCard: {
    backgroundColor: colors.surfaceCardLight,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.darkEspresso,
    marginBottom: spacing.xs,
  },
  formSubtitle: {
    fontSize: 14,
    color: colors.darkEspresso,
    opacity: 0.75,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  button: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5D9C5',
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.warmTaupe,
    letterSpacing: 1.2,
    marginHorizontal: spacing.sm,
  },
  demoButton: {
    backgroundColor: colors.surfaceCardCream,
    borderWidth: 1.5,
    borderColor: colors.warmTaupe,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  demoButtonDisabled: {
    opacity: 0.6,
  },
  demoButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  demoBadge: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: '#EAE1CE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  demoBadgeIcon: {
    fontSize: 18,
  },
  demoTextCol: {
    flex: 1,
  },
  demoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  demoButtonTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.darkEspresso,
  },
  recruiterPill: {
    backgroundColor: colors.earthyBrown,
    borderRadius: borderRadius.round,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  recruiterPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.cream,
    letterSpacing: 0.5,
  },
  demoButtonSubtitle: {
    fontSize: 11,
    color: colors.placeholder,
    marginTop: 2,
    lineHeight: 15,
  },
  demoButtonRight: {
    marginLeft: spacing.sm,
  },
  demoArrow: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.earthyBrown,
  },
  mockNotice: {
    backgroundColor: colors.surfaceCardCream,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mockNoticeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.darkEspresso,
    marginBottom: 4,
  },
  mockNoticeText: {
    fontSize: 12,
    color: colors.darkEspresso,
    opacity: 0.8,
    lineHeight: 16,
  },
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: colors.placeholder,
    fontWeight: '500',
  },
});
