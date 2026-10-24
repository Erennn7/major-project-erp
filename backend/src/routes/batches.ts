import { Router } from 'express';
import { prisma } from '../prisma';

export const batchesRouter = Router();

// GET all batches
batchesRouter.get('/', async (req, res) => {
  try {
    const batches = await prisma.batch.findMany({
      include: {
        product: true,
      },
      orderBy: { purchaseDate: 'desc' },
    });
    res.json({ success: true, data: batches });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST new procurement batch
batchesRouter.post('/', async (req, res) => {
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

    const qty = Number(quantityReceived);
    const unitPurchaseCost = Number(purchaseCostPerUnit);
    const transport = Number(transportCostTotal) || 0;
    const totalCost = qty * unitPurchaseCost + transport;
    const landedCostPerUnit = qty > 0 ? Number((totalCost / qty).toFixed(2)) : unitPurchaseCost;

    if (!productId) {
      return res.status(400).json({ success: false, error: 'Product ID is required to log a batch.' });
    }

    const batch = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) {
        throw new Error('Selected product was not found in database. Please choose a valid product.');
      }

      const newBatch = await tx.batch.create({
        data: {
          batchNumber: batchNumber || `BATCH-${Date.now().toString().slice(-6)}`,
          productId: product.id,
          supplierName: supplierName || 'Direct Bottler Plant',
          purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
          mfgDate: mfgDate ? new Date(mfgDate) : new Date(),
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          quantityReceived: qty,
          quantityRemaining: qty,
          purchaseCostPerUnit: unitPurchaseCost,
          transportCostTotal: transport,
          totalCost,
          landedCostPerUnit,
          notes,
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

    res.status(201).json({ success: true, data: batch });
  } catch (error: any) {
    console.error('Batch creation error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// PUT update batch
batchesRouter.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { supplierName, notes, expiryDate } = req.body;

    const batch = await prisma.batch.update({
      where: { id },
      data: {
        ...(supplierName && { supplierName }),
        ...(notes !== undefined && { notes }),
        ...(expiryDate && { expiryDate: new Date(expiryDate) }),
      },
      include: { product: true },
    });

    res.json({ success: true, data: batch });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE batch (only if no orders tied)
batchesRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
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
      // Revert remaining stock from product
      await tx.product.update({
        where: { id: batch.productId },
        data: {
          currentStock: { decrement: batch.quantityRemaining },
        },
      });
      await tx.batch.delete({ where: { id } });
    });

    res.json({ success: true, message: 'Batch deleted and product stock adjusted' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});
