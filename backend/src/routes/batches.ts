import { Router } from 'express';
import { prisma } from '../prisma';
import { invalidateBootstrapCache } from './bootstrap';
import { authenticateToken, requireRoles } from '../middleware/auth';

export const batchesRouter = Router();

// Base auth
batchesRouter.use(authenticateToken);

// GET all batches (ADMIN, DISPATCHER, ACCOUNTANT)
batchesRouter.get('/', requireRoles('ADMIN', 'DISPATCHER', 'ACCOUNTANT'), async (req, res) => {
  try {
    const batches = await prisma.batch.findMany({
      include: {
        product: true,
      },
      orderBy: { purchaseDate: 'desc' },
      take: 100,
    });

    // If DISPATCHER, sanitize landed costs
    if (req.user?.role === 'DISPATCHER') {
      const sanitized = batches.map((b) => ({
        ...b,
        purchaseCostPerUnit: 0,
        transportCostTotal: 0,
        totalCost: 0,
        landedCostPerUnit: 0,
      }));
      return res.json({ success: true, data: sanitized });
    }

    res.json({ success: true, data: batches });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST new procurement batch (strictly ADMIN)
batchesRouter.post('/', requireRoles('ADMIN'), async (req, res) => {
  try {
    const {
      batchNumber,
      productId,
      supplierName,
      purchaseDate,
      mfgDate,
      expiryDate,
      quantityReceived,
      purchaseCostPerUnit,
      transportCostTotal,
      notes,
    } = req.body;

    if (!productId || typeof productId !== 'string') {
      return res.status(400).json({ success: false, error: 'Product ID is required to log a batch.' });
    }

    const qty = Number(quantityReceived);
    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ success: false, error: 'Quantity received must be a positive whole number.' });
    }

    const unitPurchaseCost = Number(purchaseCostPerUnit);
    if (isNaN(unitPurchaseCost) || unitPurchaseCost < 0) {
      return res.status(400).json({ success: false, error: 'Purchase cost per unit cannot be negative.' });
    }

    const transport = Number(transportCostTotal) || 0;
    if (transport < 0) {
      return res.status(400).json({ success: false, error: 'Transport freight cost cannot be negative.' });
    }

    const mfg = mfgDate ? new Date(mfgDate) : new Date();
    const purchase = purchaseDate ? new Date(purchaseDate) : new Date();
    let expiry: Date | null = null;

    if (expiryDate) {
      expiry = new Date(expiryDate);
      if (expiry < mfg) {
        return res.status(400).json({
          success: false,
          error: 'Expiry date cannot be earlier than manufacturing date.',
        });
      }
    }

    const totalCost = Number((qty * unitPurchaseCost + transport).toFixed(2));
    const landedCostPerUnit = qty > 0 ? Number((totalCost / qty).toFixed(2)) : unitPurchaseCost;

    const finalBatchNumber = batchNumber?.trim() || `BATCH-${Date.now().toString().slice(-6)}`;

    // Check batch number uniqueness
    const existingBatch = await prisma.batch.findUnique({ where: { batchNumber: finalBatchNumber } });
    if (existingBatch) {
      return res.status(400).json({
        success: false,
        error: `Batch number "${finalBatchNumber}" already exists. Please use a unique batch identifier.`,
      });
    }

    const batch = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) {
        throw new Error('Selected product was not found in database. Please choose a valid product.');
      }

      const newBatch = await tx.batch.create({
        data: {
          batchNumber: finalBatchNumber,
          productId: product.id,
          supplierName: supplierName?.trim() || 'Direct Bottler Plant',
          purchaseDate: purchase,
          mfgDate: mfg,
          expiryDate: expiry,
          quantityReceived: qty,
          quantityRemaining: qty,
          purchaseCostPerUnit: unitPurchaseCost,
          transportCostTotal: transport,
          totalCost,
          landedCostPerUnit,
          notes: notes?.trim() || null,
        },
        include: { product: true },
      });

      // Increment product stock
      await tx.product.update({
        where: { id: productId },
        data: {
          currentStock: { increment: qty },
        },
      });

      return newBatch;
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    invalidateBootstrapCache();
    res.status(201).json({ success: true, data: batch });
  } catch (error: any) {
    console.error('Batch creation error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// PUT update batch (strictly ADMIN)
batchesRouter.put('/:id', requireRoles('ADMIN'), async (req, res) => {
  try {
    const id = req.params.id as string;
    const { supplierName, notes, expiryDate } = req.body;

    const batch = await prisma.batch.update({
      where: { id },
      data: {
        ...(supplierName && { supplierName: supplierName.trim() }),
        ...(notes !== undefined && { notes: notes ? notes.trim() : null }),
        ...(expiryDate && { expiryDate: new Date(expiryDate) }),
      },
      include: { product: true },
    });

    invalidateBootstrapCache();
    res.json({ success: true, data: batch });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE batch (strictly ADMIN, only if no orders tied)
batchesRouter.delete('/:id', requireRoles('ADMIN'), async (req, res) => {
  try {
    const id = req.params.id as string;
    const batch = await prisma.batch.findUnique({
      where: { id },
      include: { orderItems: true },
    });

    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }

    if (batch.orderItems.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete batch that has fulfilled orders. Stock is already dispatched.',
      });
    }

    await prisma.$transaction(async (tx) => {
      // Revert remaining stock from product safely
      const prod = await tx.product.findUnique({ where: { id: batch.productId } });
      const newStock = Math.max(0, (prod?.currentStock || 0) - batch.quantityRemaining);
      await tx.product.update({
        where: { id: batch.productId },
        data: { currentStock: newStock },
      });
      await tx.batch.delete({ where: { id } });
    });

    invalidateBootstrapCache();
    res.json({ success: true, message: 'Batch deleted and product stock adjusted' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});
