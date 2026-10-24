import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { StatCard } from '../components/StatCard';
import { DollarSign, TrendingUp, Receipt, Package, Building2, AlertTriangle } from 'lucide-react';
import type { AnalyticsSummary } from '../types';

interface FinancialAnalyticsProps {
  analytics: AnalyticsSummary | null;
}

export const FinancialAnalytics: React.FC<FinancialAnalyticsProps> = ({ analytics }) => {
  if (!analytics) {
    return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading analytics engine...</div>;
  }

  const { financials, categoryBreakdown, expenseCategoryBreakdown, trend, topClients } = analytics;

  // Prepare expense data for pie chart
  const expenseData = Object.entries(expenseCategoryBreakdown).map(([category, amount]) => ({
    name: category.replace(/_/g, ' '),
    value: amount,
  }));

  // Solid colors for minimalist aesthetic (NO GRADIENTS)
  const SOLID_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#64748b'];

  return (
    <div className="content-wrapper">
      {/* Top Header */}
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)' }}>
          Financial & Profit Analytics Engine
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Comprehensive margin breakdown: Gross Sales, COGS, Operating Overheads & Net Margins
        </p>
      </div>

      {/* Financial Master Calculation Cards */}
      <div className="grid-4">
        <StatCard
          label="Total Gross Sales"
          value={`₹${financials.totalRevenue.toLocaleString()}`}
          meta="All completed & active invoices"
          icon={DollarSign}
        />
        <StatCard
          label="Cost of Goods Sold (COGS)"
          value={`₹${financials.totalCOGS.toLocaleString()}`}
          meta="Direct procurement landed cost"
          icon={Package}
        />
        <StatCard
          label="Gross Profit"
          value={`₹${financials.grossProfit.toLocaleString()}`}
          meta={`Gross Margin: ${financials.grossMarginPct}%`}
          icon={TrendingUp}
          variant="success"
        />
        <StatCard
          label="Total Operating Expenses"
          value={`₹${financials.totalOperatingExpenses.toLocaleString()}`}
          meta="Fuel, drivers, warehouse, repairs"
          icon={Receipt}
          variant="warning"
        />
      </div>

      <div className="grid-3">
        <StatCard
          label="Net Operating Profit"
          value={`₹${financials.netProfit.toLocaleString()}`}
          meta={`Net Margin: ${financials.netMarginPct}% after overheads`}
          icon={TrendingUp}
          variant={financials.netProfit >= 0 ? 'success' : 'danger'}
        />
        <StatCard
          label="Accounts Receivable (Dues)"
          value={`₹${financials.totalReceivables.toLocaleString()}`}
          meta="Pending balance from client hotels"
          icon={AlertTriangle}
          variant={financials.totalReceivables > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Inventory Asset Value"
          value={`₹${financials.totalInventoryValue.toLocaleString()}`}
          meta="Current stock landed valuation"
          icon={Building2}
        />
      </div>

      {/* Main Charts Section */}
      <div className="grid-2">
        {/* Revenue vs COGS vs Profit Bar Chart */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Daily Financial Trend (Sales vs Cost vs Profit)</div>
              <div className="card-subtitle">Flat solid metrics by date (No gradients)</div>
            </div>
          </div>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--text-dim)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--text-dim)" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border)',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: 'var(--text-main)',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="revenue" name="Sales Revenue (₹)" fill="#2563eb" radius={[2, 2, 0, 0]} />
                <Bar dataKey="cogs" name="COGS Cost (₹)" fill="#64748b" radius={[2, 2, 0, 0]} />
                <Bar dataKey="profit" name="Gross Profit (₹)" fill="#10b981" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Operating Expense Distribution */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Operating Overheads Distribution</div>
              <div className="card-subtitle">Total: ₹{financials.totalOperatingExpenses.toLocaleString()}</div>
            </div>
          </div>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  innerRadius={50}
                  stroke="var(--bg-card)"
                  strokeWidth={2}
                  label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {expenseData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={SOLID_COLORS[index % SOLID_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border)',
                    borderRadius: '4px',
                    fontSize: '12px',
                  }}
                  formatter={(val: any) => [`₹${val.toLocaleString()}`, 'Amount']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Category Performance & Margins */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Product Profit Margin Breakdown</div>
            <div className="card-subtitle">20L Jars vs 1L Packs vs 500ml vs Dispensers</div>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Product Category</th>
                <th>Volume Sold</th>
                <th>Total Revenue</th>
                <th>Gross Profit</th>
                <th>Margin %</th>
                <th>Profitability Index</th>
              </tr>
            </thead>
            <tbody>
              {categoryBreakdown.map((cat) => {
                const margin = cat.revenue > 0 ? ((cat.profit / cat.revenue) * 100).toFixed(1) : '0';
                return (
                  <tr key={cat.category}>
                    <td style={{ fontWeight: 600 }}>{cat.category.replace(/_/g, ' ')}</td>
                    <td className="mono">{cat.volume.toLocaleString()} units</td>
                    <td className="mono" style={{ fontWeight: 600 }}>₹{cat.revenue.toLocaleString()}</td>
                    <td className="mono" style={{ color: 'var(--success-text)', fontWeight: 600 }}>
                      +₹{cat.profit.toLocaleString()}
                    </td>
                    <td className="mono">{margin}%</td>
                    <td>
                      <span className="badge badge-success">High Margin</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hotel Profit Contribution & Receivables */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Hotel Client Profit Contribution & Dues Aging</div>
            <div className="card-subtitle">Evaluating client commercial viability & payment risk</div>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Hotel / Client</th>
                <th>Orders Fulfilled</th>
                <th>Total Billing</th>
                <th>Unpaid Balance</th>
                <th>Empty Jars Held</th>
                <th>Credit Health</th>
              </tr>
            </thead>
            <tbody>
              {topClients.map((client) => {
                const isOverdue = client.balance > 25000;
                return (
                  <tr key={client.id}>
                    <td style={{ fontWeight: 500 }}>{client.name}</td>
                    <td className="mono">{client.ordersCount}</td>
                    <td className="mono" style={{ fontWeight: 600 }}>₹{client.revenue.toLocaleString()}</td>
                    <td className="mono" style={{ color: client.balance > 0 ? 'var(--warning-text)' : 'var(--text-muted)' }}>
                      ₹{client.balance.toLocaleString()}
                    </td>
                    <td className="mono">{client.emptyJars} jars</td>
                    <td>
                      {isOverdue ? (
                        <span className="badge badge-warning">Follow Up</span>
                      ) : (
                        <span className="badge badge-success">Good Standing</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
