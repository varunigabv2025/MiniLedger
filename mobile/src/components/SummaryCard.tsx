import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../theme';
import { Summary } from '../types';
import { formatCurrency } from '../utils/formatters';

interface SummaryCardProps {
  summary: Summary | null;
  loading?: boolean;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ summary, loading = false }) => {
  const totalLent = summary ? formatCurrency(summary.totalLent) : '₹0.00';
  const totalRepaid = summary ? formatCurrency(summary.totalRepaid) : '₹0.00';
  const totalOutstanding = summary ? formatCurrency(summary.totalOutstanding) : '₹0.00';
  const overdueAmount = summary ? formatCurrency(summary.overdueAmount) : '₹0.00';
  const isOverdue = summary && parseFloat(summary.overdueAmount) > 0;

  return (
    <View style={styles.container}>
      {/* 1. Hero Dark Espresso Card */}
      <View style={[styles.heroCard, shadows.cardHighlight]}>
        <View style={styles.heroHeader}>
          <Text style={styles.heroEyebrow}>PORTFOLIO OVERVIEW</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {summary ? `${summary.totalLoans} Total Loans` : '0 Loans'}
            </Text>
          </View>
        </View>

        <Text style={styles.heroLabel}>Total Lent to Friends</Text>
        <Text style={styles.heroAmount}>{loading ? 'Loading...' : totalLent}</Text>

        <View style={styles.heroDivider} />

        <View style={styles.heroMetricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Total Outstanding</Text>
            <Text style={styles.metricValue}>{loading ? '...' : totalOutstanding}</Text>
          </View>
          <View style={styles.metricSeparator} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Total Repaid</Text>
            <Text style={[styles.metricValue, { color: '#C8E6C9' }]}>
              {loading ? '...' : totalRepaid}
            </Text>
          </View>
        </View>
      </View>

      {/* 2. Secondary Indicator Cards */}
      <View style={styles.secondaryRow}>
        {/* Overdue Card */}
        <View
          style={[
            styles.subCard,
            isOverdue ? styles.overdueHighlight : styles.normalSubCard,
            shadows.card,
          ]}
        >
          <View style={styles.subCardHeader}>
            <Text style={[styles.subCardTitle, isOverdue && { color: colors.statusOverdue }]}>
              {isOverdue ? '⚠️ Overdue Balance' : 'Overdue Amount'}
            </Text>
          </View>
          <Text
            style={[
              styles.subCardAmount,
              isOverdue ? { color: colors.statusOverdue } : { color: colors.darkEspresso },
            ]}
          >
            {loading ? '...' : overdueAmount}
          </Text>
          <Text style={styles.subCardSub}>
            {isOverdue ? 'Requires immediate follow-up' : 'All loans are on schedule'}
          </Text>
        </View>

        {/* Loan Counts Card */}
        <View style={[styles.subCard, styles.normalSubCard, shadows.card]}>
          <Text style={styles.subCardTitle}>Loan Status</Text>
          <View style={styles.countRow}>
            <View style={styles.countItem}>
              <Text style={styles.countNumber}>
                {summary ? summary.pendingLoans : 0}
              </Text>
              <Text style={styles.countLabel}>Pending</Text>
            </View>
            <View style={styles.countSeparator} />
            <View style={styles.countItem}>
              <Text style={[styles.countNumber, { color: colors.statusRepaid }]}>
                {summary ? summary.repaidLoans : 0}
              </Text>
              <Text style={styles.countLabel}>Repaid</Text>
            </View>
          </View>
          <Text style={styles.subCardSub}>
            {summary?.totalLoans ? `${summary.repaidLoans} of ${summary.totalLoans} settled` : 'No loans yet'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  heroCard: {
    backgroundColor: colors.cardEspresso,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.warmTaupe,
    letterSpacing: 1,
  },
  badge: {
    backgroundColor: 'rgba(248, 244, 225, 0.12)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.round,
  },
  badgeText: {
    color: colors.cream,
    fontSize: 11,
    fontWeight: '600',
  },
  heroLabel: {
    fontSize: 14,
    color: colors.cardEspressoSub,
    marginTop: spacing.xs,
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.cream,
    marginVertical: spacing.xs,
    letterSpacing: 0.5,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(248, 244, 225, 0.15)',
    marginVertical: spacing.md,
  },
  heroMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
  },
  metricSeparator: {
    width: 1,
    backgroundColor: 'rgba(248, 244, 225, 0.15)',
    marginHorizontal: spacing.md,
  },
  metricLabel: {
    fontSize: 12,
    color: colors.cardEspressoSub,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.cream,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  subCard: {
    flex: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  normalSubCard: {
    backgroundColor: colors.surfaceCardCream,
    borderWidth: 1,
    borderColor: colors.border,
  },
  overdueHighlight: {
    backgroundColor: colors.statusOverdueBg,
    borderWidth: 1,
    borderColor: colors.statusOverdueBorder,
  },
  subCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  subCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.darkEspresso,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subCardAmount: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  subCardSub: {
    fontSize: 11,
    color: colors.darkEspresso,
    opacity: 0.7,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  countItem: {
    alignItems: 'center',
    flex: 1,
  },
  countSeparator: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  countNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.darkEspresso,
  },
  countLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.darkEspresso,
    opacity: 0.8,
  },
});
