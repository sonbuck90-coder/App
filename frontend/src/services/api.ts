import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineAdapter } from './offline-adapter';

// Base URL is only used as an identifier for the axios instance — every
// request is intercepted by `offlineAdapter` and served locally, so the
// app never actually reaches this URL. Prefer the env value; fall back
// to an obviously-fake placeholder so a missing env variable can't
// silently ship a cleartext `http://localhost` URL to a real device.
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://offline-only.local';

export const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  // Route every request through the offline adapter — the app works fully
  // offline. The base URL above is kept only for cosmetic logging.
  adapter: offlineAdapter,
});

// Always attach the latest token from AsyncStorage, even if AuthContext hasn't hydrated yet
api.interceptors.request.use(async (config) => {
  try {
    // Prefer the in-memory header (set after login), fall back to AsyncStorage
    if (!config.headers?.Authorization) {
      const stored = await AsyncStorage.getItem('auth_token');
      if (stored) {
        config.headers = config.headers || {};
        (config.headers as any).Authorization = `Bearer ${stored}`;
      }
    }
  } catch {
    // ignore
  }
  return config;
});

// Account types
export interface Account {
  id: string;
  user_id: string;
  account_number: string;
  sort_code: string;
  account_type: string;
  balance: number;
  currency: string;
}

// Transaction types
export interface Transaction {
  id: string;
  user_id: string;
  from_account_id?: string;
  to_account_id?: string;
  amount: number;
  transaction_type: string;
  description: string;
  recipient_name?: string;
  recipient_sort_code?: string;
  recipient_account_number?: string;
  recipient_bank_name?: string;
  reference?: string;
  trn?: string;
  fpid?: string;
  status: string;
  timestamp: string;
}

// Card types
export interface Card {
  id: string;
  user_id: string;
  card_number: string;
  card_number_masked: string;
  card_type: string;
  card_name: string;
  expiry_date: string;
  is_frozen: boolean;
  credit_limit?: number;
  available_credit?: number;
}

// Biller types
export interface Biller {
  id: string;
  name: string;
  category: string;
  account_number: string;
  icon: string;
}

// Dashboard stats
export interface DashboardStats {
  total_balance: number;
  monthly_spending: number;
  accounts_count: number;
  recent_transactions: Transaction[];
}

// API functions
export const accountsApi = {
  getAll: () => api.get<Account[]>('/accounts'),
  getById: (id: string) => api.get<Account>(`/accounts/${id}`),
};

export const transactionsApi = {
  getAll: (limit?: number, filter_type?: string) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', String(limit));
    if (filter_type) params.append('filter_type', filter_type);
    const qs = params.toString();
    return api.get<Transaction[]>(`/transactions${qs ? `?${qs}` : ''}`);
  },
  getById: (id: string) => api.get<Transaction>(`/transactions/${id}`),
  delete: (id: string) => api.delete(`/transactions/${id}`),
};

export const transfersApi = {
  create: (data: {
    from_account_id: string;
    to_account_number: string;
    amount: number;
    description?: string;
    recipient_name?: string;
    sort_code?: string;
  }) => api.post<Transaction>('/transfers', data),
};

export const billersApi = {
  getAll: () => api.get<Biller[]>('/billers'),
  pay: (data: {
    from_account_id: string;
    biller_id: string;
    amount: number;
    reference?: string;
  }) => api.post<Transaction>('/bills/pay', data),
};

export const cardsApi = {
  getAll: () => api.get<Card[]>('/cards'),
  freeze: (cardId: string) => api.post(`/cards/${cardId}/freeze`),
  unfreeze: (cardId: string) => api.post(`/cards/${cardId}/unfreeze`),
  update: (cardId: string, data: { card_name?: string; card_number?: string; expiry_date?: string }) =>
    api.put<Card>(`/cards/${cardId}`, data),
};

export const dashboardApi = {
  getStats: () => api.get<DashboardStats>('/dashboard/stats'),
};

// Payee types
export interface Payee {
  id: string;
  user_id: string;
  name: string;
  sort_code: string;
  account_number: string;
  bank_name?: string;
  country_code?: string;
  last_used: string;
}

export const payeesApi = {
  getRecent: () => api.get<Payee[]>('/payees'),
  create: (data: { name: string; sort_code: string; account_number: string }) => api.post('/payees', data),
  update: (id: string, data: { name?: string; sort_code?: string; account_number?: string }) => api.put(`/payees/${id}`, data),
  delete: (payeeId: string) => api.delete(`/payees/${payeeId}`),
};

// Analytics types
export interface SpendingCategory {
  name: string;
  total: number;
  count: number;
}

export interface TopPayee {
  name: string;
  total: number;
}

export interface MonthlyTrend {
  month: string;
  year: number;
  total: number;
  count: number;
}

export interface SpendingAnalytics {
  total_spending: number;
  transaction_count: number;
  categories: SpendingCategory[];
  top_payees: TopPayee[];
  monthly_trend: MonthlyTrend[];
}

export const analyticsApi = {
  getSpending: () => api.get<SpendingAnalytics>('/analytics/spending'),
};

// Chat types
export interface ChatMessage {
  user_id: string;
  session_id: string;
  role: string;
  content: string;
  timestamp: string;
}

export const chatApi = {
  send: (message: string, session_id?: string) => api.post<{ response: string; session_id: string }>('/chat', { message, session_id }),
  getHistory: (session_id?: string) => api.get<ChatMessage[]>(`/chat/history${session_id ? `?session_id=${session_id}` : ''}`),
};

// Notification types
export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  notification_type: string;
  is_read: boolean;
  data?: any;
  timestamp: string;
}

export const notificationsApi = {
  getAll: (limit?: number) => api.get<AppNotification[]>(`/notifications${limit ? `?limit=${limit}` : ''}`),
  getUnreadCount: () => api.get<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
};

export const depositsApi = {
  addMoney: (data: { account_id: string; amount: number; source: string; description?: string }) =>
    api.post<{ message: string; new_balance: number; transaction_id: string }>('/deposits', data),
};

export const moveMoneyApi = {
  transfer: (data: { from_account_id: string; to_account_id: string; amount: number; description?: string }) =>
    api.post<{ message: string; from_balance: number; to_balance: number; transaction_id: string }>('/move-money', data),
};

export interface Schedule {
  id: string;
  user_id: string;
  account_id: string;
  amount: number;
  source: string;
  frequency: string;
  next_run: string;
  end_date?: string;
  is_active: boolean;
  created_at: string;
}

export const schedulesApi = {
  getAll: () => api.get<Schedule[]>('/schedules'),
  create: (data: { account_id: string; amount: number; source?: string; frequency: string; start_date?: string; end_date?: string }) =>
    api.post<Schedule>('/schedules', data),
  delete: (id: string) => api.delete(`/schedules/${id}`),
  toggle: (id: string) => api.post<{ message: string; is_active: boolean }>(`/schedules/${id}/toggle`),
};
