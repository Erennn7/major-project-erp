import React, { useState } from 'react';
import { Plus, Printer, DollarSign, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '../components/Badge';
import { api } from '../services/api';
import type { Order, Client, Product, Batch, Delivery, UserRole } from '../types';

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
  userRole?: UserRole;
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
  userRole = 'ADMIN',
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
      quantity: 10,
      unitPrice: products[0]?.defaultPrice || 80,
    },
  ]);
  const [driverName, setDriverName] = useState('Ramesh Pawar');
  const [vehicleNumber, setVehicleNumber] = useState('MH-12-PQ-4521');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('CREDIT');
  const [orderNotes, setOrderNotes] = useState('');
  const [overrideCreditLimit, setOverrideCreditLimit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Pay Modal State
  const [paymentInputAmount, setPaymentInputAmount] = useState<number>(0);
  const [payMethodInput, setPayMethodInput] = useState('UPI');
  const [payRefInput, setPayRefInput] = useState('');

  const filtered = orders.filter((o) => {
    if (filter === 'ALL') return true;
    return o.paymentStatus === filter;
  });

  // Calculate aggregated quantities per product across all line items
  const aggregatedQtyPerProduct: Record<string, number> = {};
  let previewSubtotal = 0;
  let previewCOGS = 0;

  for (const item of orderItems) {
    if (item.productId) {
      aggregatedQtyPerProduct[item.productId] =
        (aggregatedQtyPerProduct[item.productId] || 0) + (Number(item.quantity) || 0);
    }
    const prod = products.find((p) => p.id === item.productId);
    const batch = batches.find((b) => b.id === item.batchId);
    const unitCost = batch ? batch.landedCostPerUnit : prod?.defaultCost || 0;
    const itemTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
    const itemCost = (Number(item.quantity) || 0) * unitCost;
    previewSubtotal += itemTotal;
    previewCOGS += itemCost;
  }

  previewSubtotal = Number(previewSubtotal.toFixed(2));
  previewCOGS = Number(previewCOGS.toFixed(2));
  const previewGrossProfit = Number((previewSubtotal - previewCOGS).toFixed(2));
  const previewGrossMargin = previewSubtotal > 0 ? ((previewGrossProfit / previewSubtotal) * 100).toFixed(1) : '0';

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const unpaidDue = Math.max(0, Number((previewSubtotal - (Number(paidAmount) || 0)).toFixed(2)));
  const projectedBalance = selectedClient
    ? Number((selectedClient.currentBalance + unpaidDue).toFixed(2))
    : 0;
  const isCreditLimitExceeded = Boolean(
    selectedClient && selectedClient.creditLimit > 0 && projectedBalance > selectedClient.creditLimit
  );

  // Comprehensive Form Validation checks
  const hasInvalidQuantities = orderItems.some(
    (it) => !it.quantity || it.quantity <= 0 || !Number.isInteger(Number(it.quantity))
  );

  const hasStockErrors = orderItems.some((it) => {
    const prod = products.find((p) => p.id === it.productId);
    const prodStock = prod ? prod.currentStock : 0;
    const totalRequested = aggregatedQtyPerProduct[it.productId] || 0;
    const selectedBatch = batches.find((b) => b.id === it.batchId);
    return prodStock < totalRequested || (selectedBatch && Number(it.quantity) > selectedBatch.quantityRemaining);
  });

  const hasPaymentErrors = Number(paidAmount) < 0 || Number(paidAmount) > previewSubtotal;
  const isCreditBlocked = isCreditLimitExceeded && !overrideCreditLimit;

  let formValidationError: string | null = null;
  if (!selectedClientId) {
    formValidationError = 'Please choose a client hotel / restaurant.';
  } else if (orderItems.length === 0) {
    formValidationError = 'At least one product line item is required.';
  } else if (hasInvalidQuantities) {
    formValidationError = 'All product quantities must be whole positive numbers.';
  } else if (hasStockErrors) {
    formValidationError = 'Requested quantities exceed available stock in depot. Adjust order amounts.';
  } else if (hasPaymentErrors) {
    formValidationError = 'Initial payment amount cannot be negative or exceed the invoice total.';
  } else if (isCreditBlocked) {
    formValidationError = `Client credit limit exceeded by ₹${(projectedBalance - (selectedClient?.creditLimit || 0)).toLocaleString()}. Check authorization to proceed.`;
  }

  const handleAddItem = () => {
    // Pick the first available product with stock > 0 if possible
    const availableProd = products.find((p) => p.currentStock > 0) || products[0];
    setOrderItems([
      ...orderItems,
      {
        productId: availableProd?.id || '',
        batchId: '',
        quantity: Math.min(20, Math.max(1, availableProd?.currentStock || 1)),
        unitPrice: availableProd?.defaultPrice || 80,
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
        if (prod.currentStock > 0 && item.quantity > prod.currentStock) {
          item.quantity = prod.currentStock;
        }
      }
    }
    updated[index] = item;
    setOrderItems(updated);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formValidationError) {
      alert(formValidationError);
      return;
    }

    const client = clients.find((c) => c.id === selectedClientId);

    // Build optimistic preview order so user feels 0ms response time
    const tempOrderId = 'ord-' + Date.now();
    const tempDeliveryId = 'del-' + Date.now();
    const tempInvoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    const tempChallanNumber = `DC-${Date.now().toString().slice(-6)}`;

    const optimisticOrder: Order = {
      id: tempOrderId,
      invoiceNumber: tempInvoiceNumber,
      clientId: selectedClientId,
      client: client!,
      orderDate: new Date().toISOString(),
      subtotal: previewSubtotal,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: previewSubtotal,
      totalCost: previewCOGS,
      grossProfit: previewGrossProfit,
      grossMarginPct: Number(previewGrossMargin),
      paymentStatus: Number(paidAmount) >= previewSubtotal ? 'PAID' : Number(paidAmount) > 0 ? 'PARTIAL' : 'PENDING',
      paidAmount: Number(paidAmount),
      paymentMethod,
      notes: orderNotes,
      items: orderItems.map((item, idx) => {
        const prod = products.find((p) => p.id === item.productId);
        return {
          id: `item-${tempOrderId}-${idx}`,
          orderId: tempOrderId,
          productId: item.productId,
          product: prod!,
          batchId: item.batchId || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitCost: prod?.defaultCost || 0,
          totalPrice: item.quantity * item.unitPrice,
          totalCost: item.quantity * (prod?.defaultCost || 0),
          profit: item.quantity * (item.unitPrice - (prod?.defaultCost || 0)),
        };
      }),
    };

    const optimisticDelivery: Delivery = {
      id: tempDeliveryId,
      challanNumber: tempChallanNumber,
      orderId: tempOrderId,
      order: optimisticOrder,
      clientId: selectedClientId,
      client: client!,
      scheduledDate,
      status: 'SCHEDULED',
      driverName: driverName || 'Assigned Driver',
      vehicleNumber: vehicleNumber || 'Depot Van',
      deliveryAddress: client?.address || '',
      emptyJarsDelivered: orderItems.reduce((acc, i) => {
        const p = products.find((prod) => prod.id === i.productId);
        return p?.category === 'JAR_20L' || p?.isReturnable ? acc + i.quantity : acc;
      }, 0),
      emptyJarsCollected: 0,
      emptyJarsDamaged: 0,
    };

    // Close modal instantly (<1ms perceived latency)
    onCloseCreateModal();
    if (onOrderCreated) {
      onOrderCreated(optimisticOrder, optimisticDelivery);
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
        overrideCreditLimit,
      });

      if (onOrderCreated && res?.order) {
        onOrderCreated(res.order, res.delivery);
      }
    } catch (err: any) {
      alert('Order generation failed: ' + err.message);
      onRefresh(); // revert
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPayModal = (order: Order) => {
    setSelectedOrder(order);
    const pending = Math.max(0, Number((order.totalAmount - order.paidAmount).toFixed(2)));
    setPaymentInputAmount(pending);
    setIsPayModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    const remainingDue = Number((selectedOrder.totalAmount - selectedOrder.paidAmount).toFixed(2));
    if (paymentInputAmount <= 0) {
      alert('Payment amount must be greater than zero.');
      return;
    }
    if (paymentInputAmount > remainingDue) {
      alert(`Payment amount (₹${paymentInputAmount}) exceeds remaining invoice due of ₹${remainingDue}.`);
      return;
    }

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

          {userRole !== 'ACCOUNTANT' && (
            <button className="btn btn-primary btn-sm" onClick={onOpenCreateModal}>
              <Plus size={14} />
              <span>New Sales Order</span>
            </button>
          )}
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
                {userRole !== 'SALES' && <th>COGS (Cost)</th>}
                {userRole !== 'SALES' && <th>Gross Profit</th>}
                {userRole !== 'SALES' && <th>Margin %</th>}
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
                    {userRole !== 'SALES' && (
                      <td className="mono" style={{ color: 'var(--text-muted)' }}>₹{ord.totalCost.toLocaleString()}</td>
                    )}
                    {userRole !== 'SALES' && (
                      <td className="mono" style={{ color: 'var(--success-text)', fontWeight: 600 }}>
                        +₹{ord.grossProfit.toLocaleString()}
                      </td>
                    )}
                    {userRole !== 'SALES' && <td className="mono">{ord.grossMarginPct}%</td>}
                    <td className="mono" style={{ fontSize: '12px' }}>
                      <span style={{ color: 'var(--success-text)' }}>₹{ord.paidAmount.toLocaleString()}</span>
                      {due > 0 && <span style={{ color: 'var(--warning-text)' }}> / ₹{due.toLocaleString()}</span>}
                    </td>
                    <td>
                      <Badge status={ord.paymentStatus} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {ord.paymentStatus !== 'PAID' && userRole !== 'SALES' && (
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

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {orderItems.map((item, idx) => {
                      const prod = products.find((p) => p.id === item.productId);
                      const availableBatches = batches.filter(
                        (b) => b.productId === item.productId && b.quantityRemaining > 0
                      );
                      const prodStock = prod ? prod.currentStock : 0;
                      const selectedBatch = batches.find((b) => b.id === item.batchId);
                      const totalReqForProd = aggregatedQtyPerProduct[item.productId] || 0;

                      const isOutOfStock = prodStock <= 0;
                      const isLineExceeding = Number(item.quantity) > prodStock;
                      const isTotalExceeding = totalReqForProd > prodStock;
                      const isBatchExceeding = selectedBatch
                        ? Number(item.quantity) > selectedBatch.quantityRemaining
                        : false;
                      const hasStockError = isOutOfStock || isLineExceeding || isTotalExceeding || isBatchExceeding;

                      return (
                        <div
                          key={idx}
                          style={{
                            padding: '10px',
                            backgroundColor: 'var(--bg-card)',
                            border: hasStockError ? '1px solid var(--danger-border)' : '1px solid var(--border)',
                            borderRadius: '4px',
                          }}
                        >
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '2fr 2fr 1fr 1fr auto',
                              gap: '8px',
                              alignItems: 'end',
                            }}
                          >
                            <div className="form-group">
                              <label className="form-label">Product *</label>
                              <select
                                className="form-select"
                                value={item.productId}
                                onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                                required
                              >
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} {p.currentStock > 0 ? `(In Stock: ${p.currentStock})` : `[OUT OF STOCK (0)]`}
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
                              <label className="form-label">Qty *</label>
                              <input
                                type="number"
                                min="1"
                                max={Math.max(1, prodStock)}
                                className="form-input mono"
                                style={{
                                  borderColor: hasStockError ? 'var(--danger-text)' : undefined,
                                }}
                                value={item.quantity}
                                onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value))}
                                required
                              />
                            </div>

                            <div className="form-group">
                              <label className="form-label">Price (₹) *</label>
                              <input
                                type="number"
                                min="0"
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

                          {/* Inline Stock Feedback Indicators */}
                          <div style={{ marginTop: '6px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isOutOfStock ? (
                              <span style={{ color: 'var(--danger-text)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                                <AlertCircle size={12} />
                                Product is out of stock in depot (0 available). Order cannot be placed.
                              </span>
                            ) : isBatchExceeding ? (
                              <span style={{ color: 'var(--danger-text)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                                <AlertCircle size={12} />
                                Requested {item.quantity} units, but batch {selectedBatch?.batchNumber} only has {selectedBatch?.quantityRemaining} remaining.
                              </span>
                            ) : isTotalExceeding ? (
                              <span style={{ color: 'var(--danger-text)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                                <AlertCircle size={12} />
                                Total requested across all lines ({totalReqForProd}) exceeds depot stock ({prodStock}).
                              </span>
                            ) : prodStock < 20 ? (
                              <span style={{ color: 'var(--warning-text)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                ⚡ Low depot stock alert: Only {prodStock} units remaining.
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>
                                ✓ Depot stock available: <strong className="mono">{prodStock}</strong> {prod?.unit || 'units'}
                              </span>
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

                {/* Client Credit Limit Warning Card */}
                {isCreditLimitExceeded && selectedClient && (
                  <div
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid var(--danger-border)',
                      padding: '12px 14px',
                      borderRadius: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--danger-text)', fontWeight: 600, fontSize: '13px' }}>
                      <AlertCircle size={15} />
                      <span>Credit Limit Warning: {selectedClient.name}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Credit Limit: <strong className="mono">₹{selectedClient.creditLimit.toLocaleString()}</strong> | 
                      Current Dues: <span className="mono">₹{selectedClient.currentBalance.toLocaleString()}</span> | 
                      Projected Dues: <strong className="mono" style={{ color: 'var(--danger-text)' }}>₹{projectedBalance.toLocaleString()}</strong> (Exceeds limit by ₹{(projectedBalance - selectedClient.creditLimit).toLocaleString()})
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-main)' }}>
                      <input
                        type="checkbox"
                        checked={overrideCreditLimit}
                        onChange={(e) => setOverrideCreditLimit(e.target.checked)}
                      />
                      <span>Authorize management credit override for this order dispatch</span>
                    </label>
                  </div>
                )}

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
                      style={{ borderColor: paidAmount > previewSubtotal ? 'var(--danger-text)' : undefined }}
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(Number(e.target.value))}
                      placeholder="0 for credit/due"
                    />
                    {paidAmount > previewSubtotal && (
                      <span style={{ fontSize: '11px', color: 'var(--danger-text)', marginTop: '4px', display: 'block' }}>
                        Paid amount cannot exceed invoice total (₹{previewSubtotal.toLocaleString()})
                      </span>
                    )}
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

                {/* Validation Notice Banner */}
                {formValidationError && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid var(--danger-border)',
                      borderRadius: '4px',
                      color: 'var(--danger-text)',
                      fontSize: '12px',
                    }}
                  >
                    <AlertCircle size={14} />
                    <span>{formValidationError}</span>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onCloseCreateModal}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={Boolean(formValidationError) || submitting}
                  title={formValidationError || 'Confirm and place sales order'}
                >
                  <CheckCircle2 size={14} />
                  <span>
                    {submitting
                      ? 'Generating...'
                      : hasStockErrors
                      ? 'Cannot Fulfill: Stock Exceeded'
                      : isCreditBlocked
                      ? 'Credit Limit Exceeded'
                      : 'Confirm Order & Schedule Delivery'}
                  </span>
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
                    max={Math.max(1, selectedOrder.totalAmount - selectedOrder.paidAmount)}
                    className="form-input mono"
                    style={{
                      borderColor:
                        paymentInputAmount > (selectedOrder.totalAmount - selectedOrder.paidAmount)
                          ? 'var(--danger-text)'
                          : undefined,
                    }}
                    value={paymentInputAmount}
                    onChange={(e) => setPaymentInputAmount(Number(e.target.value))}
                    required
                  />
                  {paymentInputAmount > (selectedOrder.totalAmount - selectedOrder.paidAmount) && (
                    <span style={{ fontSize: '11px', color: 'var(--danger-text)', marginTop: '4px', display: 'block' }}>
                      Payment cannot exceed remaining due of ₹{(selectedOrder.totalAmount - selectedOrder.paidAmount).toLocaleString()}
                    </span>
                  )}
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
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    paymentInputAmount <= 0 ||
                    paymentInputAmount > (selectedOrder.totalAmount - selectedOrder.paidAmount)
                  }
                >
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
