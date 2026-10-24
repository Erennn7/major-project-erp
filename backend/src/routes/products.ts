import { Router } from 'express';
import { prisma } from '../prisma';

export const productsRouter = Router();

// GET all products with active batch count
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

// POST new product
productsRouter.post('/', async (req, res) => {
  try {
    const { name, sku, category, unit, defaultPrice, defaultCost, isReturnable, depositAmount, minStockAlert } = req.body;

    const product = await prisma.product.create({
      data: {
        name,
        sku: sku || `SKU-${Date.now().toString().slice(-6)}`,
        category: category || 'JAR_20L',
        unit: unit || 'Jar',
        defaultPrice: Number(defaultPrice) || 0,
        defaultCost: Number(defaultCost) || 0,
        isReturnable: Boolean(isReturnable),
        depositAmount: Number(depositAmount) || 0,
        currentStock: 0,
        minStockAlert: Number(minStockAlert) || 20,
      },
    });

    res.status(201).json({ success: true, data: product });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// PUT update product
productsRouter.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, sku, category, unit, defaultPrice, defaultCost, isReturnable, depositAmount, minStockAlert } = req.body;

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(sku && { sku }),
        ...(category && { category }),
        ...(unit && { unit }),
        ...(defaultPrice !== undefined && { defaultPrice: Number(defaultPrice) }),
        ...(defaultCost !== undefined && { defaultCost: Number(defaultCost) }),
        ...(isReturnable !== undefined && { isReturnable: Boolean(isReturnable) }),
        ...(depositAmount !== undefined && { depositAmount: Number(depositAmount) }),
        ...(minStockAlert !== undefined && { minStockAlert: Number(minStockAlert) }),
      },
    });

    res.json({ success: true, data: product });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE product
productsRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.product.delete({ where: { id } });
    res.json({ success: true, message: 'Product deleted' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});
