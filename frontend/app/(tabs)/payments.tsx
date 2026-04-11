import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { accountsApi, billersApi, Account, Biller } from '../../src/services/api';

export default function PaymentsScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [billers, setBillers] = useState<Biller[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedBiller, setSelectedBiller] = useState<Biller | null>(null);
  const [amount, setAmount] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [accountsRes, billersRes] = await Promise.all([
        accountsApi.getAll(),
        billersApi.getAll(),
      ]);
      setAccounts(accountsRes.data);
      setBillers(billersRes.data);
      if (accountsRes.data.length > 0) {
        setSelectedAccount(accountsRes.data[0]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const getBillerIcon = (icon: string): keyof typeof Ionicons.glyphMap => {
    const iconMap: { [key: string]: keyof typeof Ionicons.glyphMap } = {
      flash: 'flash',
      water: 'water',
      wifi: 'wifi',
      'phone-portrait': 'phone-portrait',
      'shield-checkmark': 'shield-checkmark',
      flame: 'flame',
      tv: 'tv',
      card: 'card',
    };
    return iconMap[icon] || 'receipt';
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      utilities: '#FF9500',
      internet: '#5856D6',
      phone: '#00C7BE',
      insurance: '#34C759',
      entertainment: '#FF2D55',
      finance: '#0066FF',
    };
    return colors[category] || '#666666';
  };

  const handleSelectBiller = (biller: Biller) => {
    setSelectedBiller(biller);
    setShowPaymentModal(true);
  };

  const handlePayBill = async () => {
    if (!selectedAccount || !selectedBiller) return;

    const paymentAmount = parseFloat(amount);
    if (!paymentAmount || paymentAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (paymentAmount > selectedAccount.balance) {
      Alert.alert('Error', 'Insufficient funds');
      return;
    }

    setIsProcessing(true);
    try {
      await billersApi.pay({
        from_account_id: selectedAccount.id,
        biller_id: selectedBiller.id,
        amount: paymentAmount,
      });

      Alert.alert('Success', `Payment of ${formatCurrency(paymentAmount)} to ${selectedBiller.name} successful!`, [
        {
          text: 'OK',
          onPress: () => {
            setShowPaymentModal(false);
            setAmount('');
            setSelectedBiller(null);
            fetchData();
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066FF" />
      </SafeAreaView>
    );
  }

  const groupedBillers = billers.reduce((acc, biller) => {
    if (!acc[biller.category]) {
      acc[biller.category] = [];
    }
    acc[biller.category].push(biller);
    return acc;
  }, {} as { [key: string]: Biller[] });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Pay Bills</Text>
          <Text style={styles.headerSubtitle}>Select a biller to make payment</Text>
        </View>

        {/* Account Balance */}
        {selectedAccount && (
          <View style={styles.balanceCard}>
            <View style={styles.balanceInfo}>
              <Text style={styles.balanceLabel}>Available Balance</Text>
              <Text style={styles.balanceAmount}>{formatCurrency(selectedAccount.balance)}</Text>
            </View>
            <View style={styles.accountBadge}>
              <Text style={styles.accountBadgeText}>
                {selectedAccount.account_type.charAt(0).toUpperCase() +
                  selectedAccount.account_type.slice(1)}
              </Text>
            </View>
          </View>
        )}

        {/* Billers by Category */}
        {Object.entries(groupedBillers).map(([category, categoryBillers]) => (
          <View key={category} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </Text>
            <View style={styles.billersGrid}>
              {categoryBillers.map((biller) => (
                <TouchableOpacity
                  key={biller.id}
                  style={styles.billerCard}
                  onPress={() => handleSelectBiller(biller)}
                >
                  <View
                    style={[
                      styles.billerIcon,
                      { backgroundColor: `${getCategoryColor(biller.category)}20` },
                    ]}
                  >
                    <Ionicons
                      name={getBillerIcon(biller.icon)}
                      size={24}
                      color={getCategoryColor(biller.category)}
                    />
                  </View>
                  <Text style={styles.billerName}>{biller.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pay Bill</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowPaymentModal(false);
                  setAmount('');
                }}
              >
                <Ionicons name="close" size={24} color="#666666" />
              </TouchableOpacity>
            </View>

            {selectedBiller && (
              <View style={styles.selectedBillerInfo}>
                <View
                  style={[
                    styles.billerIconLarge,
                    { backgroundColor: `${getCategoryColor(selectedBiller.category)}20` },
                  ]}
                >
                  <Ionicons
                    name={getBillerIcon(selectedBiller.icon)}
                    size={32}
                    color={getCategoryColor(selectedBiller.category)}
                  />
                </View>
                <Text style={styles.selectedBillerName}>{selectedBiller.name}</Text>
                <Text style={styles.selectedBillerAccount}>Account: {selectedBiller.account_number}</Text>
              </View>
            )}

            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>Enter Amount</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  placeholderTextColor="#CCCCCC"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  autoFocus
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.payButton, isProcessing && styles.payButtonDisabled]}
              onPress={handlePayBill}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.payButtonText}>Confirm Payment</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  balanceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0066FF',
    marginHorizontal: 24,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  balanceInfo: {},
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  accountBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  accountBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  categorySection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 16,
  },
  billersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  billerCard: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: '1%',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  billerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  billerName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1A1A2E',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  closeButton: {
    padding: 4,
  },
  selectedBillerInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  billerIconLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  selectedBillerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  selectedBillerAccount: {
    fontSize: 14,
    color: '#666666',
  },
  amountSection: {
    marginBottom: 24,
  },
  amountLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 12,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1A1A2E',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0066FF',
    borderRadius: 12,
    height: 56,
  },
  payButtonDisabled: {
    opacity: 0.7,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
