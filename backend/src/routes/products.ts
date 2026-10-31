import { Router } from 'express';
import { prisma } from '../prisma';
import { invalidateBootstrapCache } from './bootstrap';
import { authenticateToken, requireRoles } from '../middleware/auth';

export const productsRouter = Router();

// Base auth
productsRouter.use(authenticateToken);

// GET all products with active batch count (All authenticated roles)
productsRouter.get('/', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        batches: {
          where: { quantityRemaining: { gt: 0 } },
          orderBy: { purchaseDate: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: products });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST new product (strictly ADMIN)
productsRouter.post('/', requireRoles('ADMIN'), async (req, res) => {
  try {
    const { name, sku, category, unit, defaultPrice, defaultCost, isReturnable, depositAmount, minStockAlert } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Product name is required.' });
    }

    const price = Number(defaultPrice);
    const cost = Number(defaultCost);

    if (isNaN(price) || price < 0) {
      return res.status(400).json({ success: false, error: 'Default price cannot be negative.' });
    }
    if (isNaN(cost) || cost < 0) {
      return res.status(400).json({ success: false, error: 'Default cost cannot be negative.' });
    }

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        sku: sku?.trim() || `SKU-${Date.now().toString().slice(-6)}`,
        category: category || 'JAR_20L',
        unit: unit?.trim() || 'Jar',
        defaultPrice: price,
        defaultCost: cost,
        isReturnable: Boolean(isReturnable),
        depositAmount: Number(depositAmount) || 0,
        currentStock: 0,
        minStockAlert: Math.max(0, Number(minStockAlert) || 20),
      },
    });

    invalidateBootstrapCache();
    res.status(201).json({ success: true, data: product });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// PUT update product (strictly ADMIN)
productsRouter.put('/:id', requireRoles('ADMIN'), async (req, res) => {
  try {
    const id = req.params.id as string;
    const { name, sku, category, unit, defaultPrice, defaultCost, isReturnable, depositAmount, minStockAlert } = req.body;

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(sku && { sku: sku.trim() }),
        ...(category && { category }),
        ...(unit && { unit: unit.trim() }),
        ...(defaultPrice !== undefined && { defaultPrice: Math.max(0, Number(defaultPrice)) }),
        ...(defaultCost !== undefined && { defaultCost: Math.max(0, Number(defaultCost)) }),
        ...(isReturnable !== undefined && { isReturnable: Boolean(isReturnable) }),
        ...(depositAmount !== undefined && { depositAmount: Math.max(0, Number(depositAmount)) }),
        ...(minStockAlert !== undefined && { minStockAlert: Math.max(0, Number(minStockAlert)) }),
      },
    });

    invalidateBootstrapCache();
    res.json({ success: true, data: product });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST reconcile stock (strictly ADMIN audit adjustment)
productsRouter.post('/:id/reconcile-stock', requireRoles('ADMIN'), async (req, res) => {
  try {
    const id = req.params.id as string;
    const { targetStock, reason } = req.body;
    const newStock = Number(targetStock);

    if (isNaN(newStock) || newStock < 0 || !Number.isInteger(newStock)) {
      return res.status(400).json({ success: false, error: 'Target stock must be a non-negative whole number.' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const prod = await tx.product.findUnique({
        where: { id },
        include: { batches: true },
      });
      if (!prod) {
        throw new Error('Product not found.');
      }

      // Update product currentStock
      const updatedProduct = await tx.product.update({
        where: { id },
        data: { currentStock: newStock },
      });

      // If batch quantity was negative or out-of-sync, reconcile batches
      const activeBatches = await tx.batch.findMany({
        where: { productId: id },
        orderBy: { purchaseDate: 'desc' },
      });

      if (activeBatches.length > 0) {
        // If the newest batch was negative, clamp it to 0 or match
        for (const b of activeBatches) {
          if (b.quantityRemaining < 0) {
            await tx.batch.update({
              where: { id: b.id },
              data: { quantityRemaining: 0 },
            });
          }
        }
      }

      return updatedProduct;
    });

    invalidateBootstrapCache();
    res.json({ success: true, data: updated, message: `Stock reconciled to ${newStock}` });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE product (strictly ADMIN)
productsRouter.delete('/:id', requireRoles('ADMIN'), async (req, res) => {
  try {
    const id = req.params.id as string;
    await prisma.product.delete({ where: { id } });
    invalidateBootstrapCache();
    res.json({ success: true, message: 'Product deleted' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

