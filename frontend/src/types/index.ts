export type UserRole = 'ADMIN' | 'DISPATCHER' | 'SALES' | 'ACCOUNTANT';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export type ProductCategory = 'JAR_20L' | 'BOTTLE_1L' | 'BOTTLE_500ML' | 'CUP_250ML' | 'DISPENSER' | 'OTHER';

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: ProductCategory;
  unit: string;
  defaultPrice: number;
  defaultCost: number;
  isReturnable: boolean;
  depositAmount: number;
  currentStock: number;
  minStockAlert: number;
  createdAt: string;
  batches?: Batch[];
}

export interface Batch {
  id: string;
  batchNumber: string;
  productId: string;
  product?: Product;
  supplierName: string;
  purchaseDate: string;
  mfgDate: string;
  expiryDate?: string | null;
  quantityReceived: number;
  quantityRemaining: number;
  purchaseCostPerUnit: number;
  transportCostTotal: number;
  totalCost: number;
  landedCostPerUnit: number;
  notes?: string | null;
}

export type ClientType = 'HOTEL' | 'RESTAURANT' | 'RESORT' | 'CAFE' | 'CORPORATE' | 'EVENT_BANQUET';

export interface Client {
  id: string;
  name: string;
  clientType: ClientType;
  contactPerson: string;
  phone: string;
  email?: string | null;
  address: string;
  deliveryZone?: string | null;
  paymentTerms: string;
  creditLimit: number;
  currentBalance: number;
  emptyJarsHeld: number;
  notes?: string | null;
  _count?: {
    orders: number;
    deliveries: number;
  };
}

export interface OrderItem {
  id?: string;
  productId: string;
  product?: Product;
  batchId?: string | null;
  batch?: Batch | null;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  totalPrice: number;
  totalCost: number;
  profit: number;
}

export interface Order {
  id: string;
  invoiceNumber: string;
  clientId: string;
  client: Client;
  orderDate: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  totalCost: number;
  grossProfit: number;
  grossMarginPct: number;
  paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE';
  paidAmount: number;
  paymentMethod: string;
  notes?: string | null;
  items: OrderItem[];
  delivery?: Delivery | null;
}

export type DeliveryStatus = 'SCHEDULED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

export interface Delivery {
  id: string;
  challanNumber: string;
  orderId: string;
  order: Order;
  clientId: string;
  client: Client;
  scheduledDate: string;
  deliveredDate?: string | null;
  status: DeliveryStatus;
  driverName: string;
  driverPhone?: string | null;
  vehicleNumber: string;
  deliveryAddress: string;
  recipientName?: string | null;
  recipientPhone?: string | null;
  notes?: string | null;
  emptyJarsDelivered: number;
  emptyJarsCollected: number;
  emptyJarsDamaged: number;
}

export interface JarTransaction {
  id: string;
  clientId: string;
  client?: Client;
  deliveryId?: string | null;
  delivery?: Delivery | null;
  date: string;
  transactionType: string;
  jarsOut: number;
  jarsIn: number;
  netChange: number;
  balanceAfter: number;
  notes?: string | null;
}

export interface Expense {
  id: string;
  expenseNumber: string;
  date: string;
  category: string;
  amount: number;
  paymentMethod: string;
  paidTo: string;
  vehicleNumber?: string | null;
  description: string;
  notes?: string | null;
}

export interface AnalyticsSummary {
  financials: {
    totalRevenue: number;
    totalCOGS: number;
    grossProfit: number;
    grossMarginPct: number;
    totalOperatingExpenses: number;
    netProfit: number;
    netMarginPct: number;
    totalReceivables: number;
    totalInventoryValue: number;
  };
  operations: {
    totalClients: number;
    totalOrders: number;
    overdueOrdersCount: number;
    totalJarsWithClients: number;
    jarsInDepotStock: number;
    deliveries: {
      delivered: number;
      outForDelivery: number;
      scheduled: number;
      total: number;
    };
  };
  topClients: Array<{
    id: string;
    name: string;
    revenue: number;
    ordersCount: number;
    emptyJars: number;
    balance: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    revenue: number;
    volume: number;
    profit: number;
  }>;
  expenseCategoryBreakdown: Record<string, number>;
  trend: Array<{
    date: string;
    revenue: number;
    cogs: number;
    profit: number;
    expenses: number;
  }>;
}
