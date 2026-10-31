import React, { useState, useEffect } from 'react';
import { Sidebar, ROLE_ALLOWED_TABS } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { AuthPage } from './pages/AuthPage';
import { DashboardOverview } from './pages/DashboardOverview';
import { FinancialAnalytics } from './pages/FinancialAnalytics';
import { DeliveriesPage } from './pages/DeliveriesPage';
import { OrdersPage } from './pages/OrdersPage';
import { BatchesPage } from './pages/BatchesPage';
import { ClientsPage } from './pages/ClientsPage';
import { JarsLedgerPage } from './pages/JarsLedgerPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { api, getStoredToken, clearStoredToken } from './services/api';
import type { AnalyticsSummary, Delivery, Order, Client, Product, Batch, User } from './types';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('aquaflow_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [currentTab, setCurrentTab] = useState<string>('overview');

  // Enforce role-permitted tab routing
  useEffect(() => {
    if (user) {
      const allowed = ROLE_ALLOWED_TABS[user.role] || ROLE_ALLOWED_TABS.ADMIN;
      if (!allowed.includes(currentTab)) {
        setCurrentTab(allowed[0] || 'overview');
      }
    }
  }, [user, currentTab]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  // Global Modal controls
  const [isOpenOrderModal, setIsOpenOrderModal] = useState(false);
  const [isOpenBatchModal, setIsOpenBatchModal] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Silent background refresh that never blanks the screen
  const refreshData = async (silent = false) => {
    if (!user) return;
    if (!silent && !analytics) {
      setInitialLoading(true);
    }

    try {
      const data = await api.getBootstrap();
      if (data) {
        if (data.analytics) setAnalytics(data.analytics);
        if (data.deliveries) setDeliveries(data.deliveries);
        if (data.orders) setOrders(data.orders);
        if (data.clients) setClients(data.clients);
        if (data.products) setProducts(data.products);
        if (data.batches) setBatches(data.batches);
      }
    } catch (err) {
      console.error('Error refreshing app data:', err);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    const token = getStoredToken();
    if (token && !user) {
      api
        .getMe()
        .then((userData) => {
          setUser(userData);
          localStorage.setItem('aquaflow_user', JSON.stringify(userData));
        })
        .catch(() => {
          clearStoredToken();
          setUser(null);
          setInitialLoading(false);
        });
    } else {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user]);

  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
    };
    window.addEventListener('auth_expired', handleAuthExpired);
    return () => window.removeEventListener('auth_expired', handleAuthExpired);
  }, []);

  const handleLogout = () => {
    clearStoredToken();
    setUser(null);
  };

  // Instant optimistic handlers
  const handleOrderCreated = (newOrder: Order, newDelivery?: Delivery) => {
    setOrders((prev) => {
      const exists = prev.some((o) => o.id === newOrder.id || o.invoiceNumber === newOrder.invoiceNumber);
      if (exists) {
        return prev.map((o) => (o.invoiceNumber === newOrder.invoiceNumber ? newOrder : o));
      }
      return [newOrder, ...prev];
    });

    if (newDelivery) {
      setDeliveries((prev) => {
        const exists = prev.some((d) => d.id === newDelivery.id || d.challanNumber === newDelivery.challanNumber);
        if (exists) {
          return prev.map((d) => (d.challanNumber === newDelivery.challanNumber ? newDelivery : d));
        }
        return [newDelivery, ...prev];
      });
    }

    // Update client balance locally
    setClients((prev) =>
      prev.map((c) =>
        c.id === newOrder.clientId
          ? { ...c, currentBalance: c.currentBalance + (newOrder.totalAmount - newOrder.paidAmount) }
          : c
      )
    );
  };

  const handleBatchCreated = (newBatch: Batch) => {
    setBatches((prev) => [newBatch, ...prev]);
    setProducts((prev) =>
      prev.map((p) =>
        p.id === newBatch.productId
          ? { ...p, currentStock: p.currentStock + newBatch.quantityReceived }
          : p
      )
    );
    refreshData(true);
  };

  const handleClientCreated = (newClient: Client) => {
    setClients((prev) => [...prev, newClient]);
    refreshData(true);
  };

  const handleDeliveryUpdated = (updatedDelivery: Delivery) => {
    setDeliveries((prev) =>
      prev.map((d) => (d.id === updatedDelivery.id ? { ...d, ...updatedDelivery } : d))
    );
    refreshData(true);
  };

  // If user is not authenticated, show AuthPage
  if (!user) {
    return <AuthPage onAuthSuccess={(authenticatedUser) => setUser(authenticatedUser)} />;
  }

  const pendingDeliveriesCount = deliveries.filter((d) => d.status !== 'DELIVERED').length;
  const unpaidOrdersCount = orders.filter((o) => o.paymentStatus !== 'PAID').length;

  return (
    <div className="app-container">
      {/* Minimalist Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        pendingDeliveriesCount={pendingDeliveriesCount}
        unpaidOrdersCount={unpaidOrdersCount}
        userRole={user.role}
      />

      {/* Main Content Area */}
      <div className="app-main">
        <Navbar currentTab={currentTab} user={user} onLogout={handleLogout} />

        {initialLoading && !analytics ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Connecting to cloud workspace & loading live records...
          </div>
        ) : (
          <ErrorBoundary key={currentTab}>
            {currentTab === 'overview' && (
              <DashboardOverview
                analytics={analytics}
                deliveries={deliveries}
                orders={orders}
                onNavigate={setCurrentTab}
                onOpenNewOrder={() => setIsOpenOrderModal(true)}
                onOpenNewBatch={() => setIsOpenBatchModal(true)}
                userRole={user.role}
              />
            )}

            {currentTab === 'analytics' && (
              user.role === 'ADMIN' || user.role === 'ACCOUNTANT' ? (
                <FinancialAnalytics analytics={analytics} />
              ) : (
                <div className="card" style={{ padding: '40px', textAlign: 'center', margin: '20px' }}>
                  <h3 style={{ marginBottom: '8px' }}>Access Restricted</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    Financial Analytics and Profit Calculations are restricted to Administrators and Accountants.
                  </p>
                  <button className="btn btn-primary btn-sm" style={{ marginTop: '16px' }} onClick={() => setCurrentTab('overview')}>
                    Return to Overview
                  </button>
                </div>
              )
            )}

            {currentTab === 'deliveries' && (
              <DeliveriesPage
                deliveries={deliveries}
                onRefresh={() => refreshData(true)}
                onDeliveryUpdated={handleDeliveryUpdated}
                userRole={user.role}
              />
            )}

            {currentTab === 'orders' && (
              <OrdersPage
                orders={orders}
                clients={clients}
                products={products}
                batches={batches}
                onRefresh={() => refreshData(true)}
                onOrderCreated={handleOrderCreated}
                isOpenCreateModal={isOpenOrderModal}
                onOpenCreateModal={() => setIsOpenOrderModal(true)}
                onCloseCreateModal={() => setIsOpenOrderModal(false)}
                userRole={user.role}
              />
            )}

            {currentTab === 'batches' && (
              user.role !== 'SALES' ? (
                <BatchesPage
                  batches={batches}
                  products={products}
                  onRefresh={() => refreshData(true)}
                  onBatchCreated={handleBatchCreated}
                  isOpenModal={isOpenBatchModal}
                  onOpenModal={() => setIsOpenBatchModal(true)}
                  onCloseModal={() => setIsOpenBatchModal(false)}
                  userRole={user.role}
                />
              ) : (
                <div className="card" style={{ padding: '40px', textAlign: 'center', margin: '20px' }}>
                  <h3 style={{ marginBottom: '8px' }}>Access Restricted</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    Procurement batch management and bottler plant costs are restricted to Operations and Administration.
                  </p>
                  <button className="btn btn-primary btn-sm" style={{ marginTop: '16px' }} onClick={() => setCurrentTab('overview')}>
                    Return to Overview
                  </button>
                </div>
              )
            )}

            {currentTab === 'clients' && (
              <ClientsPage
                clients={clients}
                onRefresh={() => refreshData(true)}
                onClientCreated={handleClientCreated}
                userRole={user.role}
              />
            )}

            {currentTab === 'jars' && (
              <JarsLedgerPage clients={clients} onRefresh={() => refreshData(true)} />
            )}

            {currentTab === 'expenses' && (
              user.role === 'ADMIN' || user.role === 'ACCOUNTANT' ? (
                <ExpensesPage onRefresh={() => refreshData(true)} userRole={user.role} />
              ) : (
                <div className="card" style={{ padding: '40px', textAlign: 'center', margin: '20px' }}>
                  <h3 style={{ marginBottom: '8px' }}>Access Restricted</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    Operating expenses and overhead logging are restricted to Administrators and Accountants.
                  </p>
                  <button className="btn btn-primary btn-sm" style={{ marginTop: '16px' }} onClick={() => setCurrentTab('overview')}>
                    Return to Overview
                  </button>
                </div>
              )
            )}
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
};

export default App;
