import React, { useState } from 'react';
import { Truck, CheckCircle2, Clock, Printer, X, User, Phone, MapPin } from 'lucide-react';
import { Badge } from '../components/Badge';
import { api } from '../services/api';
import type { Delivery } from '../types';

interface DeliveriesPageProps {
  deliveries: Delivery[];
  onRefresh: () => void;
  onDeliveryUpdated?: (updatedDelivery: Delivery) => void;
}

export const DeliveriesPage: React.FC<DeliveriesPageProps> = ({ deliveries, onRefresh, onDeliveryUpdated }) => {
  const [filter, setFilter] = useState<string>('ALL');
  const [activeDelivery, setActiveDelivery] = useState<Delivery | null>(null);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [isChallanModalOpen, setIsChallanModalOpen] = useState(false);

  // Delivery confirmation modal fields
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [emptyJarsCollected, setEmptyJarsCollected] = useState<number>(0);
  const [emptyJarsDamaged, setEmptyJarsDamaged] = useState<number>(0);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filtered = deliveries.filter((d) => {
    if (filter === 'ALL') return true;
    return d.status === filter;
  });

  const handleStartDispatch = async (id: string) => {
    try {
      const res = await api.updateDeliveryStatus(id, { status: 'OUT_FOR_DELIVERY' });
      if (onDeliveryUpdated && res) {
        onDeliveryUpdated(res);
      } else {
        onRefresh();
      }
    } catch (err: any) {
      alert('Error updating status: ' + err.message);
    }
  };

  const handleOpenDeliverModal = (delivery: Delivery) => {
    setActiveDelivery(delivery);
    setRecipientName(delivery.recipientName || delivery.client?.contactPerson || '');
    setRecipientPhone(delivery.recipientPhone || delivery.client?.phone || '');
    setEmptyJarsCollected(delivery.emptyJarsDelivered || 0); // usually 1-to-1 swap
    setEmptyJarsDamaged(0);
    setDeliveryNotes('');
    setIsDeliveryModalOpen(true);
  };

  const handleConfirmDelivered = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDelivery) return;

    setSubmitting(true);
    try {
      const res = await api.updateDeliveryStatus(activeDelivery.id, {
        status: 'DELIVERED',
        deliveredDate: new Date().toISOString(),
        recipientName,
        recipientPhone,
        emptyJarsCollected: Number(emptyJarsCollected),
        emptyJarsDamaged: Number(emptyJarsDamaged),
        notes: deliveryNotes,
      });
      setIsDeliveryModalOpen(false);
      if (onDeliveryUpdated && res) {
        onDeliveryUpdated(res);
      } else {
        onRefresh();
      }
    } catch (err: any) {
      alert('Failed to mark delivery: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChallan = (delivery: Delivery) => {
    setActiveDelivery(delivery);
    setIsChallanModalOpen(true);
  };

  return (
    <div className="content-wrapper">
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)' }}>
            Non-GPS Delivery Management & Trip Challans
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Dispatch logs, driver & vehicle tracking, hotel delivery sign-off, and returnable jar pickup
          </p>
        </div>

        <div className="tabs">
          {['ALL', 'SCHEDULED', 'OUT_FOR_DELIVERY', 'DELIVERED'].map((status) => (
            <button
              key={status}
              className={`tab-btn ${filter === status ? 'active' : ''}`}
              onClick={() => setFilter(status)}
            >
              {status.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Deliveries Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-container" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Challan #</th>
                <th>Hotel / Destination</th>
                <th>Driver & Vehicle</th>
                <th>Scheduled Date</th>
                <th>Products Dispatched</th>
                <th>Empty Cans In/Out</th>
                <th>Receiver Sign-off</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No deliveries found matching this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((del) => (
                  <tr key={del.id}>
                    <td className="mono" style={{ fontWeight: 600 }}>{del.challanNumber}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{del.client?.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={11} />
                        <span>{del.deliveryAddress}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{del.driverName}</div>
                      <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {del.vehicleNumber}
                      </div>
                    </td>
                    <td style={{ fontSize: '12px' }}>
                      {new Date(del.scheduledDate).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ fontSize: '12px' }}>
                        {del.order?.items?.map((it) => `${it.quantity}x ${it.product?.name.split(' ')[0]}`).join(', ') || 'Water order'}
                      </div>
                    </td>
                    <td className="mono" style={{ fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-main)' }}>+{del.emptyJarsDelivered} delivered</span>
                      <br />
                      <span style={{ color: 'var(--text-muted)' }}>-{del.emptyJarsCollected} collected</span>
                    </td>
                    <td>
                      {del.status === 'DELIVERED' ? (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 500 }}>{del.recipientName || 'Received'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {del.deliveredDate ? new Date(del.deliveredDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Pending drop</span>
                      )}
                    </td>
                    <td>
                      <Badge status={del.status} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {del.status === 'SCHEDULED' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleStartDispatch(del.id)}
                            title="Dispatch on road"
                          >
                            <Truck size={12} />
                            <span>Dispatch</span>
                          </button>
                        )}

                        {del.status === 'OUT_FOR_DELIVERY' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleOpenDeliverModal(del)}
                            title="Record completed delivery"
                          >
                            <CheckCircle2 size={12} />
                            <span>Mark Delivered</span>
                          </button>
                        )}

                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenChallan(del)}
                          title="View Printable Delivery Challan"
                        >
                          <Printer size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Mark as Delivered & Record Receiver Sign-Off */}
      {isDeliveryModalOpen && activeDelivery && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Record Delivery Confirmation</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Challan {activeDelivery.challanNumber} • {activeDelivery.client?.name}
                </p>
              </div>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={() => setIsDeliveryModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmDelivered}>
              <div className="modal-body">
                <div style={{ backgroundColor: 'var(--bg-card)', padding: '12px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Delivery Destination
                  </div>
                  <div style={{ fontWeight: 600 }}>{activeDelivery.client?.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{activeDelivery.deliveryAddress}</div>
                  <div style={{ fontSize: '12px', marginTop: '6px' }}>
                    Driver: <strong>{activeDelivery.driverName}</strong> ({activeDelivery.vehicleNumber})
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Recipient Receiver Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="e.g. Manoj (F&B Dock Head)"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Recipient Phone</label>
                    <input
                      type="text"
                      className="form-input"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      placeholder="+91..."
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Empty 20L Jars Collected Back *</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input mono"
                      value={emptyJarsCollected}
                      onChange={(e) => setEmptyJarsCollected(Number(e.target.value))}
                      required
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Full jars dropped: {activeDelivery.emptyJarsDelivered}
                    </span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Damaged / Leaking Jars (if any)</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input mono"
                      value={emptyJarsDamaged}
                      onChange={(e) => setEmptyJarsDamaged(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Receiver Remarks / Notes</label>
                  <textarea
                    className="form-textarea"
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="Received in good condition, seals intact, gate pass stamped."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsDeliveryModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  <CheckCircle2 size={14} />
                  <span>{submitting ? 'Updating...' : 'Confirm Delivery & Update Jars'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Printable Delivery Challan Sheet */}
      {isChallanModalOpen && activeDelivery && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Official Delivery Challan & Dispatch Slip</h3>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={() => setIsChallanModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ backgroundColor: '#ffffff', color: '#000000', padding: '24px' }}>
              {/* Printable Challan Box */}
              <div style={{ borderBottom: '2px solid #000', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>AQUAFLOW PACKAGED DRINKING WATER</h2>
                  <p style={{ fontSize: '11px', color: '#555', margin: 0 }}>Licensed Bottling & Commercial Distribution</p>
                  <p style={{ fontSize: '11px', color: '#555', margin: 0 }}>FSSAI Lic: 11522034000192 | GSTIN: 27AABCA1234F1Z5</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>DELIVERY CHALLAN</div>
                  <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>No: {activeDelivery.challanNumber}</div>
                  <div style={{ fontSize: '11px' }}>Date: {new Date(activeDelivery.scheduledDate).toLocaleDateString()}</div>
                </div>
              </div>

              {/* Client & Driver Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', margin: '14px 0', fontSize: '12px' }}>
                <div style={{ border: '1px solid #ccc', padding: '8px' }}>
                  <strong>Consignee / Client Hotel:</strong>
                  <div>{activeDelivery.client?.name}</div>
                  <div>{activeDelivery.deliveryAddress}</div>
                  <div>Contact: {activeDelivery.client?.contactPerson} ({activeDelivery.client?.phone})</div>
                </div>
                <div style={{ border: '1px solid #ccc', padding: '8px' }}>
                  <strong>Dispatch Details:</strong>
                  <div>Driver Name: {activeDelivery.driverName}</div>
                  <div>Vehicle No: {activeDelivery.vehicleNumber}</div>
                  <div>Ref Invoice: {activeDelivery.order?.invoiceNumber}</div>
                </div>
              </div>

              {/* Goods Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '16px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '1px solid #000' }}>
                    <th style={{ padding: '6px', textAlign: 'left', color: '#000' }}>Item Description</th>
                    <th style={{ padding: '6px', textAlign: 'center', color: '#000' }}>Qty Dispatched</th>
                    <th style={{ padding: '6px', textAlign: 'center', color: '#000' }}>Unit</th>
                    <th style={{ padding: '6px', textAlign: 'left', color: '#000' }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {activeDelivery.order?.items?.map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '6px', color: '#000' }}>{it.product?.name}</td>
                      <td style={{ padding: '6px', textAlign: 'center', fontWeight: 600, color: '#000' }}>{it.quantity}</td>
                      <td style={{ padding: '6px', textAlign: 'center', color: '#000' }}>{it.product?.unit}</td>
                      <td style={{ padding: '6px', color: '#555' }}>Batch verified</td>
                    </tr>
                  ))}
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '6px', color: '#000' }}>Empty Returnable 20L Jars Collected</td>
                    <td style={{ padding: '6px', textAlign: 'center', fontWeight: 600, color: '#000' }}>
                      {activeDelivery.emptyJarsCollected}
                    </td>
                    <td style={{ padding: '6px', textAlign: 'center', color: '#000' }}>Jars</td>
                    <td style={{ padding: '6px', color: '#555' }}>Empty deposit return</td>
                  </tr>
                </tbody>
              </table>

              {/* Signatures */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '30px', fontSize: '11px' }}>
                <div style={{ borderTop: '1px solid #000', paddingTop: '6px', textAlign: 'center' }}>
                  Driver / Dispatcher Signature
                </div>
                <div style={{ borderTop: '1px solid #000', paddingTop: '6px', textAlign: 'center' }}>
                  Receiver Seal & Signature ({activeDelivery.recipientName || 'Hotel Representative'})
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsChallanModalOpen(false)}>
                Close
              </button>
              <button className="btn btn-primary" onClick={() => window.print()}>
                <Printer size={14} />
                <span>Print Challan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
