import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

export const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Account types
export interface Account {
  id: string;
  user_id: string;
  account_number: string;
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
  getAll: (limit?: number) => api.get<Transaction[]>(`/transactions${limit ? `?limit=${limit}` : ''}`),
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
