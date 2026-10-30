const envUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api').trim().replace(/\/+$/, '');
const API_BASE = envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`;

export function getStoredToken(): string | null {
  return localStorage.getItem('aquaflow_token');
}

export function setStoredToken(token: string): void {
  localStorage.setItem('aquaflow_token', token);
}

export function clearStoredToken(): void {
  localStorage.removeItem('aquaflow_token');
  localStorage.removeItem('aquaflow_user');
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const json = await res.json();
  if (!res.ok || json.success === false) {
    if (res.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/register') {
      clearStoredToken();
      window.dispatchEvent(new Event('auth_expired'));
    }
    throw new Error(json.error || `Request failed with status ${res.status}`);
  }
  return json.data !== undefined ? json.data : json;
}

export const api = {
  // Auth
  login: (data: any) => request<{ user: any; token: string }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  register: (data: any) => request<{ user: any; token: string }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request<any>('/auth/me'),
  // Bootstrap & Analytics
  getBootstrap: () => request<any>('/bootstrap'),
  getAnalyticsSummary: () => request<any>('/analytics/summary'),

  // Products
  getProducts: () => request<any[]>('/products'),
  createProduct: (data: any) => request<any>('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: string, data: any) => request<any>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id: string) => request<any>(`/products/${id}`, { method: 'DELETE' }),

  // Batches
  getBatches: () => request<any[]>('/batches'),
  createBatch: (data: any) => request<any>('/batches', { method: 'POST', body: JSON.stringify(data) }),
  updateBatch: (id: string, data: any) => request<any>(`/batches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBatch: (id: string) => request<any>(`/batches/${id}`, { method: 'DELETE' }),

  // Clients
  getClients: () => request<any[]>('/clients'),
  getClient: (id: string) => request<any>(`/clients/${id}`),
  createClient: (data: any) => request<any>('/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (id: string, data: any) => request<any>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteClient: (id: string) => request<any>(`/clients/${id}`, { method: 'DELETE' }),

  // Orders
  getOrders: () => request<any[]>('/orders'),
  getOrder: (id: string) => request<any>(`/orders/${id}`),
  createOrder: (data: any) => request<any>('/orders', { method: 'POST', body: JSON.stringify(data) }),
  recordOrderPayment: (orderId: string, data: any) => request<any>(`/orders/${orderId}/payment`, { method: 'PUT', body: JSON.stringify(data) }),

  // Deliveries
  getDeliveries: (params?: { status?: string; clientId?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.append('status', params.status);
    if (params?.clientId) q.append('clientId', params.clientId);
    return request<any[]>(`/deliveries?${q.toString()}`);
  },
  getDelivery: (id: string) => request<any>(`/deliveries/${id}`),
  updateDeliveryStatus: (id: string, data: any) => request<any>(`/deliveries/${id}/status`, { method: 'PUT', body: JSON.stringify(data) }),

  // Jars
  getJarSummary: () => request<any>('/jars/summary'),
  adjustJars: (data: any) => request<any>('/jars/adjust', { method: 'POST', body: JSON.stringify(data) }),

  // Expenses
  getExpenses: (category?: string) => {
    const q = category && category !== 'ALL' ? `?category=${category}` : '';
    return request<any>(`/expenses${q}`);
  },
  createExpense: (data: any) => request<any>('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  deleteExpense: (id: string) => request<any>(`/expenses/${id}`, { method: 'DELETE' }),

  // Payments
  getPayments: () => request<any[]>('/payments'),
  createPayment: (data: any) => request<any>('/payments', { method: 'POST', body: JSON.stringify(data) }),
};
