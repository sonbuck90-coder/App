import React, { useState, useEffect } from 'react';
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

export default function TransfersScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [recipientAccount, setRecipientAccount] = useState('');
  const [recipientName, setRecipientName] = useState('');
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
      Alert.alert('Error', 'Insufficient funds');
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

      Alert.alert('Success', `${formatCurrency(transferAmount)} transferred successfully!`, [
        {
          text: 'OK',
          onPress: () => {
            setRecipientAccount('');
            setRecipientName('');
            setAmount('');
            setDescription('');
            fetchAccounts();
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Transfer failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingAccounts) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066FF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Send Money</Text>
            <Text style={styles.headerSubtitle}>Transfer funds to another account</Text>
          </View>

          {/* From Account */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>From Account</Text>
            <TouchableOpacity
              style={styles.accountSelector}
              onPress={() => setShowAccountPicker(!showAccountPicker)}
            >
              {selectedAccount && (
                <>
                  <View style={styles.accountInfo}>
                    <View style={styles.accountIconContainer}>
                      <Ionicons
                        name={selectedAccount.account_type === 'checking' ? 'wallet' : 'cash'}
                        size={20}
                        color="#0066FF"
                      />
                    </View>
                    <View>
                      <Text style={styles.accountType}>
                        {selectedAccount.account_type.charAt(0).toUpperCase() +
                          selectedAccount.account_type.slice(1)}
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
                    <Ionicons name="chevron-down" size={20} color="#666666" />
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
                    <Text style={styles.accountPickerText}>
                      {account.account_type.charAt(0).toUpperCase() +
                        account.account_type.slice(1)}{' '}
                      - {formatCurrency(account.balance)}
                    </Text>
                    {selectedAccount?.id === account.id && (
                      <Ionicons name="checkmark" size={20} color="#0066FF" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Recipient Details */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Recipient Details</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#666666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Recipient name (optional)"
                placeholderTextColor="#999999"
                value={recipientName}
                onChangeText={setRecipientName}
              />
            </View>
            <View style={styles.inputContainer}>
              <Ionicons name="card-outline" size={20} color="#666666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Account number"
                placeholderTextColor="#999999"
                value={recipientAccount}
                onChangeText={setRecipientAccount}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Amount */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Amount</Text>
            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor="#CCCCCC"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Description (optional)</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="document-text-outline" size={20} color="#666666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="What's this for?"
                placeholderTextColor="#999999"
                value={description}
                onChangeText={setDescription}
              />
            </View>
          </View>

          {/* Transfer Button */}
          <TouchableOpacity
            style={[styles.transferButton, isLoading && styles.transferButtonDisabled]}
            onPress={handleTransfer}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#FFFFFF" />
                <Text style={styles.transferButtonText}>Send Money</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666666',
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 12,
  },
  accountSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F0FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  accountType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  accountNumber: {
    fontSize: 14,
    color: '#666666',
  },
  accountRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountBalance: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
    marginRight: 8,
  },
  accountPicker: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  accountPickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  accountPickerItemSelected: {
    backgroundColor: '#E8F0FE',
  },
  accountPickerText: {
    fontSize: 14,
    color: '#1A1A2E',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A2E',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '600',
    color: '#1A1A2E',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 40,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  transferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0066FF',
    borderRadius: 12,
    height: 56,
    marginHorizontal: 24,
    marginBottom: 24,
  },
  transferButtonDisabled: {
    opacity: 0.7,
  },
  transferButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
