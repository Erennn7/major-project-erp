import React, { useState, useEffect } from 'react';
import { Plus, Receipt, Fuel, UserCheck, Wrench, Home, Zap, ShieldCheck, X, Trash2 } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { api } from '../services/api';
import type { Expense } from '../types';

interface ExpensesPageProps {
  onRefresh: () => void;
}

export const ExpensesPage: React.FC<ExpensesPageProps> = ({ onRefresh }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form State
  const [category, setCategory] = useState('FUEL');
  const [amount, setAmount] = useState<number>(3000);
  const [paidTo, setPaidTo] = useState('Indian Oil Highway Bunk');
  const [vehicleNumber, setVehicleNumber] = useState('MH-12-PQ-4521');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadExpenses = async () => {
    try {
      const res = await api.getExpenses(filterCategory);
      const list: Expense[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.expenses)
        ? res.expenses
        : [];

      const total = list.reduce((acc, e) => acc + (e.amount || 0), 0);

      setExpenses(list);
      setTotalAmount(total);
    } catch (err: any) {
      console.error('Error loading expenses:', err);
      setExpenses([]);
      setTotalAmount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [filterCategory]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) return;

    setSubmitting(true);
    try {
      await api.createExpense({
        category,
        amount: Number(amount),
        paidTo,
        vehicleNumber: vehicleNumber || null,
        paymentMethod,
        date,
        description,
        notes,
      });

      setIsAddModalOpen(false);
      loadExpenses();
      onRefresh();
    } catch (err: any) {
      alert('Failed to log expense: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense entry?')) return;
    try {
      await api.deleteExpense(id);
      loadExpenses();
      onRefresh();
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  return (
    <div className="content-wrapper">
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)' }}>
            Operating Expenses & Overhead Ledger
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Fuel, driver salaries, vehicle repairs, depot rent & testing fees deducted for Net Profit calculation
          </p>
        </div>

        <button className="btn btn-primary btn-sm" onClick={() => setIsAddModalOpen(true)}>
          <Plus size={14} />
          <span>Log Operating Expense</span>
        </button>
      </div>

      {/* Expense Summary Grid */}
      <div className="grid-3">
        <StatCard
          label="Total Operating Overheads"
          value={`₹${(totalAmount || 0).toLocaleString()}`}
          meta="Deducted directly from Gross Profit"
          icon={Receipt}
          variant="warning"
        />
        <StatCard
          label="Total Expense Entries"
          value={`${(expenses || []).length} Records`}
          meta="All verified vouchers"
          icon={ShieldCheck}
        />
        <StatCard
          label="Active Fleet Running Costs"
          value={`₹${(expenses || [])
            .filter((e) => e && (e.category === 'FUEL' || e.category === 'VEHICLE_MAINTENANCE'))
            .reduce((a, b) => a + (Number(b?.amount) || 0), 0)
            .toLocaleString()}`}
          meta="Fuel & vehicle maintenance"
          icon={Fuel}
        />
      </div>

      {/* Filter Tabs */}
      <div className="tabs">
        {['ALL', 'FUEL', 'DRIVER_WAGES', 'VEHICLE_MAINTENANCE', 'WAREHOUSE_RENT', 'PACKAGING_SEALS', 'WATER_TESTING'].map((cat) => (
          <button
            key={cat}
            className={`tab-btn ${filterCategory === cat ? 'active' : ''}`}
            onClick={() => setFilterCategory(cat)}
          >
            {cat.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Expenses Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-container" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Voucher #</th>
                <th>Date</th>
                <th>Category</th>
                <th>Paid To / Vendor</th>
                <th>Description</th>
                <th>Vehicle #</th>
                <th>Payment Mode</th>
                <th>Amount (₹)</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    Loading operating expense vouchers...
                  </td>
                </tr>
              ) : (expenses || []).length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No expenses found in this category.
                  </td>
                </tr>
              ) : (
                (expenses || []).map((e, idx) => (
                  <tr key={e?.id || idx}>
                    <td className="mono" style={{ fontWeight: 600 }}>{e?.expenseNumber || 'EXP-—'}</td>
                    <td style={{ fontSize: '12px' }}>
                      {e?.date ? new Date(e.date).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <span className="badge badge-neutral">
                        {(e?.category || 'MISC').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{e?.paidTo || '—'}</td>
                    <td style={{ fontSize: '12px' }}>{e?.description || '—'}</td>
                    <td className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {e?.vehicleNumber || 'Depot'}
                    </td>
                    <td>
                      <span className="badge badge-info">{e?.paymentMethod || 'UPI'}</span>
                    </td>
                    <td className="mono" style={{ fontWeight: 600, color: 'var(--danger-text)' }}>
                      ₹{(Number(e?.amount) || 0).toLocaleString()}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', color: 'var(--danger-text)' }}
                        onClick={() => e?.id && handleDeleteExpense(e.id)}
                        title="Delete expense"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Log New Expense */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Log Operational Expense Voucher</h3>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={() => setIsAddModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateExpense}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Expense Category *</label>
                    <select
                      className="form-select"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="FUEL">Fuel / Diesel</option>
                      <option value="DRIVER_WAGES">Driver Wages / Allowance</option>
                      <option value="VEHICLE_MAINTENANCE">Vehicle Repair / Servicing</option>
                      <option value="WAREHOUSE_RENT">Warehouse Rent</option>
                      <option value="ELECTRICITY">Depot Electricity / Power</option>
                      <option value="PACKAGING_SEALS">Packaging Caps & Shrink Seals</option>
                      <option value="WATER_TESTING">Lab Water Testing Certificate</option>
                      <option value="MISC">Miscellaneous</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Amount (₹) *</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      className="form-input mono"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Paid To / Recipient *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={paidTo}
                      onChange={(e) => setPaidTo(e.target.value)}
                      placeholder="e.g. Shell Petrol Bunk"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Associated Vehicle (if applicable)</label>
                    <input
                      type="text"
                      className="form-input mono"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value)}
                      placeholder="e.g. MH-12-PQ-4521"
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Expense Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Payment Channel</label>
                    <select
                      className="form-select"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="UPI">UPI / GPay / Paytm</option>
                      <option value="CASH">Cash Voucher</option>
                      <option value="BANK_TRANSFER">Bank IMPS / NEFT</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. 40 liters Diesel for South corridor delivery run"
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  <span>{submitting ? 'Recording...' : 'Record Expense'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
