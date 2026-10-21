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
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, borderRadius, shadows } from '../theme';
import { InputField } from '../components/InputField';
import { PrimaryButton } from '../components/PrimaryButton';
import { api } from '../api/client';
import { Loan } from '../types';
import { validateDueDate } from '../utils/validation';

interface AddLoanScreenProps {
  onBack: () => void;
  onLoanCreated: () => void;
}

interface SelectedReceipt {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  file?: any;
}

export const AddLoanScreen: React.FC<AddLoanScreenProps> = ({
  onBack,
  onLoanCreated,
}) => {
  const [friendName, setFriendName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    // Default to 14 days from today in YYYY-MM-DD format
    const defaultDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    return defaultDate.toISOString().split('T')[0];
  });
  const [selectedReceipt, setSelectedReceipt] = useState<SelectedReceipt | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [createdLoanForRetry, setCreatedLoanForRetry] = useState<Loan | null>(null);
  const [receiptUploadError, setReceiptUploadError] = useState<string | null>(null);
  const [retryingReceipt, setRetryingReceipt] = useState(false);
  const [errors, setErrors] = useState<{
    friendName?: string;
    amount?: string;
    dueDate?: string;
  }>({});

  // Quick Due Date Preset buttons helper
  const setDaysPreset = (days: number) => {
    const target = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    setDueDate(target.toISOString().split('T')[0]);
    if (errors.dueDate) setErrors((prev) => ({ ...prev, dueDate: undefined }));
    if (apiError) setApiError(null);
  };

  const handlePickReceipt = async () => {
    setReceiptError(null);
    setApiError(null);
    setCreatedLoanForRetry(null);
    setReceiptUploadError(null);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const webFile = (asset as any).file as File | undefined;

      // File size validation (5MB max)
      const fileSize = webFile?.size || asset.fileSize;
      if (fileSize && fileSize > 5 * 1024 * 1024) {
        setReceiptError('File too large. Maximum allowed receipt size is 5MB.');
        return;
      }

      // MIME type and file extension validation
      const rawName = webFile?.name || asset.fileName || 'receipt.jpg';
      const ext = rawName.split('.').pop()?.toLowerCase();
      const mime = (webFile?.type || asset.mimeType || '').toLowerCase();

      const isAllowedExt = ext === 'jpg' || ext === 'jpeg' || ext === 'png';
      const isAllowedMime = mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/jpg';

      if (!isAllowedExt && !isAllowedMime) {
        setReceiptError('Invalid file type. Only JPEG and PNG images are allowed.');
        return;
      }

      const normalizedMime = (mime.includes('png') || ext === 'png') ? 'image/png' : 'image/jpeg';
      const normalizedExt = normalizedMime === 'image/png' ? 'png' : 'jpg';
      const normalizedName = rawName.includes('.') ? rawName : `${rawName}.${normalizedExt}`;

      setSelectedReceipt({
        uri: asset.uri,
        name: normalizedName,
        mimeType: normalizedMime,
        size: fileSize,
        file: webFile || null,
      });
    } catch {
      setReceiptError('Could not open image picker. Please try again.');
    }
  };

  const handleRemoveReceipt = () => {
    setSelectedReceipt(null);
    setReceiptError(null);
    setCreatedLoanForRetry(null);
    setReceiptUploadError(null);
  };

  const validate = () => {
    const newErrors: typeof errors = {};

    if (!friendName.trim()) {
      newErrors.friendName = 'Friend name is required';
    }

    const numAmount = parseFloat(amount);
    if (!amount.trim() || isNaN(numAmount) || numAmount <= 0 || !isFinite(numAmount)) {
      newErrors.amount = 'Please enter a valid amount greater than ₹0';
    }

    const dateError = validateDueDate(dueDate);
    if (dateError) {
      newErrors.dueDate = dateError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateLoan = async () => {
    setApiError(null);
    setReceiptUploadError(null);
    if (!validate()) return;

    setLoading(true);
    let createdLoan: Loan | null = null;
    try {
      // 1. Create loan record
      createdLoan = await api.createLoan({
        friendName: friendName.trim(),
        amount: parseFloat(amount),
        dueDate: dueDate.trim(),
      });
    } catch (err: any) {
      const msg = err.message || 'Failed to record loan. Please check your inputs.';
      setApiError(msg);
      setLoading(false);
      return;
    }

    // 2. Upload optional receipt photo if selected
    if (selectedReceipt && createdLoan) {
      try {
        await api.uploadReceipt(createdLoan.id, selectedReceipt);
      } catch (uploadErr: any) {
        // Loan was created, but receipt upload failed!
        // Visibly explain and offer a retry or proceed option
        const errMsg = uploadErr.message || 'Failed to upload receipt photo.';
        setCreatedLoanForRetry(createdLoan);
        setReceiptUploadError(errMsg);
        setLoading(false);
        return;
      }
    }

    setLoading(false);

    // 3. Success navigation
    if (Platform.OS === 'web') {
      onLoanCreated();
    } else {
      Alert.alert('Success', `Loan for ${friendName.trim()} created successfully!`, [
        { text: 'OK', onPress: onLoanCreated },
      ]);
    }
  };

  const handleRetryReceiptUpload = async () => {
    if (!createdLoanForRetry || !selectedReceipt) return;
    setRetryingReceipt(true);
    setReceiptUploadError(null);
    try {
      await api.uploadReceipt(createdLoanForRetry.id, selectedReceipt);
      setRetryingReceipt(false);
      if (Platform.OS === 'web') {
        onLoanCreated();
      } else {
        Alert.alert('Success', 'Receipt uploaded successfully!', [
          { text: 'OK', onPress: onLoanCreated },
        ]);
      }
    } catch (err: any) {
      setReceiptUploadError(err.message || 'Retry failed. Please check network connection.');
      setRetryingReceipt(false);
    }
  };

  const handleSkipReceiptAndFinish = () => {
    onLoanCreated();
  };


  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.headerBack} activeOpacity={0.7}>
            <Text style={styles.headerBackText}>← Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Record New Loan</Text>
          <View style={{ width: 70 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.card, shadows.cardHighlight]}>
            <Text style={styles.cardHeading}>Loan Details</Text>
            <Text style={styles.cardSub}>
              Enter the borrower's name, principal amount, and expected repayment date.
            </Text>

            {/* In-page visible error banner */}
            {apiError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>⚠️ {apiError}</Text>
              </View>
            ) : null}

            {/* Friend Name */}
            <InputField
              label="Friend's Full Name"
              placeholder="e.g. Rahul Sharma"
              value={friendName}
              onChangeText={(text) => {
                setFriendName(text);
                if (errors.friendName) setErrors((prev) => ({ ...prev, friendName: undefined }));
                if (apiError) setApiError(null);
              }}
              error={errors.friendName}
              autoCapitalize="words"
            />

            {/* Amount in INR */}
            <InputField
              label="Loan Amount (INR)"
              placeholder="5000"
              keyboardType="decimal-pad"
              prefix="₹"
              value={amount}
              onChangeText={(text) => {
                setAmount(text);
                if (errors.amount) setErrors((prev) => ({ ...prev, amount: undefined }));
                if (apiError) setApiError(null);
              }}
              error={errors.amount}
            />

            {/* Due Date */}
            <InputField
              label="Due Date (YYYY-MM-DD)"
              placeholder="2026-11-15"
              value={dueDate}
              onChangeText={(text) => {
                setDueDate(text);
                if (errors.dueDate) setErrors((prev) => ({ ...prev, dueDate: undefined }));
                if (apiError) setApiError(null);
              }}
              error={errors.dueDate}
            />

            {/* Preset Date Shortcuts */}
            <Text style={styles.presetLabel}>Quick Due Date Presets:</Text>
            <View style={styles.presetRow}>
              {[
                { label: '7 Days', days: 7 },
                { label: '14 Days', days: 14 },
                { label: '30 Days', days: 30 },
                { label: '60 Days', days: 60 },
              ].map((item) => (
                <TouchableOpacity
                  key={item.days}
                  style={styles.presetChip}
                  onPress={() => setDaysPreset(item.days)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetChipText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Optional Receipt Photo Section */}
            <Text style={styles.presetLabel}>Receipt Photo (Optional):</Text>
            {selectedReceipt ? (
              <View style={styles.receiptPreviewContainer}>
                <Image
                  source={{ uri: selectedReceipt.uri }}
                  style={styles.receiptThumbnail}
                  resizeMode="cover"
                />
                <View style={styles.receiptInfoCol}>
                  <Text style={styles.receiptFilename} numberOfLines={1}>
                    📄 {selectedReceipt.name}
                  </Text>
                  {selectedReceipt.size ? (
                    <Text style={styles.receiptSizeText}>
                      {(selectedReceipt.size / 1024).toFixed(0)} KB • Ready to save
                    </Text>
                  ) : (
                    <Text style={styles.receiptSizeText}>Photo selected • Ready to save</Text>
                  )}
                  <TouchableOpacity
                    onPress={handleRemoveReceipt}
                    style={styles.removeReceiptButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.removeReceiptButtonText}>✕ Remove Photo</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.receiptPickerBox}
                onPress={handlePickReceipt}
                activeOpacity={0.8}
              >
                <Text style={styles.receiptPickerIcon}>📷</Text>
                <View style={styles.receiptPickerTextGroup}>
                  <Text style={styles.receiptPickerTitle}>Attach Loan Receipt / Photo</Text>
                  <Text style={styles.receiptPickerSubtitle}>
                    PNG or JPEG up to 5MB (Optional)
                  </Text>
                </View>
                <Text style={styles.receiptPickerAction}>Browse</Text>
              </TouchableOpacity>
            )}

            {receiptError ? (
              <Text style={styles.receiptErrorText}>⚠️ {receiptError}</Text>
            ) : null}

            {/* Visible Failure & Retry Banner if Loan was created but Receipt upload failed */}
            {createdLoanForRetry && receiptUploadError ? (
              <View style={styles.uploadFailureCard}>
                <Text style={styles.uploadFailureTitle}>
                  ⚠️ Loan Saved, but Receipt Upload Failed
                </Text>
                <Text style={styles.uploadFailureMessage}>
                  Your loan record for "{createdLoanForRetry.friendName}" has been saved, but attaching the receipt photo encountered an issue:
                </Text>
                <Text style={styles.uploadFailureErrorDetail}>
                  "{receiptUploadError}"
                </Text>

                <View style={styles.retryButtonGroup}>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={handleRetryReceiptUpload}
                    disabled={retryingReceipt}
                    activeOpacity={0.8}
                  >
                    {retryingReceipt ? (
                      <ActivityIndicator size="small" color={colors.cream} />
                    ) : (
                      <Text style={styles.retryButtonText}>🔄 Retry Receipt Upload</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.skipButton}
                    onPress={handleSkipReceiptAndFinish}
                    disabled={retryingReceipt}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.skipButtonText}>Continue to Dashboard Without Receipt →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* Action Buttons */}
            <View style={styles.buttonGroup}>
              <PrimaryButton
                title={loading ? 'Saving...' : 'Save Loan Record'}
                onPress={handleCreateLoan}
                loading={loading}
                disabled={loading || retryingReceipt}
                style={styles.saveButton}
              />

              <TouchableOpacity
                onPress={onBack}
                disabled={loading || retryingReceipt}
                style={styles.cancelLink}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelLinkText}>Discard & Return</Text>
              </TouchableOpacity>
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
  headerBack: {
    width: 70,
  },
  headerBackText: {
    fontSize: 14,
    color: colors.earthyBrown,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.darkEspresso,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surfaceCardLight,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.darkEspresso,
    marginBottom: spacing.xs,
  },
  cardSub: {
    fontSize: 13,
    color: colors.darkEspresso,
    opacity: 0.75,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  errorBanner: {
    backgroundColor: colors.statusOverdueBg,
    borderColor: colors.statusOverdueBorder,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    color: colors.statusOverdue,
    fontSize: 13,
    fontWeight: '600',
  },
  uploadFailureCard: {
    backgroundColor: colors.statusOverdueBg,
    borderColor: colors.statusOverdueBorder,
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  uploadFailureTitle: {
    color: colors.statusOverdue,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  uploadFailureMessage: {
    color: colors.darkEspresso,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 4,
  },
  uploadFailureErrorDetail: {
    color: colors.statusOverdue,
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  retryButtonGroup: {
    gap: spacing.sm,
  },
  retryButton: {
    backgroundColor: colors.earthyBrown,
    borderRadius: borderRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  retryButtonText: {
    color: colors.cream,
    fontSize: 13,
    fontWeight: '700',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  skipButtonText: {
    color: colors.placeholder,
    fontSize: 12,
    fontWeight: '600',
  },
  presetLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.placeholder,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  presetChip: {
    backgroundColor: colors.surfaceCardCream,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.darkEspresso,
  },
  receiptPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceCardCream,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.lg,
  },
  receiptThumbnail: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.warmTaupe,
    marginRight: spacing.md,
  },
  receiptInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  receiptFilename: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.darkEspresso,
    marginBottom: 2,
  },
  receiptSizeText: {
    fontSize: 11,
    color: colors.placeholder,
    marginBottom: 6,
  },
  removeReceiptButton: {
    alignSelf: 'flex-start',
  },
  removeReceiptButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.statusOverdue,
  },
  receiptPickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceCardCream,
    borderWidth: 1.5,
    borderColor: colors.warmTaupe,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  receiptPickerIcon: {
    fontSize: 22,
    marginRight: spacing.sm,
  },
  receiptPickerTextGroup: {
    flex: 1,
  },
  receiptPickerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.darkEspresso,
  },
  receiptPickerSubtitle: {
    fontSize: 11,
    color: colors.placeholder,
    marginTop: 2,
  },
  receiptPickerAction: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.earthyBrown,
    backgroundColor: '#EAE1CE',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.round,
  },
  receiptErrorText: {
    fontSize: 12,
    color: colors.statusOverdue,
    fontWeight: '600',
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  buttonGroup: {
    marginTop: spacing.xs,
  },
  saveButton: {
    marginBottom: spacing.md,
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  cancelLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.placeholder,
  },
});


