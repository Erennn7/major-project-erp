import React, { useState } from 'react';
import { Plus, Boxes, Calendar, Truck, X, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import type { Batch, Product } from '../types';

interface BatchesPageProps {
  batches: Batch[];
  products: Product[];
  onRefresh: () => void;
  onBatchCreated?: (newBatch: Batch) => void;
  isOpenModal: boolean;
  onOpenModal: () => void;
  onCloseModal: () => void;
}

export const BatchesPage: React.FC<BatchesPageProps> = ({
  batches,
  products,
  onRefresh,
  onBatchCreated,
  isOpenModal,
  onOpenModal,
  onCloseModal,
}) => {
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || '');
  const [batchNumber, setBatchNumber] = useState('');
  const [supplierName, setSupplierName] = useState('BluePeak Bottling Works');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [mfgDate, setMfgDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState('');
  const [quantityReceived, setQuantityReceived] = useState<number>(500);
  const [purchaseCostPerUnit, setPurchaseCostPerUnit] = useState<number>(31);
  const [transportCostTotal, setTransportCostTotal] = useState<number>(1000);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [newProdName, setNewProdName] = useState('20L Packaged Water Jar');
  const [newProdCategory, setNewProdCategory] = useState<'JAR_20L' | 'BOTTLE_1L' | 'BOTTLE_500ML' | 'CUP_250ML' | 'DISPENSER' | 'OTHER'>('JAR_20L');
  const [newProdUnit, setNewProdUnit] = useState('Jar');
  const [newProdPrice, setNewProdPrice] = useState<number>(80);
  const [newProdCost, setNewProdCost] = useState<number>(32);
  const [newProdIsReturnable, setNewProdIsReturnable] = useState(true);
  const [creatingProduct, setCreatingProduct] = useState(false);

  // Auto-sync selectedProductId when products are loaded or reset
  React.useEffect(() => {
    if (products.length > 0) {
      const exists = products.some((p) => p.id === selectedProductId);
      if (!exists) {
        setSelectedProductId(products[0].id);
      }
    } else {
      setSelectedProductId('');
    }
  }, [products, selectedProductId]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingProduct(true);
    try {
      await api.createProduct({
        name: newProdName,
        category: newProdCategory,
        unit: newProdUnit,
        defaultPrice: Number(newProdPrice),
        defaultCost: Number(newProdCost),
        isReturnable: newProdIsReturnable,
        depositAmount: newProdIsReturnable ? 150 : 0,
      });
      setIsAddProductModalOpen(false);
      onRefresh();
    } catch (err: any) {
      alert('Failed to add product: ' + err.message);
    } finally {
      setCreatingProduct(false);
    }
  };

  const handleQuickSetupProducts = async () => {
    try {
      await api.createProduct({
        name: '20L Packaged Drinking Water Jar',
        category: 'JAR_20L',
        unit: 'Jar',
        defaultPrice: 80,
        defaultCost: 32,
        isReturnable: true,
        depositAmount: 150,
      });
      await api.createProduct({
        name: '1L Bottled Mineral Water (Pack of 12)',
        category: 'BOTTLE_1L',
        unit: 'Box',
        defaultPrice: 210,
        defaultCost: 120,
        isReturnable: false,
        depositAmount: 0,
      });
      await api.createProduct({
        name: '500ml Bottled Water (Pack of 24)',
        category: 'BOTTLE_500ML',
        unit: 'Box',
        defaultPrice: 240,
        defaultCost: 135,
        isReturnable: false,
        depositAmount: 0,
      });
      onRefresh();
    } catch (err: any) {
      alert('Quick setup error: ' + err.message);
    }
  };

  // Live calculation of landed cost
  const totalCostCalc = quantityReceived * purchaseCostPerUnit + Number(transportCostTotal);
  const landedCostCalc = quantityReceived > 0 ? (totalCostCalc / quantityReceived).toFixed(2) : '0';

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      alert('Please select a product.');
      return;
    }

    const qty = Number(quantityReceived);
    if (!qty || qty <= 0 || !Number.isInteger(qty)) {
      alert('Quantity received must be a positive whole number.');
      return;
    }

    if (purchaseCostPerUnit < 0 || transportCostTotal < 0) {
      alert('Costs cannot be negative.');
      return;
    }

    if (expiryDate && mfgDate && new Date(expiryDate) < new Date(mfgDate)) {
      alert('Expiry date cannot be earlier than manufacturing date.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createBatch({
        productId: selectedProductId,
        batchNumber: batchNumber?.trim() || `BATCH-${Date.now().toString().slice(-6)}`,
        supplierName: supplierName?.trim() || 'Direct Bottler Plant',
        purchaseDate,
        mfgDate,
        expiryDate: expiryDate || null,
        quantityReceived: qty,
        purchaseCostPerUnit: Number(purchaseCostPerUnit),
        transportCostTotal: Number(transportCostTotal),
        notes: notes?.trim() || null,
      });

      onCloseModal();
      if (onBatchCreated && res) {
        onBatchCreated(res);
      } else {
        onRefresh();
      }
    } catch (err: any) {
      alert('Failed to log batch: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="content-wrapper">
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)' }}>
            Batch Procurement & Landed Cost Tracking
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Track purchased water shipments from bottling plants, freight overheads, and stock expiration
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setIsAddProductModalOpen(true)}>
            <Plus size={14} />
            <span>Add Product</span>
          </button>
          <button className="btn btn-primary btn-sm" onClick={onOpenModal}>
            <Plus size={14} />
            <span>Log New Procurement Batch</span>
          </button>
        </div>
      </div>

      {products.length === 0 && (
        <div className="card" style={{ padding: '16px 20px', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', border: '1px dashed var(--border)' }}>
          <div>
            <div style={{ fontWeight: 600 }}>No Products in Catalog</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Add a custom product or click below to quickly initialize standard 20L jars, 1L bottles, and 500ml packs.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleQuickSetupProducts}>
              ⚡ Quick Setup Standard Products
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setIsAddProductModalOpen(true)}>
              + Add Custom Product
            </button>
          </div>
        </div>
      )}

      {/* Batches Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-container" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Batch #</th>
                <th>Product</th>
                <th>Supplier Bottler</th>
                <th>Purchase Date</th>
                <th>Stock Left / Total</th>
                <th>Purchase Cost</th>
                <th>Transport Cost</th>
                <th>Landed Cost / Unit</th>
                <th>Landed Valuation</th>
                <th>Expiry</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const stockPct = ((b.quantityRemaining / b.quantityReceived) * 100).toFixed(0);
                const isLow = b.quantityRemaining < b.quantityReceived * 0.2;
                return (
                  <tr key={b.id}>
                    <td className="mono" style={{ fontWeight: 600 }}>{b.batchNumber}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{b.product?.name}</div>
                      <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {b.product?.sku}
                      </div>
                    </td>
                    <td style={{ fontSize: '12px' }}>{b.supplierName}</td>
                    <td style={{ fontSize: '12px' }}>{new Date(b.purchaseDate).toLocaleDateString()}</td>
                    <td>
                      <div className="mono" style={{ fontWeight: 600, color: isLow ? 'var(--warning-text)' : 'var(--text-main)' }}>
                        {b.quantityRemaining} / {b.quantityReceived}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{stockPct}% remaining</div>
                    </td>
                    <td className="mono">₹{b.purchaseCostPerUnit.toFixed(2)}</td>
                    <td className="mono">₹{b.transportCostTotal.toLocaleString()}</td>
                    <td className="mono" style={{ fontWeight: 600, color: 'var(--info-text)' }}>
                      ₹{b.landedCostPerUnit.toFixed(2)}
                    </td>
                    <td className="mono" style={{ fontWeight: 600 }}>
                      ₹{(b.quantityRemaining * b.landedCostPerUnit).toLocaleString()}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Log New Batch */}
      {isOpenModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Log Procurement Batch Intake</h3>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={onCloseModal}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateBatch}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Product to Stock *</label>
                    <select
                      className="form-select"
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      required
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Batch Code / Lot #</label>
                    <input
                      type="text"
                      className="form-input mono"
                      value={batchNumber}
                      onChange={(e) => setBatchNumber(e.target.value)}
                      placeholder="e.g. BATCH-2026-OCT-A3"
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Bottling Supplier / Source *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      placeholder="e.g. BluePeak Bottling Plant"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Quantity Received (Units) *</label>
                    <input
                      type="number"
                      min="1"
                      className="form-input mono"
                      value={quantityReceived}
                      onChange={(e) => setQuantityReceived(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Base Purchase Price / Unit (₹) *</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      className="form-input mono"
                      value={purchaseCostPerUnit}
                      onChange={(e) => setPurchaseCostPerUnit(Number(e.target.value))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Transport & Freight Overhead (₹)</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input mono"
                      value={transportCostTotal}
                      onChange={(e) => setTransportCostTotal(Number(e.target.value))}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Landed Cost Realtime Calculation Card */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    padding: '12px 14px',
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Total Procurement Outlay
                    </div>
                    <div className="mono" style={{ fontSize: '15px', fontWeight: 600 }}>
                      ₹{totalCostCalc.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      True Landed Unit Cost
                    </div>
                    <div className="mono" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--info-text)' }}>
                      ₹{landedCostCalc} / unit
                    </div>
                  </div>
                </div>

                <div className="grid-3">
                  <div className="form-group">
                    <label className="form-label">Purchase Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Mfg Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={mfgDate}
                      onChange={(e) => setMfgDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Best Before / Expiry</label>
                    <input
                      type="date"
                      min={mfgDate}
                      className="form-input"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Lab Quality Notes / Seal Specs</label>
                  <textarea
                    className="form-textarea"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="TDS 45ppm, micro-filter batch certification verified."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  <CheckCircle2 size={14} />
                  <span>{submitting ? 'Adding...' : 'Save Batch & Update Depot Stock'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add New Custom Product */}
      {isAddProductModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Add New Product to Catalog</h3>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={() => setIsAddProductModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateProduct}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    placeholder="e.g. 20L Packaged Water Jar"
                    required
                  />
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <select
                      className="form-select"
                      value={newProdCategory}
                      onChange={(e) => setNewProdCategory(e.target.value as any)}
                    >
                      <option value="JAR_20L">20L Water Jar</option>
                      <option value="BOTTLE_1L">1L Bottled Pack</option>
                      <option value="BOTTLE_500ML">500ml Bottled Pack</option>
                      <option value="CUP_250ML">250ml Water Cups</option>
                      <option value="DISPENSER">Water Dispenser</option>
                      <option value="OTHER">Other Accessory</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Unit of Measure *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newProdUnit}
                      onChange={(e) => setNewProdUnit(e.target.value)}
                      placeholder="Jar / Box / Case"
                      required
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Default Selling Price (₹) *</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      className="form-input mono"
                      value={newProdPrice}
                      onChange={(e) => setNewProdPrice(Number(e.target.value))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Default Baseline Cost (₹) *</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      className="form-input mono"
                      value={newProdCost}
                      onChange={(e) => setNewProdCost(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <input
                    type="checkbox"
                    id="isReturnableCheckbox"
                    checked={newProdIsReturnable}
                    onChange={(e) => setNewProdIsReturnable(e.target.checked)}
                  />
                  <label htmlFor="isReturnableCheckbox" style={{ fontSize: '13px', cursor: 'pointer' }}>
                    Requires returnable empty can deposit / exchange (e.g. 20L jars)
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddProductModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creatingProduct}>
                  <CheckCircle2 size={14} />
                  <span>{creatingProduct ? 'Creating...' : 'Create Product'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
