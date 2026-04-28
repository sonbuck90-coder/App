import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { accountsApi, transfersApi, Account } from '../../src/services/api';
import { lookupBank, formatSortCode, isValidSortCode, LookupResult } from '../../src/services/bank-lookup';

// HSBC Colors
const COLORS = {
  primary: '#DB0011',
  secondary: '#333333',
  white: '#FFFFFF',
  lightGray: '#F5F5F5',
  gray: '#767676',
  darkGray: '#333333',
  black: '#000000',
  success: '#00847F',
  background: '#F5F5F5',
};

export default function TransfersScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [recipientAccount, setRecipientAccount] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [sortCode, setSortCode] = useState('');
  const [bankLookupResult, setBankLookupResult] = useState<LookupResult | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await accountsApi.getAll();
      setAccounts(response.data);
      if (response.data.length > 0) {
        setSelectedAccount(response.data[0]);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const handleSortCodeChange = useCallback((text: string) => {
    const formatted = formatSortCode(text);
    setSortCode(formatted);
    
    const digits = text.replace(/\D/g, '');
    if (digits.length === 0) {
      setBankLookupResult(null);
    } else if (digits.length >= 2) {
      const result = lookupBank(digits.length >= 6 ? digits.slice(0, 6) : digits + '0'.repeat(6 - digits.length));
      if (digits.length < 6) {
        // Partial input - show preview if first 2 digits match
        const partialResult = lookupBank(digits.slice(0, 2) + '0000');
        if (partialResult.found) {
          setBankLookupResult({ ...partialResult, error: undefined });
        } else {
          setBankLookupResult(null);
        }
      } else {
        setBankLookupResult(result);
      }
    } else {
      setBankLookupResult(null);
    }
  }, []);

  const handleTransfer = async () => {
    if (!selectedAccount) {
      Alert.alert('Error', 'Please select an account');
      return;
    }

    if (!recipientAccount) {
      Alert.alert('Error', 'Please enter recipient account number');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const transferAmount = parseFloat(amount);
    if (transferAmount > selectedAccount.balance) {
      Alert.alert('Insufficient Funds', 'You do not have enough balance for this transfer');
      return;
    }

    setIsLoading(true);
    try {
      await transfersApi.create({
        from_account_id: selectedAccount.id,
        to_account_number: recipientAccount,
        amount: transferAmount,
        description: description || `Transfer to ${recipientName || recipientAccount}`,
        recipient_name: recipientName,
      });

      Alert.alert('Transfer Successful', `${formatCurrency(transferAmount)} has been transferred successfully`, [
        {
          text: 'OK',
          onPress: () => {
            setRecipientAccount('');
            setRecipientName('');
            setSortCode('');
            setBankLookupResult(null);
            setAmount('');
            setDescription('');
            fetchAccounts();
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Transfer Failed', error.response?.data?.detail || 'Unable to complete transfer');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingAccounts) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pay & Transfer</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Transfer Type Options */}
          <View style={styles.transferTypeContainer}>
            <TouchableOpacity style={[styles.transferTypeBtn, styles.transferTypeBtnActive]}>
              <Ionicons name="swap-horizontal" size={20} color={COLORS.primary} />
              <Text style={[styles.transferTypeText, styles.transferTypeTextActive]}>Transfer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.transferTypeBtn}>
              <Ionicons name="person-outline" size={20} color={COLORS.gray} />
              <Text style={styles.transferTypeText}>Payee</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.transferTypeBtn}>
              <Ionicons name="globe-outline" size={20} color={COLORS.gray} />
              <Text style={styles.transferTypeText}>Overseas</Text>
            </TouchableOpacity>
          </View>

          {/* From Account */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>From</Text>
            <TouchableOpacity
              style={styles.accountSelector}
              onPress={() => setShowAccountPicker(!showAccountPicker)}
            >
              {selectedAccount && (
                <>
                  <View style={styles.accountInfo}>
                    <View style={[styles.accountDot, { backgroundColor: selectedAccount.account_type === 'checking' ? COLORS.primary : COLORS.success }]} />
                    <View>
                      <Text style={styles.accountType}>
                        {selectedAccount.account_type === 'checking' ? 'Current Account' : 'Savings Account'}
                      </Text>
                      <Text style={styles.accountNumber}>
                        ****{selectedAccount.account_number.slice(-4)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.accountRight}>
                    <Text style={styles.accountBalance}>
                      {formatCurrency(selectedAccount.balance)}
                    </Text>
                    <Ionicons name={showAccountPicker ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.gray} />
                  </View>
                </>
              )}
            </TouchableOpacity>

            {showAccountPicker && (
              <View style={styles.accountPicker}>
                {accounts.map((account) => (
                  <TouchableOpacity
                    key={account.id}
                    style={[
                      styles.accountPickerItem,
                      selectedAccount?.id === account.id && styles.accountPickerItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedAccount(account);
                      setShowAccountPicker(false);
                    }}
                  >
                    <View style={styles.accountPickerLeft}>
                      <View style={[styles.accountDot, { backgroundColor: account.account_type === 'checking' ? COLORS.primary : COLORS.success }]} />
                      <Text style={styles.accountPickerText}>
                        {account.account_type === 'checking' ? 'Current' : 'Savings'} - {formatCurrency(account.balance)}
                      </Text>
                    </View>
                    {selectedAccount?.id === account.id && (
                      <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Recipient Details */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>To</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Recipient Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter recipient name"
                placeholderTextColor={COLORS.gray}
                value={recipientName}
                onChangeText={setRecipientName}
                testID="recipient-name-input"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Sort Code</Text>
              <TextInput
                style={[
                  styles.input,
                  bankLookupResult?.found && styles.inputSuccess,
                  bankLookupResult && !bankLookupResult.found && isValidSortCode(sortCode) && styles.inputWarning,
                ]}
                placeholder="XX-XX-XX"
                placeholderTextColor={COLORS.gray}
                value={sortCode}
                onChangeText={handleSortCodeChange}
                keyboardType="numeric"
                maxLength={8}
                testID="sort-code-input"
              />
              {/* Bank Name Lookup Result */}
              {bankLookupResult && (
                <View style={styles.bankLookupContainer}>
                  {bankLookupResult.found && bankLookupResult.bank ? (
                    <View style={styles.bankFound}>
                      <View style={styles.bankIconContainer}>
                        <Ionicons name="business" size={16} color={COLORS.success} />
                      </View>
                      <View style={styles.bankInfoContainer}>
                        <Text style={styles.bankName}>{bankLookupResult.bank.name}</Text>
                        <Text style={styles.bankShortName}>{bankLookupResult.bank.shortName}</Text>
                      </View>
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                    </View>
                  ) : bankLookupResult.error && isValidSortCode(sortCode) ? (
                    <View style={styles.bankNotFound}>
                      <Ionicons name="alert-circle" size={18} color="#E67E22" />
                      <Text style={styles.bankNotFoundText}>{bankLookupResult.error}</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Account Number</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter account number"
                placeholderTextColor={COLORS.gray}
                value={recipientAccount}
                onChangeText={setRecipientAccount}
                keyboardType="numeric"
                testID="account-number-input"
              />
            </View>
          </View>

          {/* Amount */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Amount</Text>
            <View style={styles.amountCard}>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencyCode}>USD</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.gray}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
              </View>
              {selectedAccount && (
                <Text style={styles.availableBalance}>
                  Available: {formatCurrency(selectedAccount.balance)}
                </Text>
              )}
            </View>
          </View>

          {/* Reference */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Reference (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Add a note"
              placeholderTextColor={COLORS.gray}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* Transfer Button */}
          <TouchableOpacity
            style={[styles.transferButton, isLoading && styles.transferButtonDisabled]}
            onPress={handleTransfer}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.transferButtonText}>Transfer Now</Text>
            )}
          </TouchableOpacity>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.white,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  transferTypeContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    margin: 16,
    borderRadius: 8,
    padding: 8,
  },
  transferTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 6,
  },
  transferTypeBtnActive: {
    backgroundColor: '#FFF0F0',
  },
  transferTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.gray,
    marginLeft: 6,
  },
  transferTypeTextActive: {
    color: COLORS.primary,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.darkGray,
    marginBottom: 12,
  },
  accountSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  accountType: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.darkGray,
  },
  accountNumber: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
  accountRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountBalance: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.darkGray,
    marginRight: 8,
  },
  accountPicker: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    marginTop: 8,
    padding: 8,
  },
  accountPickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 6,
  },
  accountPickerItemSelected: {
    backgroundColor: '#FFF0F0',
  },
  accountPickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountPickerText: {
    fontSize: 14,
    color: COLORS.darkGray,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 4,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 15,
    color: COLORS.black,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  inputSuccess: {
    borderColor: COLORS.success,
    borderWidth: 1.5,
  },
  inputWarning: {
    borderColor: '#E67E22',
    borderWidth: 1.5,
  },
  bankLookupContainer: {
    marginTop: 8,
  },
  bankFound: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F8F5',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.success,
  },
  bankIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  bankInfoContainer: {
    flex: 1,
  },
  bankName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.darkGray,
  },
  bankShortName: {
    fontSize: 12,
    color: COLORS.success,
    marginTop: 1,
  },
  bankNotFound: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF5E7',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#E67E22',
  },
  bankNotFoundText: {
    fontSize: 13,
    color: '#E67E22',
    marginLeft: 8,
    fontWeight: '500',
  },
  amountCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    paddingBottom: 12,
  },
  currencyCode: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.darkGray,
    marginRight: 12,
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.darkGray,
  },
  availableBalance: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 12,
  },
  transferButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 4,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 8,
  },
  transferButtonDisabled: {
    opacity: 0.7,
  },
  transferButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 40,
  },
});
