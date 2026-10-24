import React from 'react';
import {
  TrendingUp,
  DollarSign,
  Package,
  Truck,
  RotateCcw,
  Building2,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import type { AnalyticsSummary, Delivery, Order } from '../types';

interface DashboardOverviewProps {
  analytics: AnalyticsSummary | null;
  deliveries: Delivery[];
  orders: Order[];
  onNavigate: (tab: string) => void;
  onOpenNewOrder: () => void;
  onOpenNewBatch: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  analytics,
  deliveries,
  orders,
  onNavigate,
  onOpenNewOrder,
  onOpenNewBatch,
}) => {
  if (!analytics) {
    return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading business metrics...</div>;
  }

  const { financials, operations, topClients } = analytics;
  const recentOrders = orders.slice(0, 5);
  const pendingDeliveries = deliveries.filter((d) => d.status !== 'DELIVERED').slice(0, 5);

  return (
    <div className="content-wrapper">
      {/* Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)' }}>
            Classroom Aqua Bottlers & Distribution
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Real-time operations, non-GPS dispatch & automated margin ledger
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary btn-sm" onClick={onOpenNewBatch}>
            <Package size={14} />
            <span>Procure Batch</span>
          </button>
          <button className="btn btn-primary btn-sm" onClick={onOpenNewOrder}>
            <Plus size={14} />
            <span>Create Sales Order</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid-4">
        <StatCard
          label="Total Gross Sales"
          value={`₹${financials.totalRevenue.toLocaleString()}`}
          meta={`Gross Margin: ${financials.grossMarginPct}%`}
          icon={DollarSign}
        />
        <StatCard
          label="Net Profit"
          value={`₹${financials.netProfit.toLocaleString()}`}
          meta={`After ₹${financials.totalOperatingExpenses.toLocaleString()} expenses`}
          icon={TrendingUp}
          variant={financials.netProfit >= 0 ? 'success' : 'danger'}
        />
        <StatCard
          label="Hotel Receivables (Dues)"
          value={`₹${financials.totalReceivables.toLocaleString()}`}
          meta={`${operations.overdueOrdersCount} invoices pending payment`}
          icon={AlertCircle}
          variant={financials.totalReceivables > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="20L Jars With Hotels"
          value={`${operations.totalJarsWithClients} cans`}
          meta={`${operations.jarsInDepotStock} full cans in depot stock`}
          icon={RotateCcw}
        />
      </div>

      {/* Quick Metrics Secondary Bar */}
      <div className="grid-3">
        <div className="card" style={{ padding: '14px 18px', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Active Deliveries</div>
            <div style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
              {operations.deliveries.outForDelivery} On Road / {operations.deliveries.scheduled} Scheduled
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('deliveries')}>
            <Truck size={13} />
            <span>Dispatch Board</span>
          </button>
        </div>

        <div className="card" style={{ padding: '14px 18px', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Inventory Landed Value</div>
            <div style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
              ₹{financials.totalInventoryValue.toLocaleString()}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('batches')}>
            <Package size={13} />
            <span>Batches</span>
          </button>
        </div>

        <div className="card" style={{ padding: '14px 18px', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Hotel Clients</div>
            <div style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
              {operations.totalClients} Commercial Accounts
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('clients')}>
            <Building2 size={13} />
            <span>View Clients</span>
          </button>
        </div>
      </div>

      {/* Main 2-column operational layout */}
      <div className="grid-2">
        {/* Pending & Active Deliveries (Non-GPS) */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Today's Delivery Dispatch (Non-GPS)</div>
              <div className="card-subtitle">Assigned driver, vehicle & destination hotel</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('deliveries')}>
              All Deliveries
            </button>
          </div>

          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Challan</th>
                  <th>Destination Hotel</th>
                  <th>Driver / Vehicle</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pendingDeliveries.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      All deliveries for today completed!
                    </td>
                  </tr>
                ) : (
                  pendingDeliveries.map((del) => (
                    <tr key={del.id}>
                      <td className="mono" style={{ fontWeight: 600 }}>{del.challanNumber}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{del.client?.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {del.emptyJarsDelivered}x 20L Jars
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px' }}>{del.driverName}</div>
                        <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {del.vehicleNumber}
                        </div>
                      </td>
                      <td>
                        <Badge status={del.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Hotels by Sales Volume */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Top Hotel Clients</div>
              <div className="card-subtitle">Highest volume and billing accounts</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('clients')}>
              Manage Accounts
            </button>
          </div>

          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Hotel / Client</th>
                  <th>Orders</th>
                  <th>Revenue</th>
                  <th>Empty Jars Held</th>
                  <th>Balance Due</th>
                </tr>
              </thead>
              <tbody>
                {topClients.map((client) => (
                  <tr key={client.id}>
                    <td style={{ fontWeight: 500 }}>{client.name}</td>
                    <td className="mono">{client.ordersCount}</td>
                    <td className="mono" style={{ fontWeight: 600 }}>₹{client.revenue.toLocaleString()}</td>
                    <td className="mono">{client.emptyJars} cans</td>
                    <td className="mono" style={{ color: client.balance > 0 ? 'var(--warning-text)' : 'var(--text-muted)' }}>
                      ₹{client.balance.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Orders with Margin calculation */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Recent Sales Invoices & Profit Breakdown</div>
            <div className="card-subtitle">COGS computed accurately from procurement batch landed cost</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('orders')}>
            View All Invoices
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date</th>
                <th>Hotel</th>
                <th>Total Sales</th>
                <th>COGS (Cost)</th>
                <th>Gross Profit</th>
                <th>Margin %</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((ord) => (
                <tr key={ord.id}>
                  <td className="mono" style={{ fontWeight: 600 }}>{ord.invoiceNumber}</td>
                  <td style={{ fontSize: '12px' }}>{new Date(ord.orderDate).toLocaleDateString()}</td>
                  <td style={{ fontWeight: 500 }}>{ord.client?.name}</td>
                  <td className="mono" style={{ fontWeight: 600 }}>₹{ord.totalAmount.toLocaleString()}</td>
                  <td className="mono" style={{ color: 'var(--text-muted)' }}>₹{ord.totalCost.toLocaleString()}</td>
                  <td className="mono" style={{ color: 'var(--success-text)', fontWeight: 600 }}>
                    +₹{ord.grossProfit.toLocaleString()}
                  </td>
                  <td className="mono">{ord.grossMarginPct}%</td>
                  <td>
                    <Badge status={ord.paymentStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
