import React, { useState } from 'react';
import { Plus, Printer, DollarSign, X, CheckCircle2 } from 'lucide-react';
import { Badge } from '../components/Badge';
import { api } from '../services/api';
import type { Order, Client, Product, Batch, Delivery } from '../types';

interface OrdersPageProps {
  orders: Order[];
  clients: Client[];
  products: Product[];
  batches: Batch[];
  onRefresh: () => void;
  onOrderCreated?: (newOrder: Order, newDelivery?: Delivery) => void;
  isOpenCreateModal: boolean;
  onCloseCreateModal: () => void;
  onOpenCreateModal: () => void;
}

export const OrdersPage: React.FC<OrdersPageProps> = ({
  orders,
  clients,
  products,
  batches,
  onRefresh,
  onOrderCreated,
  isOpenCreateModal,
  onCloseCreateModal,
  onOpenCreateModal,
}) => {
  const [filter, setFilter] = useState<string>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);

  // New Order Form State
  const [selectedClientId, setSelectedClientId] = useState('');
  const [orderItems, setOrderItems] = useState<
    Array<{ productId: string; batchId: string; quantity: number; unitPrice: number }>
  >([
    {
      productId: products[0]?.id || '',
      batchId: '',
      quantity: 50,
      unitPrice: products[0]?.defaultPrice || 80,
    },
  ]);
  const [driverName, setDriverName] = useState('Ramesh Pawar');
  const [vehicleNumber, setVehicleNumber] = useState('MH-12-PQ-4521');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('CREDIT');
  const [orderNotes, setOrderNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Pay Modal State
  const [paymentInputAmount, setPaymentInputAmount] = useState<number>(0);
  const [payMethodInput, setPayMethodInput] = useState('UPI');
  const [payRefInput, setPayRefInput] = useState('');

  const filtered = orders.filter((o) => {
    if (filter === 'ALL') return true;
    return o.paymentStatus === filter;
  });

  // Calculate live preview metrics for the new order
  let previewSubtotal = 0;
  let previewCOGS = 0;

  for (const item of orderItems) {
    const prod = products.find((p) => p.id === item.productId);
    const batch = batches.find((b) => b.id === item.batchId);
    const unitCost = batch ? batch.landedCostPerUnit : prod?.defaultCost || 0;
    const itemTotal = item.quantity * item.unitPrice;
    const itemCost = item.quantity * unitCost;
    previewSubtotal += itemTotal;
    previewCOGS += itemCost;
  }

  const previewGrossProfit = previewSubtotal - previewCOGS;
  const previewGrossMargin = previewSubtotal > 0 ? ((previewGrossProfit / previewSubtotal) * 100).toFixed(1) : '0';

  const handleAddItem = () => {
    setOrderItems([
      ...orderItems,
      {
        productId: products[0]?.id || '',
        batchId: '',
        quantity: 20,
        unitPrice: products[0]?.defaultPrice || 80,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...orderItems];
    const item = { ...updated[index], [field]: value };

    if (field === 'productId') {
      const prod = products.find((p) => p.id === value);
      if (prod) {
        item.unitPrice = prod.defaultPrice;
        item.batchId = ''; // reset batch
      }
    }
    updated[index] = item;
    setOrderItems(updated);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      alert('Please select a hotel / client.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createOrder({
        clientId: selectedClientId,
        items: orderItems,
        scheduledDate,
        driverName,
        vehicleNumber,
        paidAmount: Number(paidAmount),
        paymentMethod,
        notes: orderNotes,
      });

      onCloseCreateModal();
      if (onOrderCreated && res?.order) {
        onOrderCreated(res.order, res.delivery);
      } else {
        onRefresh();
      }
    } catch (err: any) {
      alert('Order generation failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPayModal = (order: Order) => {
    setSelectedOrder(order);
    const pending = Math.max(0, order.totalAmount - order.paidAmount);
    setPaymentInputAmount(pending);
    setIsPayModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    try {
      await api.recordOrderPayment(selectedOrder.id, {
        amount: Number(paymentInputAmount),
        paymentMethod: payMethodInput,
        referenceNumber: payRefInput,
      });
      setIsPayModalOpen(false);
      onRefresh();
    } catch (err: any) {
      alert('Payment recording failed: ' + err.message);
    }
  };

  const handleOpenInvoice = (order: Order) => {
    setSelectedOrder(order);
    setIsInvoiceModalOpen(true);
  };

  return (
    <div className="content-wrapper">
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)' }}>
            Sales Orders, Invoices & Margin Calculator
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Order dispatch, automated batch COGS deduction, profit calculations & client billing
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <div className="tabs">
            {['ALL', 'PAID', 'PARTIAL', 'PENDING'].map((status) => (
              <button
                key={status}
                className={`tab-btn ${filter === status ? 'active' : ''}`}
                onClick={() => setFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>

          <button className="btn btn-primary btn-sm" onClick={onOpenCreateModal}>
            <Plus size={14} />
            <span>New Sales Order</span>
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-container" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Order Date</th>
                <th>Client Hotel</th>
                <th>Sales Total</th>
                <th>COGS (Cost)</th>
                <th>Gross Profit</th>
                <th>Margin %</th>
                <th>Paid / Due</th>
                <th>Payment Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ord) => {
                const due = ord.totalAmount - ord.paidAmount;
                return (
                  <tr key={ord.id}>
                    <td className="mono" style={{ fontWeight: 600 }}>{ord.invoiceNumber}</td>
                    <td style={{ fontSize: '12px' }}>{new Date(ord.orderDate).toLocaleDateString()}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{ord.client?.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {ord.items?.length || 0} product lines
                      </div>
                    </td>
                    <td className="mono" style={{ fontWeight: 600 }}>₹{ord.totalAmount.toLocaleString()}</td>
                    <td className="mono" style={{ color: 'var(--text-muted)' }}>₹{ord.totalCost.toLocaleString()}</td>
                    <td className="mono" style={{ color: 'var(--success-text)', fontWeight: 600 }}>
                      +₹{ord.grossProfit.toLocaleString()}
                    </td>
                    <td className="mono">{ord.grossMarginPct}%</td>
                    <td className="mono" style={{ fontSize: '12px' }}>
                      <span style={{ color: 'var(--success-text)' }}>₹{ord.paidAmount.toLocaleString()}</span>
                      {due > 0 && <span style={{ color: 'var(--warning-text)' }}> / ₹{due.toLocaleString()}</span>}
                    </td>
                    <td>
                      <Badge status={ord.paymentStatus} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {ord.paymentStatus !== 'PAID' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenPayModal(ord)}
                            title="Record Payment"
                          >
                            <DollarSign size={12} />
                            <span>Pay</span>
                          </button>
                        )}
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenInvoice(ord)}
                          title="Print / View Invoice"
                        >
                          <Printer size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Sales Order with Live Margin Calculator */}
      {isOpenCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '780px' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Create Sales Order & Auto-Dispatch</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Automatic landed cost calculation and stock adjustment
                </p>
              </div>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={onCloseCreateModal}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateOrder}>
              <div className="modal-body">
                {/* Client Select */}
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Client Hotel / Restaurant *</label>
                    <select
                      className="form-select"
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Hotel / Venue --</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.deliveryZone || 'General'}) • Held Cans: {c.emptyJarsHeld}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Delivery Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Products & Batch Selection */}
                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Order Items & Batch Assignment
                    </div>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddItem}>
                      <Plus size={12} />
                      <span>Add Product Line</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {orderItems.map((item, idx) => {
                      const prod = products.find((p) => p.id === item.productId);
                      const availableBatches = batches.filter(
                        (b) => b.productId === item.productId && b.quantityRemaining > 0
                      );

                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '2fr 2fr 1fr 1fr auto',
                            gap: '8px',
                            alignItems: 'end',
                            padding: '8px',
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                          }}
                        >
                          <div className="form-group">
                            <label className="form-label">Product</label>
                            <select
                              className="form-select"
                              value={item.productId}
                              onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                              required
                            >
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} (Stock: {p.currentStock})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Batch (FIFO Landed Cost)</label>
                            <select
                              className="form-select"
                              value={item.batchId}
                              onChange={(e) => handleItemChange(idx, 'batchId', e.target.value)}
                            >
                              <option value="">Auto FIFO (Oldest Stock)</option>
                              {availableBatches.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.batchNumber} (Rem: {b.quantityRemaining} | ₹{b.landedCostPerUnit}/u)
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Qty</label>
                            <input
                              type="number"
                              min="1"
                              className="form-input mono"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value))}
                              required
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label">Price (₹)</label>
                            <input
                              type="number"
                              step="0.5"
                              className="form-input mono"
                              value={item.unitPrice}
                              onChange={(e) => handleItemChange(idx, 'unitPrice', Number(e.target.value))}
                              required
                            />
                          </div>

                          <div>
                            {orderItems.length > 1 && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '8px', color: 'var(--danger-text)' }}
                                onClick={() => handleRemoveItem(idx)}
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Live Margin Calculation Card (Minimal solid) */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    padding: '12px 16px',
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Calculated Order Economics
                    </div>
                    <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
                      <div>
                        Total Sales: <strong className="mono">₹{previewSubtotal.toLocaleString()}</strong>
                      </div>
                      <div>
                        COGS Cost: <span className="mono" style={{ color: 'var(--text-muted)' }}>₹{previewCOGS.toLocaleString()}</span>
                      </div>
                      <div>
                        Gross Profit: <span className="mono" style={{ color: 'var(--success-text)', fontWeight: 600 }}>+₹{previewGrossProfit.toLocaleString()}</span>
                      </div>
                      <div>
                        Margin: <strong className="mono">{previewGrossMargin}%</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Driver & Dispatch Details */}
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Assigned Delivery Driver</label>
                    <input
                      type="text"
                      className="form-input"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      placeholder="e.g. Ramesh Pawar"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vehicle Registration #</label>
                    <input
                      type="text"
                      className="form-input mono"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value)}
                      placeholder="e.g. MH-12-PQ-4521"
                      required
                    />
                  </div>
                </div>

                {/* Payment settlement */}
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Initial Paid Amount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      max={previewSubtotal}
                      className="form-input mono"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(Number(e.target.value))}
                      placeholder="0 for credit/due"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Method</label>
                    <select
                      className="form-select"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="CREDIT">Client Credit (Pay later)</option>
                      <option value="CASH">Cash on Delivery</option>
                      <option value="UPI">UPI / QR Code</option>
                      <option value="BANK_TRANSFER">Bank IMPS / NEFT</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Special Delivery / Packaging Notes</label>
                  <input
                    type="text"
                    className="form-input"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="e.g. Morning delivery before banquet breakfast service"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onCloseCreateModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  <CheckCircle2 size={14} />
                  <span>{submitting ? 'Generating...' : 'Confirm Order & Schedule Delivery'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Payment on Outstanding Invoice */}
      {isPayModalOpen && selectedOrder && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Record Invoice Payment</h3>
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
                  <div>Invoice: <strong className="mono">{selectedOrder.invoiceNumber}</strong></div>
                  <div>Client: <strong>{selectedOrder.client?.name}</strong></div>
                  <div>Total Billed: <span className="mono">₹{selectedOrder.totalAmount.toLocaleString()}</span></div>
                  <div>Already Paid: <span className="mono" style={{ color: 'var(--success-text)' }}>₹{selectedOrder.paidAmount.toLocaleString()}</span></div>
                  <div>Remaining Due: <strong className="mono" style={{ color: 'var(--warning-text)' }}>₹{(selectedOrder.totalAmount - selectedOrder.paidAmount).toLocaleString()}</strong></div>
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Amount (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedOrder.totalAmount - selectedOrder.paidAmount}
                    className="form-input mono"
                    value={paymentInputAmount}
                    onChange={(e) => setPaymentInputAmount(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Channel *</label>
                  <select
                    className="form-select"
                    value={payMethodInput}
                    onChange={(e) => setPayMethodInput(e.target.value)}
                  >
                    <option value="UPI">UPI / PhonePe / GPay</option>
                    <option value="BANK_TRANSFER">Bank NEFT / RTGS</option>
                    <option value="CASH">Cash Deposit</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Transaction UTR / Reference</label>
                  <input
                    type="text"
                    className="form-input mono"
                    value={payRefInput}
                    onChange={(e) => setPayRefInput(e.target.value)}
                    placeholder="e.g. UTR-9988273"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsPayModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <span>Record & Clear Due</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Official Tax Invoice View */}
      {isInvoiceModalOpen && selectedOrder && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '720px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Commercial Tax Invoice</h3>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={() => setIsInvoiceModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ backgroundColor: '#ffffff', color: '#000000', padding: '24px' }}>
              <div style={{ borderBottom: '2px solid #000', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>AQUAFLOW PACKAGED DRINKING WATER</h2>
                  <p style={{ fontSize: '11px', color: '#555', margin: 0 }}>FSSAI Lic: 11522034000192 | GSTIN: 27AABCA1234F1Z5</p>
                  <p style={{ fontSize: '11px', color: '#555', margin: 0 }}>Plot 12, Industrial Logistics Park, Ring Road</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>TAX INVOICE</div>
                  <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>Invoice: {selectedOrder.invoiceNumber}</div>
                  <div style={{ fontSize: '11px' }}>Date: {new Date(selectedOrder.orderDate).toLocaleDateString()}</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: selectedOrder.paymentStatus === 'PAID' ? 'green' : 'orange' }}>
                    Status: {selectedOrder.paymentStatus}
                  </div>
                </div>
              </div>

              <div style={{ margin: '14px 0', border: '1px solid #ccc', padding: '8px', fontSize: '12px' }}>
                <strong>Billed To:</strong>
                <div>{selectedOrder.client?.name}</div>
                <div>{selectedOrder.client?.address}</div>
                <div>Contact: {selectedOrder.client?.contactPerson} ({selectedOrder.client?.phone})</div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '16px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '1px solid #000' }}>
                    <th style={{ padding: '6px', textAlign: 'left', color: '#000' }}>Item Description</th>
                    <th style={{ padding: '6px', textAlign: 'center', color: '#000' }}>Qty</th>
                    <th style={{ padding: '6px', textAlign: 'right', color: '#000' }}>Rate (₹)</th>
                    <th style={{ padding: '6px', textAlign: 'right', color: '#000' }}>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items?.map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '6px', color: '#000' }}>{it.product?.name}</td>
                      <td style={{ padding: '6px', textAlign: 'center', color: '#000' }}>{it.quantity}</td>
                      <td style={{ padding: '6px', textAlign: 'right', color: '#000' }}>₹{it.unitPrice.toFixed(2)}</td>
                      <td style={{ padding: '6px', textAlign: 'right', fontWeight: 600, color: '#000' }}>₹{it.totalPrice.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={3} style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#000' }}>Total Amount:</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, fontSize: '14px', color: '#000' }}>
                      ₹{selectedOrder.totalAmount.toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={3} style={{ padding: '4px', textAlign: 'right', color: '#555' }}>Amount Paid:</td>
                    <td style={{ padding: '4px', textAlign: 'right', color: 'green', fontWeight: 600 }}>
                      ₹{selectedOrder.paidAmount.toLocaleString()}
                    </td>
                  </tr>
                  {selectedOrder.totalAmount - selectedOrder.paidAmount > 0 && (
                    <tr>
                      <td colSpan={3} style={{ padding: '4px', textAlign: 'right', color: '#555' }}>Balance Due:</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: '#d97706', fontWeight: 700 }}>
                        ₹{(selectedOrder.totalAmount - selectedOrder.paidAmount).toLocaleString()}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div style={{ fontSize: '10px', color: '#666', borderTop: '1px solid #ddd', paddingTop: '8px' }}>
                Bank Details: HDFC Bank | A/c: 50200012345678 | IFSC: HDFC0001234 | AquaDistribute Operations
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsInvoiceModalOpen(false)}>
                Close
              </button>
              <button className="btn btn-primary" onClick={() => window.print()}>
                <Printer size={14} />
                <span>Print Invoice</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
