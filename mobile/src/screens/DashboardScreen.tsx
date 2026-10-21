import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../theme';
import { SummaryCard } from '../components/SummaryCard';
import { LoanCard } from '../components/LoanCard';
import { api } from '../api/client';
import { Loan, Summary, User } from '../types';

interface DashboardScreenProps {
  user: User;
  onLogout: () => void;
  onNavigateToAddLoan: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  user,
  onLogout,
  onNavigateToAddLoan,
}) => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [repayingId, setRepayingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resettingDemo, setResettingDemo] = useState(false);

  const isDemo = Boolean(user.isDemo || user.phone === '+910000000000');

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [loansData, summaryData] = await Promise.all([
        api.getLoans(),
        api.getSummary(),
      ]);
      setLoans(loansData);
      setSummary(summaryData);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh financial ledger');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleRepayLoan = async (loanId: number) => {
    setRepayingId(loanId);
    try {
      await api.repayLoan(loanId);
      // Refresh list and financial summary upon successful repayment
      await loadData();
    } catch (err: any) {
      const msg = err.message || 'Could not mark loan as repaid.';
      setError(msg);
      if (Platform.OS !== 'web') {
        Alert.alert('Repayment Error', msg);
      }
    } finally {
      setRepayingId(null);
    }
  };

  const handleResetDemo = async () => {
    setResettingDemo(true);
    setError(null);
    try {
      await api.resetDemoData();
      await loadData();
      if (Platform.OS !== 'web') {
        Alert.alert('Demo Reset', 'Sample ledger has been restored to the initial demo state.');
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to reset demo ledger.';
      setError(msg);
      if (Platform.OS !== 'web') {
        Alert.alert('Reset Failed', msg);
      }
    } finally {
      setResettingDemo(false);
    }
  };

  const handleLogoutConfirm = () => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm) {
        if (window.confirm('Are you sure you want to log out of MiniLedger?')) {
          onLogout();
        }
      } else {
        onLogout();
      }
    } else {
      Alert.alert(
        'Log Out',
        'Are you sure you want to log out of MiniLedger?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log Out', style: 'destructive', onPress: onLogout },
        ],
        { cancelable: true }
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 1. Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoIcon}>💳</Text>
          </View>
          <View>
            <View style={styles.brandTitleRow}>
              <Text style={styles.brandTitle}>MiniLedger</Text>
              {isDemo && (
                <View style={styles.demoHeaderBadge}>
                  <Text style={styles.demoHeaderBadgeText}>DEMO</Text>
                </View>
              )}
            </View>
            <Text style={styles.userSubtitle}>
              {isDemo ? `Demo Recruiter (${user.phone})` : user.phone}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogoutConfirm}
            activeOpacity={0.7}
          >
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Main Content List */}
      <FlatList
        data={loans}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.earthyBrown]}
            tintColor={colors.earthyBrown}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Recruiter Demo Mode Notice & Reset Banner */}
            {isDemo && (
              <View style={[styles.demoBanner, shadows.card]}>
                <View style={styles.demoBannerTop}>
                  <View style={styles.demoBannerTitleRow}>
                    <Text style={styles.demoBannerIcon}>✨</Text>
                    <View>
                      <Text style={styles.demoBannerTitle}>Recruiter Demo Mode</Text>
                      <Text style={styles.demoBannerSubtitle}>
                        Pre-seeded sample ledger • Isolated from real users
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.demoResetBtn}
                    onPress={handleResetDemo}
                    disabled={resettingDemo}
                    activeOpacity={0.7}
                  >
                    {resettingDemo ? (
                      <ActivityIndicator size="small" color={colors.cream} />
                    ) : (
                      <Text style={styles.demoResetBtnText}>🔄 Reset Data</Text>
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={styles.demoBannerText}>
                  Explore sample pending, overdue, and repaid loans. Feel free to add new loans or mark existing ones repaid — you can reset back to this initial state anytime.
                </Text>
              </View>
            )}

            {/* Real-time Summary Cards */}
            <SummaryCard summary={summary} loading={loading && !refreshing} />

            {/* Error Banner if any */}
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={loadData} style={styles.retryButton}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Loan Section Header */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Loan Ledger</Text>
                <Text style={styles.sectionSubtitle}>
                  {loans.length} {loans.length === 1 ? 'record' : 'records'} • Overdue prioritized
                </Text>
              </View>

              <TouchableOpacity
                style={styles.addSmallButton}
                onPress={onNavigateToAddLoan}
                activeOpacity={0.8}
              >
                <Text style={styles.addSmallButtonText}>+ Add Loan</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <LoanCard
            loan={item}
            onRepay={handleRepayLoan}
            repaying={repayingId === item.id}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.earthyBrown} />
              <Text style={styles.loadingText}>Loading ledger records...</Text>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🤝</Text>
              <Text style={styles.emptyTitle}>No loans recorded yet</Text>
              <Text style={styles.emptySubtitle}>
                Keep track of peer loans lent to friends. Tap the button below to add your first loan.
              </Text>
              <TouchableOpacity
                style={styles.emptyActionButton}
                onPress={onNavigateToAddLoan}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyActionText}>+ Record New Loan</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, shadows.cardHighlight]}
        onPress={onNavigateToAddLoan}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
        <Text style={styles.fabText}>Add Loan</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cream,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.cardEspresso,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  logoIcon: {
    fontSize: 20,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.darkEspresso,
  },
  demoHeaderBadge: {
    backgroundColor: colors.earthyBrown,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  demoHeaderBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.cream,
    letterSpacing: 0.5,
  },
  userSubtitle: {
    fontSize: 12,
    color: colors.warmTaupe,
    fontWeight: '600',
  },
  demoBanner: {
    backgroundColor: '#F5EFE6',
    borderWidth: 1.5,
    borderColor: colors.warmTaupe,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  demoBannerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  demoBannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  demoBannerIcon: {
    fontSize: 20,
    marginRight: spacing.xs + 2,
  },
  demoBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.darkEspresso,
  },
  demoBannerSubtitle: {
    fontSize: 11,
    color: colors.placeholder,
    marginTop: 1,
  },
  demoResetBtn: {
    backgroundColor: colors.earthyBrown,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    marginLeft: spacing.sm,
  },
  demoResetBtnText: {
    color: colors.cream,
    fontSize: 11,
    fontWeight: '700',
  },
  demoBannerText: {
    fontSize: 12,
    color: colors.darkEspresso,
    opacity: 0.85,
    lineHeight: 17,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutButton: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceCardLight,
  },
  logoutButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.darkEspresso,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 90, // Space for FAB
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.darkEspresso,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.placeholder,
    marginTop: 2,
  },
  addSmallButton: {
    backgroundColor: colors.earthyBrown,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
  },
  addSmallButtonText: {
    color: colors.cream,
    fontSize: 13,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: colors.statusOverdueBg,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: colors.statusOverdue,
    fontSize: 13,
    flex: 1,
  },
  retryButton: {
    marginLeft: spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.statusOverdue,
    borderRadius: borderRadius.sm,
  },
  retryText: {
    color: colors.cream,
    fontSize: 12,
    fontWeight: '700',
  },
  centered: {
    paddingVertical: 50,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.placeholder,
  },
  emptyCard: {
    backgroundColor: colors.surfaceCardLight,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.darkEspresso,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.placeholder,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  emptyActionButton: {
    backgroundColor: colors.earthyBrown,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
  },
  emptyActionText: {
    color: colors.cream,
    fontSize: 14,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: colors.earthyBrown,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: borderRadius.round,
  },
  fabIcon: {
    color: colors.cream,
    fontSize: 20,
    fontWeight: '800',
    marginRight: spacing.xs,
  },
  fabText: {
    color: colors.cream,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
