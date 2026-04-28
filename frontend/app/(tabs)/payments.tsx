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
import { useCustomization } from '../../src/context/CustomizationContext';

// Static colors (non-primary)
const COLORS = {
  secondary: '#333333',
  white: '#FFFFFF',
  lightGray: '#F5F5F5',
  gray: '#767676',
  darkGray: '#333333',
  black: '#000000',
  success: '#00847F',
  background: '#F5F5F5',
};

export default function PaymentsScreen() {
  const { colors: customColors } = useCustomization();
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
      currency: 'GBP',
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
      Alert.alert('Insufficient Funds', 'You do not have enough balance');
      return;
    }

    setIsProcessing(true);
    try {
      await billersApi.pay({
        from_account_id: selectedAccount.id,
        biller_id: selectedBiller.id,
        amount: paymentAmount,
      });

      Alert.alert('Payment Successful', `${formatCurrency(paymentAmount)} paid to ${selectedBiller.name}`, [
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
      Alert.alert('Payment Failed', error.response?.data?.detail || 'Unable to process payment');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={customColors.primary} />
      </SafeAreaView>
    );
  }

  // Service categories
  const serviceCategories = [
    { icon: 'receipt-outline', label: 'Pay Bills', color: customColors.primary },
    { icon: 'phone-portrait-outline', label: 'Mobile Top-up', color: '#5856D6' },
    { icon: 'card-outline', label: 'Credit Card', color: '#FF9500' },
    { icon: 'cash-outline', label: 'Loan', color: '#00847F' },
    { icon: 'trending-up-outline', label: 'Investments', color: '#007AFF' },
    { icon: 'shield-outline', label: 'Insurance', color: '#34C759' },
    { icon: 'airplane-outline', label: 'Travel', color: '#AF52DE' },
    { icon: 'ellipsis-horizontal', label: 'More', color: COLORS.gray },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: customColors.primary }]}>
        <Text style={styles.headerTitle}>Services</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Service Grid */}
        <View style={styles.serviceGrid}>
          {serviceCategories.map((service, index) => (
            <TouchableOpacity key={index} style={styles.serviceItem}>
              <View style={[styles.serviceIcon, { backgroundColor: `${service.color}15` }]}>
                <Ionicons name={service.icon as any} size={24} color={service.color} />
              </View>
              <Text style={styles.serviceLabel}>{service.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Registered Billers */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Registered Billers</Text>
            <TouchableOpacity>
              <Text style={styles.addNew}>+ Add New</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.billersCard}>
            {billers.map((biller, index) => (
              <TouchableOpacity
                key={biller.id}
                style={[
                  styles.billerItem,
                  index < billers.length - 1 && styles.billerBorder
                ]}
                onPress={() => handleSelectBiller(biller)}
              >
                <View style={styles.billerLeft}>
                  <View style={styles.billerIcon}>
                    <Ionicons name={getBillerIcon(biller.icon)} size={20} color={customColors.primary} />
                  </View>
                  <View>
                    <Text style={styles.billerName}>{biller.name}</Text>
                    <Text style={styles.billerCategory}>{biller.category}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick Pay */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Pay</Text>
          <View style={styles.quickPayCard}>
            <View style={styles.quickPayRow}>
              <Ionicons name="flash" size={20} color={customColors.primary} />
              <Text style={styles.quickPayText}>Set up recurring payments</Text>
            </View>
            <TouchableOpacity style={styles.quickPayButton}>
              <Text style={styles.quickPayButtonText}>Set Up</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomPadding} />
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
                <Ionicons name="close" size={24} color={COLORS.darkGray} />
              </TouchableOpacity>
            </View>

            {selectedBiller && (
              <View style={styles.selectedBillerInfo}>
                <View style={styles.billerIconLarge}>
                  <Ionicons name={getBillerIcon(selectedBiller.icon)} size={28} color={customColors.primary} />
                </View>
                <Text style={styles.selectedBillerName}>{selectedBiller.name}</Text>
                <Text style={styles.selectedBillerAccount}>Account: {selectedBiller.account_number}</Text>
              </View>
            )}

            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>Payment Amount</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencyCode}>USD</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.gray}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  autoFocus
                />
              </View>
              {selectedAccount && (
                <Text style={styles.availableBalance}>
                  Available: {formatCurrency(selectedAccount.balance)}
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.payButton, isProcessing && styles.payButtonDisabled, { backgroundColor: customColors.primary }]}
              onPress={handlePayBill}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.payButtonText}>Pay Now</Text>
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
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    backgroundColor: '#DB0011',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: COLORS.white,
    margin: 16,
    borderRadius: 8,
    paddingVertical: 8,
  },
  serviceItem: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 16,
  },
  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  serviceLabel: {
    fontSize: 11,
    color: COLORS.darkGray,
    fontWeight: '500',
    textAlign: 'center',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.darkGray,
  },
  addNew: {
    fontSize: 14,
    color: '#DB0011',
    fontWeight: '500',
  },
  billersCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
  },
  billerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  billerBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  billerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  billerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  billerName: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.darkGray,
  },
  billerCategory: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  quickPayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
  },
  quickPayRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickPayText: {
    fontSize: 14,
    color: COLORS.darkGray,
    marginLeft: 12,
  },
  quickPayButton: {
    backgroundColor: '#DB0011',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  quickPayButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    color: COLORS.darkGray,
  },
  closeButton: {
    padding: 4,
  },
  selectedBillerInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  billerIconLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  selectedBillerName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.darkGray,
    marginBottom: 4,
  },
  selectedBillerAccount: {
    fontSize: 14,
    color: COLORS.gray,
  },
  amountSection: {
    marginBottom: 24,
  },
  amountLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.darkGray,
    marginBottom: 12,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#DB0011',
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
  payButton: {
    backgroundColor: '#DB0011',
    borderRadius: 4,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonDisabled: {
    opacity: 0.7,
  },
  payButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
