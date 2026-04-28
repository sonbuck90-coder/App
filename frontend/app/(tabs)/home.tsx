import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { dashboardApi, accountsApi, notificationsApi, Account, DashboardStats } from '../../src/services/api';

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

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchData = async () => {
    try {
      const [statsRes, accountsRes, unreadRes] = await Promise.all([
        dashboardApi.getStats(),
        accountsApi.getAll(),
        notificationsApi.getUnreadCount(),
      ]);
      setStats(statsRes.data);
      setAccounts(accountsRes.data);
      setUnreadCount(unreadRes.data.count);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'transfer':
        return 'arrow-forward';
      case 'payment':
        return 'receipt';
      case 'deposit':
        return 'arrow-down';
      case 'withdrawal':
        return 'arrow-up';
      default:
        return 'cash';
    }
  };

  if (isLoading) {
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
        <View style={styles.headerTop}>
          <View style={styles.logoContainer}>
            <View style={styles.hexagonRow}>
              <View style={[styles.hexagon, styles.hexagonRed]} />
              <View style={[styles.hexagon, styles.hexagonWhite]} />
            </View>
            <View style={styles.hexagonRow}>
              <View style={[styles.hexagon, styles.hexagonWhite]} />
              <View style={[styles.hexagon, styles.hexagonRed]} />
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerIcon}>
              <Ionicons name="search" size={22} color={COLORS.white} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIcon} onPress={() => router.push('/notifications')} testID="notification-bell">
              <Ionicons name="notifications-outline" size={22} color={COLORS.white} />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'User'}</Text>
        <Text style={styles.lastLogin}>Last logged in: Today at {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Total Balance Card */}
        <View style={styles.totalBalanceCard}>
          <Text style={styles.totalBalanceLabel}>Total Relationship Balance</Text>
          <Text style={styles.totalBalanceAmount}>
            {formatCurrency(stats?.total_balance || 0)}
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity style={styles.quickAction}>
            <View style={styles.quickActionIcon}>
              <Ionicons name="swap-horizontal" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.quickActionText}>Transfer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <View style={styles.quickActionIcon}>
              <Ionicons name="receipt-outline" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.quickActionText}>Pay Bills</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <View style={styles.quickActionIcon}>
              <Ionicons name="qr-code-outline" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.quickActionText}>QR Pay</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <View style={styles.quickActionIcon}>
              <Ionicons name="card-outline" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.quickActionText}>Cards</Text>
          </TouchableOpacity>
        </View>

        {/* Accounts Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Accounts</Text>
            <TouchableOpacity>
              <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
            </TouchableOpacity>
          </View>
          {accounts.map((account) => (
            <TouchableOpacity key={account.id} style={styles.accountCard}>
              <View style={styles.accountTop}>
                <View style={styles.accountTypeContainer}>
                  <View style={[styles.accountDot, { backgroundColor: account.account_type === 'checking' ? COLORS.primary : COLORS.success }]} />
                  <Text style={styles.accountType}>
                    {account.account_type === 'checking' ? 'Current Account' : 'Savings Account'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
              </View>
              <Text style={styles.accountNumber}>****{account.account_number.slice(-4)}</Text>
              <View style={styles.accountBottom}>
                <View>
                  <Text style={styles.balanceLabel}>Available Balance</Text>
                  <Text style={styles.accountBalance}>{formatCurrency(account.balance)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.transactionsCard}>
            {stats?.recent_transactions && stats.recent_transactions.length > 0 ? (
              stats.recent_transactions.map((transaction, index) => (
                <View key={transaction.id} style={[
                  styles.transactionItem,
                  index < stats.recent_transactions.length - 1 && styles.transactionBorder
                ]}>
                  <View style={styles.transactionLeft}>
                    <View style={styles.transactionIconContainer}>
                      <Ionicons
                        name={getTransactionIcon(transaction.transaction_type) as any}
                        size={18}
                        color={COLORS.darkGray}
                      />
                    </View>
                    <View style={styles.transactionInfo}>
                      <Text style={styles.transactionTitle}>
                        {transaction.recipient_name || transaction.description}
                      </Text>
                      <Text style={styles.transactionDate}>
                        {formatDate(transaction.timestamp)}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.transactionAmount,
                      transaction.transaction_type === 'deposit'
                        ? styles.positiveAmount
                        : styles.negativeAmount,
                    ]}
                  >
                    {transaction.transaction_type === 'deposit' ? '+' : '-'}
                    {formatCurrency(transaction.amount)}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={40} color={COLORS.gray} />
                <Text style={styles.emptyStateText}>No recent transactions</Text>
              </View>
            )}
          </View>
        </View>

        {/* Spending Summary */}
        <View style={styles.section}>
          <View style={styles.spendingCard}>
            <View style={styles.spendingHeader}>
              <Ionicons name="trending-down" size={20} color={COLORS.primary} />
              <Text style={styles.spendingTitle}>This Month's Spending</Text>
            </View>
            <Text style={styles.spendingAmount}>{formatCurrency(stats?.monthly_spending || 0)}</Text>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
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
    paddingTop: 8,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoContainer: {
    flexDirection: 'column',
  },
  hexagonRow: {
    flexDirection: 'row',
  },
  hexagon: {
    width: 14,
    height: 14,
    margin: 0.5,
  },
  hexagonRed: {
    backgroundColor: COLORS.white,
  },
  hexagonWhite: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.white,
  },
  headerRight: {
    flexDirection: 'row',
  },
  headerIcon: {
    marginLeft: 20,
    position: 'relative' as const,
  },
  notifBadge: {
    position: 'absolute' as const,
    top: -6,
    right: -8,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: COLORS.primary,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.white,
    marginBottom: 4,
  },
  lastLogin: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  scrollView: {
    flex: 1,
  },
  totalBalanceCard: {
    backgroundColor: COLORS.white,
    margin: 16,
    padding: 20,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  totalBalanceLabel: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 8,
  },
  totalBalanceAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.darkGray,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 16,
    borderRadius: 8,
  },
  quickAction: {
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    color: COLORS.darkGray,
    fontWeight: '500',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
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
  viewAll: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  accountCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  accountTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  accountTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  accountType: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.darkGray,
  },
  accountNumber: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 12,
  },
  accountBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  balanceLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 4,
  },
  accountBalance: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.darkGray,
  },
  transactionsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 4,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  transactionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.darkGray,
  },
  transactionDate: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '600',
  },
  positiveAmount: {
    color: COLORS.success,
  },
  negativeAmount: {
    color: COLORS.darkGray,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 12,
  },
  spendingCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
  },
  spendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  spendingTitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginLeft: 8,
  },
  spendingAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.primary,
  },
  bottomPadding: {
    height: 20,
  },
});
