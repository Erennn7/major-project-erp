import React, { useState, useEffect } from 'react';
import { RotateCcw, Plus, AlertCircle, Building2, X, CheckCircle2 } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { api } from '../services/api';
import type { Client } from '../types';

interface JarsLedgerPageProps {
  clients: Client[];
  onRefresh: () => void;
}

export const JarsLedgerPage: React.FC<JarsLedgerPageProps> = ({ clients, onRefresh }) => {
  const [jarData, setJarData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  // Manual adjustment form
  const [selectedClientId, setSelectedClientId] = useState('');
  const [adjustType, setAdjustType] = useState('COLLECTED_EMPTY');
  const [adjustQuantity, setAdjustQuantity] = useState<number>(30);
  const [adjustNotes, setAdjustNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadJarSummary = async () => {
    try {
      const data = await api.getJarSummary();
      setJarData(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJarSummary();
  }, []);

  const handleAdjustJars = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !adjustQuantity) return;

    setSubmitting(true);
    try {
      await api.adjustJars({
        clientId: selectedClientId,
        type: adjustType,
        quantity: Number(adjustQuantity),
        notes: adjustNotes,
      });

      setIsAdjustModalOpen(false);
      loadJarSummary();
      onRefresh();
    } catch (err: any) {
      alert('Adjustment failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !jarData) {
    return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading Jar Ledger...</div>;
  }

  const { totalAssetJars, totalJarsWithClients, jarsInDepotStock, recentTransactions } = jarData;
  const jarAssetValue = totalAssetJars * 150; // standard ₹150 asset replacement value

  return (
    <div className="content-wrapper">
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)' }}>
            20L Returnable Empty Can Ledger
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Track returnable poly-carbonate water jars in market circulation vs depot inventory
          </p>
        </div>

        <button className="btn btn-primary btn-sm" onClick={() => setIsAdjustModalOpen(true)}>
          <Plus size={14} />
          <span>Manual Empty Can Pickup / Return</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid-4">
        <StatCard
          label="Total Jars In Asset Pool"
          value={`${totalAssetJars} cans`}
          meta={`Asset valuation: ₹${jarAssetValue.toLocaleString()}`}
          icon={RotateCcw}
        />
        <StatCard
          label="Cans With Client Hotels"
          value={`${totalJarsWithClients} cans`}
          meta="Circulating in hotel pantries"
          icon={Building2}
          variant="warning"
        />
        <StatCard
          label="Full Cans In Depot Stock"
          value={`${jarsInDepotStock} cans`}
          meta="Ready for immediate delivery"
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          label="Deposit Coverage Valuation"
          value={`₹${(totalJarsWithClients * 150).toLocaleString()}`}
          meta="Security value held in field"
          icon={AlertCircle}
        />
      </div>

      {/* Hotel Jars Balance Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Hotel Client Empty Jar Holding Ledger</div>
            <div className="card-subtitle">Active can balance held at each hotel property</div>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Hotel / Venue</th>
                <th>Category</th>
                <th>Delivery Zone</th>
                <th>Contact Person</th>
                <th>20L Cans Held</th>
                <th>Security Value (₹150/can)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td>
                    <span className="badge badge-neutral">{c.clientType}</span>
                  </td>
                  <td style={{ fontSize: '12px' }}>{c.deliveryZone || 'Standard'}</td>
                  <td style={{ fontSize: '12px' }}>{c.contactPerson}</td>
                  <td className="mono" style={{ fontWeight: 600, fontSize: '14px' }}>
                    {c.emptyJarsHeld} cans
                  </td>
                  <td className="mono" style={{ color: 'var(--text-muted)' }}>
                    ₹{(c.emptyJarsHeld * 150).toLocaleString()}
                  </td>
                  <td>
                    {c.emptyJarsHeld > 100 ? (
                      <span className="badge badge-warning">High Can Count</span>
                    ) : (
                      <span className="badge badge-success">Balanced</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Jar Audit Log Transactions */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Recent Jar Movement Audit Trail</div>
            <div className="card-subtitle">Dispatched full cans, collected empties, and reported damages</div>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Hotel Client</th>
                <th>Movement Type</th>
                <th>Full Cans Out</th>
                <th>Empty Cans In</th>
                <th>Net Balance Change</th>
                <th>Running Balance</th>
                <th>Audit Notes</th>
              </tr>
            </thead>
            <tbody>
              {(recentTransactions || []).length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No jar movements recorded yet.
                  </td>
                </tr>
              ) : (
                (recentTransactions || []).map((tx: any) => (
                  <tr key={tx.id}>
                    <td style={{ fontSize: '12px' }}>{new Date(tx.date).toLocaleDateString()}</td>
                    <td style={{ fontWeight: 500 }}>{tx.client?.name}</td>
                    <td>
                      <span className={`badge ${tx.transactionType === 'COLLECTED_EMPTY' ? 'badge-success' : 'badge-neutral'}`}>
                        {tx.transactionType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="mono">+{tx.jarsOut}</td>
                    <td className="mono">-{tx.jarsIn}</td>
                    <td className="mono" style={{ fontWeight: 600, color: tx.netChange > 0 ? 'var(--warning-text)' : 'var(--success-text)' }}>
                      {tx.netChange > 0 ? `+${tx.netChange}` : tx.netChange}
                    </td>
                    <td className="mono" style={{ fontWeight: 600 }}>{tx.balanceAfter} cans</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{tx.notes || 'Trip movement'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Manual Empty Jar Pickup */}
      {isAdjustModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Manual Jar Pickup / Return</h3>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={() => setIsAdjustModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAdjustJars}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Client Hotel *</label>
                  <select
                    className="form-select"
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Hotel --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (Currently holds: {c.emptyJarsHeld} cans)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Adjustment Type *</label>
                  <select
                    className="form-select"
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value)}
                  >
                    <option value="COLLECTED_EMPTY">Collected Empty Cans (Pickup from hotel)</option>
                    <option value="DELIVERED_FULL">Delivered Full Cans (Direct exchange)</option>
                    <option value="DAMAGED_LOST">Report Damaged / Broken Can at Client</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Quantity of Cans *</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input mono"
                    value={adjustQuantity}
                    onChange={(e) => setAdjustQuantity(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Pickup Notes</label>
                  <input
                    type="text"
                    className="form-input"
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    placeholder="e.g. Dedicated empty cans collection round"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsAdjustModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  <CheckCircle2 size={14} />
                  <span>{submitting ? 'Updating...' : 'Update Jar Balance'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
