import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../theme';
import { Loan } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { api } from '../api/client';

interface LoanCardProps {
  loan: Loan;
  onRepay: (loanId: number) => void;
  repaying?: boolean;
}

export const LoanCard: React.FC<LoanCardProps> = ({ loan, onRepay, repaying = false }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const isOverdue = !loan.isRepaid && new Date(loan.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));

  const handleOpenReceipt = async () => {
    setModalVisible(true);
    setReceiptError(null);
    if (receiptUrl) return; // Already cached
    setLoadingReceipt(true);
    try {
      const url = await api.getReceiptBlobUrl(loan.id);
      setReceiptUrl(url);
    } catch (err: any) {
      setReceiptError(err.message || 'Unable to load receipt photo.');
    } finally {
      setLoadingReceipt(false);
    }
  };

  const getStatusBadge = () => {
    if (loan.isRepaid) {
      return (
        <View style={[styles.badge, styles.badgeRepaid]}>
          <Text style={[styles.badgeText, { color: colors.statusRepaid }]}>✓ REPAID</Text>
        </View>
      );
    }
    if (isOverdue) {
      return (
        <View style={[styles.badge, styles.badgeOverdue]}>
          <Text style={[styles.badgeText, { color: colors.statusOverdue }]}>⚠️ OVERDUE</Text>
        </View>
      );
    }
    return (
      <View style={[styles.badge, styles.badgePending]}>
        <Text style={[styles.badgeText, { color: colors.earthyBrown }]}>⏳ PENDING</Text>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.card,
        loan.isRepaid ? styles.cardRepaid : isOverdue ? styles.cardOverdue : styles.cardPending,
        shadows.card,
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.friendInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {loan.friendName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.friendTextCol}>
            <Text style={styles.friendName} numberOfLines={1} ellipsizeMode="tail">
              {loan.friendName}
            </Text>
            <Text style={styles.createdDate} numberOfLines={1}>
              Lent on {formatDate(loan.createdAt)}
            </Text>
          </View>
        </View>
        <View style={styles.badgesCol}>
          {getStatusBadge()}
          {loan.hasReceipt && (
            <TouchableOpacity
              style={styles.receiptChip}
              onPress={handleOpenReceipt}
              activeOpacity={0.7}
            >
              <Text style={styles.receiptChipText}>📎 Receipt</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.amountRow}>
        <View>
          <Text style={styles.amountLabel}>Principal Amount</Text>
          <Text
            style={[
              styles.amountValue,
              loan.isRepaid
                ? { color: colors.warmTaupe }
                : isOverdue
                ? { color: colors.statusOverdue }
                : { color: colors.darkEspresso },
            ]}
          >
            {formatCurrency(loan.amount)}
          </Text>
        </View>

        <View style={styles.dueInfo}>
          <Text style={styles.dueLabel}>
            {loan.isRepaid ? 'Settled Date' : 'Due Date'}
          </Text>
          <Text
            style={[
              styles.dueValue,
              isOverdue && !loan.isRepaid && { color: colors.statusOverdue, fontWeight: '700' },
            ]}
          >
            {loan.isRepaid && loan.repaidAt ? formatDate(loan.repaidAt) : formatDate(loan.dueDate)}
          </Text>
        </View>
      </View>

      {/* Action button: only shown for unpaid loans */}
      {!loan.isRepaid && (
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.repayButton}
            onPress={() => onRepay(loan.id)}
            disabled={repaying}
            activeOpacity={0.8}
          >
            {repaying ? (
              <ActivityIndicator size="small" color={colors.cream} />
            ) : (
              <Text style={styles.repayButtonText}>✓ Mark as Repaid</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Receipt Photo Modal Viewer */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, shadows.cardHighlight]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Loan Receipt</Text>
                <Text style={styles.modalSub}>
                  {loan.friendName} • {formatCurrency(loan.amount)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {loadingReceipt ? (
                <View style={styles.modalLoadingBox}>
                  <ActivityIndicator size="large" color={colors.earthyBrown} />
                  <Text style={styles.modalLoadingText}>Loading secure receipt...</Text>
                </View>
              ) : receiptError ? (
                <View style={styles.modalErrorBox}>
                  <Text style={styles.modalErrorText}>⚠️ {receiptError}</Text>
                </View>
              ) : receiptUrl ? (
                <Image
                  source={{ uri: receiptUrl }}
                  style={styles.modalReceiptImage}
                  resizeMode="contain"
                />
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.modalDismissBtn}
              onPress={() => setModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalDismissBtnText}>Close Preview</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceCardLight,
    borderWidth: 1,
  },
  cardPending: {
    borderColor: colors.border,
  },
  cardOverdue: {
    borderColor: colors.statusOverdueBorder,
    backgroundColor: '#FFF8F7',
  },
  cardRepaid: {
    borderColor: colors.border,
    backgroundColor: '#FAFAF7',
    opacity: 0.88,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: spacing.xs,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.round,
    backgroundColor: colors.warmTaupe,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    flexShrink: 0,
  },
  friendTextCol: {
    flex: 1,
    minWidth: 0,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.cream,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.darkEspresso,
  },
  createdDate: {
    fontSize: 11,
    color: colors.placeholder,
    marginTop: 1,
  },
  badgesCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 4,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.round,
    borderWidth: 1,
  },
  badgePending: {
    backgroundColor: colors.statusPendingBg,
    borderColor: colors.statusPendingBorder,
  },
  badgeOverdue: {
    backgroundColor: colors.statusOverdueBg,
    borderColor: colors.statusOverdueBorder,
  },
  badgeRepaid: {
    backgroundColor: colors.statusRepaidBg,
    borderColor: colors.statusRepaidBorder,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  receiptChip: {
    backgroundColor: colors.surfaceCardCream,
    borderWidth: 1,
    borderColor: colors.warmTaupe,
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: 2,
  },
  receiptChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.earthyBrown,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#F0E8DC',
    marginTop: spacing.xs,
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.placeholder,
    textTransform: 'uppercase',
  },
  amountValue: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  dueInfo: {
    alignItems: 'flex-end',
  },
  dueLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.placeholder,
    textTransform: 'uppercase',
  },
  dueValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.darkEspresso,
    marginTop: 2,
  },
  actionContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F0E8DC',
  },
  repayButton: {
    backgroundColor: colors.earthyBrown,
    borderRadius: borderRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repayButtonText: {
    color: colors.cream,
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(84, 51, 16, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surfaceCardLight,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E8DC',
    paddingBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.darkEspresso,
  },
  modalSub: {
    fontSize: 12,
    color: colors.placeholder,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: spacing.xs,
  },
  modalCloseBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.darkEspresso,
  },
  modalBody: {
    minHeight: 220,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalReceiptImage: {
    width: '100%',
    height: 260,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceCardCream,
  },
  modalLoadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalLoadingText: {
    fontSize: 13,
    color: colors.darkEspresso,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  modalErrorBox: {
    padding: spacing.md,
    backgroundColor: colors.statusOverdueBg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.statusOverdueBorder,
  },
  modalErrorText: {
    color: colors.statusOverdue,
    fontSize: 13,
    fontWeight: '600',
  },
  modalDismissBtn: {
    backgroundColor: colors.earthyBrown,
    borderRadius: borderRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalDismissBtnText: {
    color: colors.cream,
    fontSize: 13,
    fontWeight: '700',
  },
});

