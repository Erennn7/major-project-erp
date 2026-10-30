import React, { useState } from 'react';
import { Plus, DollarSign, Building2, Phone, MapPin, X, CheckCircle2, History } from 'lucide-react';
import { api } from '../services/api';
import type { Client } from '../types';

interface ClientsPageProps {
  clients: Client[];
  onRefresh: () => void;
  onClientCreated?: (newClient: Client) => void;
  onOpenNewOrderForClient?: (clientId: string) => void;
}

export const ClientsPage: React.FC<ClientsPageProps> = ({ clients, onRefresh, onClientCreated }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // New Client Form
  const [name, setName] = useState('');
  const [clientType, setClientType] = useState('HOTEL');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [deliveryZone, setDeliveryZone] = useState('Central Zone');
  const [paymentTerms, setPaymentTerms] = useState('DAYS_15');
  const [creditLimit, setCreditLimit] = useState<number>(50000);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Direct Client Payment Form
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState('BANK_TRANSFER');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.createClient({
        name,
        clientType,
        contactPerson,
        phone,
        email: email || null,
        address,
        deliveryZone,
        paymentTerms,
        creditLimit: Number(creditLimit),
        notes,
      });

      setIsAddModalOpen(false);
      setName('');
      setContactPerson('');
      setPhone('');
      setAddress('');
      if (onClientCreated && res) {
        onClientCreated(res);
      } else {
        onRefresh();
      }
    } catch (err: any) {
      alert('Failed to add client: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPay = (client: Client) => {
    setSelectedClient(client);
    setPayAmount(client.currentBalance);
    setIsPayModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    if (payAmount <= 0) {
      alert('Payment amount must be greater than zero.');
      return;
    }

    if (payAmount > selectedClient.currentBalance) {
      alert(`Payment amount (₹${payAmount}) cannot exceed client outstanding balance of ₹${selectedClient.currentBalance.toLocaleString()}.`);
      return;
    }

    try {
      await api.createPayment({
        clientId: selectedClient.id,
        amount: Number(payAmount),
        paymentMethod: payMethod,
        referenceNumber: payRef,
        notes: payNotes,
      });

      setIsPayModalOpen(false);
      onRefresh();
    } catch (err: any) {
      alert('Payment failed: ' + err.message);
    }
  };

  return (
    <div className="content-wrapper">
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)' }}>
            Hotels, Resorts & Commercial Accounts
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Credit terms, outstanding payment dues, and 20L returnable empty cans ledger
          </p>
        </div>

        <button className="btn btn-primary btn-sm" onClick={() => setIsAddModalOpen(true)}>
          <Plus size={14} />
          <span>Add New Hotel / Client</span>
        </button>
      </div>

      {/* Clients Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-container" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Hotel / Venue</th>
                <th>Category</th>
                <th>Contact & Phone</th>
                <th>Delivery Zone</th>
                <th>Payment Terms</th>
                <th>Credit Limit</th>
                <th>Outstanding Due</th>
                <th>Empty Jars Held</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const hasDues = c.currentBalance > 0;
                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={11} />
                        <span>{c.address}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-neutral">{c.clientType}</span>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px', fontWeight: 500 }}>{c.contactPerson}</div>
                      <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.phone}</div>
                    </td>
                    <td style={{ fontSize: '12px' }}>{c.deliveryZone || 'Standard'}</td>
                    <td style={{ fontSize: '12px' }}>{c.paymentTerms.replace(/_/g, ' ')}</td>
                    <td className="mono">₹{c.creditLimit.toLocaleString()}</td>
                    <td className="mono" style={{ fontWeight: 600, color: hasDues ? 'var(--warning-text)' : 'var(--text-muted)' }}>
                      ₹{c.currentBalance.toLocaleString()}
                    </td>
                    <td className="mono" style={{ fontWeight: 600 }}>
                      {c.emptyJarsHeld} cans
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {hasDues && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenPay(c)}
                            title="Record Payment from Hotel"
                          >
                            <DollarSign size={12} />
                            <span>Collect</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add New Hotel */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Register New Hotel / Client</h3>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={() => setIsAddModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateClient}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Establishment Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Radisson Blu Hotel"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Client Type *</label>
                    <select
                      className="form-select"
                      value={clientType}
                      onChange={(e) => setClientType(e.target.value)}
                    >
                      <option value="HOTEL">Luxury / Business Hotel</option>
                      <option value="RESTAURANT">Fine Dining Restaurant</option>
                      <option value="RESORT">Resort & Spa</option>
                      <option value="EVENT_BANQUET">Banquet & Convention Lawn</option>
                      <option value="CORPORATE">Corporate IT Park Cafeteria</option>
                      <option value="CAFE">Cafe Chain</option>
                    </select>
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Contact Person (F&B / Store Mgr) *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      placeholder="e.g. Rohit Deshmukh"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Contact Phone *</label>
                    <input
                      type="text"
                      className="form-input mono"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91..."
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Delivery Address & Receiving Dock *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Plot 10, Airport Road, Service Gate 2"
                    required
                  />
                </div>

                <div className="grid-3">
                  <div className="form-group">
                    <label className="form-label">Delivery Zone</label>
                    <input
                      type="text"
                      className="form-input"
                      value={deliveryZone}
                      onChange={(e) => setDeliveryZone(e.target.value)}
                      placeholder="e.g. South Corridor"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Credit Terms</label>
                    <select
                      className="form-select"
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                    >
                      <option value="IMMEDIATE_CASH">Cash on Delivery</option>
                      <option value="DAYS_7">7-Day Credit</option>
                      <option value="DAYS_15">15-Day Credit</option>
                      <option value="DAYS_30">30-Day Credit</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Credit Limit (₹)</label>
                    <input
                      type="number"
                      step="5000"
                      className="form-input mono"
                      value={creditLimit}
                      onChange={(e) => setCreditLimit(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Operational Notes / Security Instructions</label>
                  <input
                    type="text"
                    className="form-input"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Gate pass needed. Early morning entry only."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  <CheckCircle2 size={14} />
                  <span>{submitting ? 'Registering...' : 'Register Hotel Client'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Collect Payment from Client */}
      {isPayModalOpen && selectedClient && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Collect Payment from {selectedClient.name}</h3>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={() => setIsPayModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment}>
              <div className="modal-body">
                <div style={{ backgroundColor: 'var(--bg-card)', padding: '12px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  <div>Client: <strong>{selectedClient.name}</strong></div>
                  <div>Outstanding Dues: <strong className="mono" style={{ color: 'var(--warning-text)' }}>₹{selectedClient.currentBalance.toLocaleString()}</strong></div>
                  <div>Payment Terms: <span className="mono">{selectedClient.paymentTerms.replace(/_/g, ' ')}</span></div>
                </div>

                <div className="form-group">
                  <label className="form-label">Amount Collected (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    max={Math.max(1, selectedClient.currentBalance)}
                    className="form-input mono"
                    style={{ borderColor: payAmount > selectedClient.currentBalance ? 'var(--danger-text)' : undefined }}
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    required
                  />
                  {payAmount > selectedClient.currentBalance && (
                    <span style={{ fontSize: '11px', color: 'var(--danger-text)', marginTop: '4px', display: 'block' }}>
                      Payment cannot exceed client outstanding due of ₹{selectedClient.currentBalance.toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Channel</label>
                  <select
                    className="form-select"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                  >
                    <option value="BANK_TRANSFER">Bank IMPS / NEFT</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="CASH">Cash Payment</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Reference / Cheque Number</label>
                  <input
                    type="text"
                    className="form-input mono"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder="e.g. UTR-9988221"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsPayModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={payAmount <= 0 || payAmount > selectedClient.currentBalance}
                >
                  <span>Record Payment & Update Ledger</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
