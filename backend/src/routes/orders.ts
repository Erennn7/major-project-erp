import { Router } from 'express';
import { prisma } from '../prisma';
import { invalidateBootstrapCache } from './bootstrap';
import { authenticateToken, requireRoles } from '../middleware/auth';

export const ordersRouter = Router();

// Base auth
ordersRouter.use(authenticateToken);

// GET all orders (ADMIN, ACCOUNTANT, SALES)
ordersRouter.get('/', requireRoles('ADMIN', 'ACCOUNTANT', 'SALES'), async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        client: {
          select: { id: true, name: true, phone: true, address: true, emptyJarsHeld: true, currentBalance: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, category: true, unit: true },
            },
          },
        },
      },
      orderBy: { orderDate: 'desc' },
      take: 100,
    });

    if (req.user?.role === 'SALES') {
      const sanitized = orders.map((o) => ({
        ...o,
        totalCost: 0,
        grossProfit: 0,
        grossMarginPct: 0,
        items: o.items.map((it: any) => ({
          ...it,
          costPricePerUnit: 0,
          profit: 0,
        })),
      }));
      return res.json({ success: true, data: sanitized });
    }

    res.json({ success: true, data: orders });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single order with full details (ADMIN, ACCOUNTANT, SALES)
ordersRouter.get('/:id', requireRoles('ADMIN', 'ACCOUNTANT', 'SALES'), async (req, res) => {
  try {
    const id = req.params.id as string;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        client: true,
        items: {
          include: {
            product: true,
            batch: true,
          },
        },
        delivery: true,
        payments: true,
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (req.user?.role === 'SALES') {
      const sanitized = {
        ...order,
        totalCost: 0,
        grossProfit: 0,
        grossMarginPct: 0,
        items: order.items.map((it) => ({
          ...it,
          costPricePerUnit: 0,
          profit: 0,
          batch: null,
        })),
      };
      return res.json({ success: true, data: sanitized });
    }

    res.json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST create sales order (ADMIN & SALES)
ordersRouter.post('/', requireRoles('ADMIN', 'SALES'), async (req, res) => {
  try {
    const {
      clientId,
      items, // array of { productId, quantity, unitPrice, batchId? }
      orderDate,
      paymentStatus, // 'PAID' | 'PARTIAL' | 'PENDING'
      paidAmount,
      paymentMethod,
      notes,
      driverName,
      vehicleNumber,
      scheduledDate,
      overrideCreditLimit,
    } = req.body;

    if (!clientId || typeof clientId !== 'string') {
      return res.status(400).json({ success: false, error: 'Valid Client ID is required.' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one order line item is required.' });
    }

    // Validate each item structure & positive quantities
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.productId) {
        return res.status(400).json({ success: false, error: `Item at line ${i + 1} is missing a Product ID.` });
      }
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({
          success: false,
          error: `Line ${i + 1}: Quantity must be a positive whole number (received ${item.quantity}).`,
        });
      }
      if (item.unitPrice !== undefined && (typeof item.unitPrice !== 'number' || item.unitPrice < 0)) {
        return res.status(400).json({
          success: false,
          error: `Line ${i + 1}: Unit price cannot be negative.`,
        });
      }
    }

    // Aggregate requested quantities per product to catch multi-line duplicates
    const aggregatedQtyPerProduct = new Map<string, number>();
    for (const item of items) {
      const current = aggregatedQtyPerProduct.get(item.productId) || 0;
      aggregatedQtyPerProduct.set(item.productId, current + Number(item.quantity));
    }

    const productIds = Array.from(aggregatedQtyPerProduct.keys());

    // Fetch client, products, and available batches
    const [client, productsList, batchesList] = await Promise.all([
      prisma.client.findUnique({ where: { id: clientId } }),
      prisma.product.findMany({ where: { id: { in: productIds } } }),
      prisma.batch.findMany({
        where: { productId: { in: productIds }, quantityRemaining: { gt: 0 } },
        orderBy: { purchaseDate: 'asc' },
      }),
    ]);

    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found in database.' });
    }

    const productMap = new Map(productsList.map((p) => [p.id, p]));

    // Validate that all products exist and have sufficient stock
    for (const [productId, totalRequested] of aggregatedQtyPerProduct.entries()) {
      const product = productMap.get(productId);
      if (!product) {
        return res.status(404).json({ success: false, error: `Product ID ${productId} not found.` });
      }
      if (product.currentStock < totalRequested) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for "${product.name}". Available in depot: ${product.currentStock}, Total requested: ${totalRequested}. Order cannot be placed.`,
        });
      }
    }

    // Validate specific batch assignments if provided by the user
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.batchId) {
        const batch = batchesList.find((b) => b.id === item.batchId);
        if (!batch) {
          return res.status(400).json({
            success: false,
            error: `Line ${i + 1}: Selected batch was not found or has 0 units remaining.`,
          });
        }
        if (batch.quantityRemaining < Number(item.quantity)) {
          return res.status(400).json({
            success: false,
            error: `Line ${i + 1}: Selected batch ${batch.batchNumber} has only ${batch.quantityRemaining} units remaining, but ${item.quantity} requested.`,
          });
        }
      }
    }

    // Process order inside an atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      let orderSubtotal = 0;
      let orderTotalCost = 0;
      let totalReturnableJars = 0;
      const orderItemsData: any[] = [];
      const batchUpdates: Promise<any>[] = [];
      const productUpdates: Promise<any>[] = [];

      // Clone batchesList to safely track in-memory remaining stock across lines
      const inMemoryBatches = batchesList.map((b) => ({ ...b }));

      for (const item of items) {
        const product = productMap.get(item.productId)!;
        const qty = Number(item.quantity);
        const unitPrice = item.unitPrice !== undefined && item.unitPrice !== null
          ? Number(item.unitPrice)
          : product.defaultPrice;

        let selectedBatchId: string | null = item.batchId || null;
        let unitCost = product.defaultCost;

        if (selectedBatchId) {
          const batch = inMemoryBatches.find((b) => b.id === selectedBatchId)!;
          unitCost = batch.landedCostPerUnit;
          batch.quantityRemaining -= qty;
          batchUpdates.push(
            tx.batch.update({
              where: { id: batch.id },
              data: { quantityRemaining: { decrement: qty } },
            })
          );
        } else {
          // Robust FIFO Allocation across batches
          let remainingQtyToAllocate = qty;
          let accumulatedBatchCost = 0;
          let allocatedUnits = 0;
          let primaryBatchId: string | null = null;

          const availableBatchesForProduct = inMemoryBatches.filter(
            (b) => b.productId === product.id && b.quantityRemaining > 0
          );

          for (const b of availableBatchesForProduct) {
            if (remainingQtyToAllocate <= 0) break;

            const deduct = Math.min(b.quantityRemaining, remainingQtyToAllocate);
            if (!primaryBatchId) primaryBatchId = b.id;

            b.quantityRemaining -= deduct;
            remainingQtyToAllocate -= deduct;
            accumulatedBatchCost += deduct * b.landedCostPerUnit;
            allocatedUnits += deduct;

            batchUpdates.push(
              tx.batch.update({
                where: { id: b.id },
                data: { quantityRemaining: { decrement: deduct } },
              })
            );
          }

          // If unbatched stock remains (or if product had stock without batches), use product default cost
          if (remainingQtyToAllocate > 0) {
            accumulatedBatchCost += remainingQtyToAllocate * product.defaultCost;
            allocatedUnits += remainingQtyToAllocate;
          }

          selectedBatchId = primaryBatchId;
          unitCost = allocatedUnits > 0
            ? Number((accumulatedBatchCost / allocatedUnits).toFixed(2))
            : product.defaultCost;
        }

        // Deduct product stock (guaranteed >= 0 by earlier check)
        productUpdates.push(
          tx.product.update({
            where: { id: product.id },
            data: { currentStock: { decrement: qty } },
          })
        );

        if (product.category === 'JAR_20L' || product.isReturnable) {
          totalReturnableJars += qty;
        }

        const totalPrice = Number((qty * unitPrice).toFixed(2));
        const totalCost = Number((qty * unitCost).toFixed(2));
        const profit = Number((totalPrice - totalCost).toFixed(2));

        orderSubtotal += totalPrice;
        orderTotalCost += totalCost;

        orderItemsData.push({
          productId: product.id,
          batchId: selectedBatchId,
          quantity: qty,
          unitPrice,
          unitCost,
          totalPrice,
          totalCost,
          profit,
        });
      }

      orderSubtotal = Number(orderSubtotal.toFixed(2));
      orderTotalCost = Number(orderTotalCost.toFixed(2));
      const grossProfit = Number((orderSubtotal - orderTotalCost).toFixed(2));
      const grossMarginPct = orderSubtotal > 0 ? Number(((grossProfit / orderSubtotal) * 100).toFixed(2)) : 0;

      // Validate payment bounds
      const initialPaid = Number(paidAmount) || 0;
      if (initialPaid < 0) {
        throw new Error('Initial paid amount cannot be negative.');
      }
      if (initialPaid > orderSubtotal) {
        throw new Error(`Initial payment (₹${initialPaid}) cannot exceed order subtotal (₹${orderSubtotal}).`);
      }

      const unpaidDue = Math.max(0, Number((orderSubtotal - initialPaid).toFixed(2)));
      const status = initialPaid >= orderSubtotal ? 'PAID' : initialPaid > 0 ? 'PARTIAL' : (paymentStatus || 'PENDING');

      // Credit limit check
      if (unpaidDue > 0 && client.creditLimit > 0) {
        const projectedBalance = Number((client.currentBalance + unpaidDue).toFixed(2));
        if (projectedBalance > client.creditLimit && !overrideCreditLimit) {
          throw new Error(
            `Credit limit exceeded for "${client.name}". Current balance: ₹${client.currentBalance.toLocaleString()}, Credit limit: ₹${client.creditLimit.toLocaleString()}. With this order, balance would become ₹${projectedBalance.toLocaleString()}. Check "Authorize credit override" to proceed.`
          );
        }
      }

      // Execute inventory deductions in parallel
      await Promise.all([...batchUpdates, ...productUpdates]);

      // Unique invoice number
      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;

      // Create Order
      const newOrder = await tx.order.create({
        data: {
          invoiceNumber,
          clientId,
          orderDate: orderDate ? new Date(orderDate) : new Date(),
          subtotal: orderSubtotal,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: orderSubtotal,
          totalCost: orderTotalCost,
          grossProfit,
          grossMarginPct,
          paymentStatus: status,
          paidAmount: initialPaid,
          paymentMethod: paymentMethod || 'CREDIT',
          notes: notes || null,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: true,
        },
      });

      // Update client balance if unpaid due exists
      if (unpaidDue > 0) {
        await tx.client.update({
          where: { id: clientId },
          data: {
            currentBalance: { increment: unpaidDue },
          },
        });
      }

      // Record initial payment if any paid
      if (initialPaid > 0) {
        await tx.payment.create({
          data: {
            orderId: newOrder.id,
            clientId,
            amount: initialPaid,
            paymentDate: new Date(),
            paymentMethod: paymentMethod || 'CASH',
            notes: `Initial payment at order generation for ${invoiceNumber}`,
          },
        });
      }

      // Automatically create Delivery Challan
      const challanNumber = `DC-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;
      const delivery = await tx.delivery.create({
        data: {
          challanNumber,
          orderId: newOrder.id,
          clientId,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
          status: 'SCHEDULED',
          driverName: driverName?.trim() || 'Assigned Driver',
          vehicleNumber: vehicleNumber?.trim() || 'Depot Delivery Van',
          deliveryAddress: client.address || 'Standard Delivery Address',
          recipientName: client.contactPerson || 'Store Incharge',
          recipientPhone: client.phone || '',
          notes: `Auto-scheduled delivery for Invoice ${invoiceNumber}`,
          emptyJarsDelivered: totalReturnableJars,
          emptyJarsCollected: 0,
          emptyJarsDamaged: 0,
        },
      });

      const populatedOrder: any = {
        ...newOrder,
        client,
        items: newOrder.items.map((it) => ({
          ...it,
          product: productMap.get(it.productId),
          batch: it.batchId ? inMemoryBatches.find((b) => b.id === it.batchId) || null : null,
        })),
      };

      const populatedDelivery: any = {
        ...delivery,
        client,
      };

      return { order: populatedOrder, delivery: populatedDelivery };
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    invalidateBootstrapCache();
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    console.error('Order creation error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// PUT update order status / payment (ADMIN & ACCOUNTANT)
ordersRouter.put('/:id/payment', requireRoles('ADMIN', 'ACCOUNTANT'), async (req, res) => {
  try {
    const id = req.params.id as string;
    const { amount, paymentMethod, referenceNumber, notes } = req.body;
    const payAmount = Number(amount);

    if (!payAmount || payAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Payment amount must be greater than zero.' });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { client: true },
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found.' });
    }

    const remainingDue = Number((order.totalAmount - order.paidAmount).toFixed(2));
    if (remainingDue <= 0) {
      return res.status(400).json({ success: false, error: 'This invoice is already fully paid.' });
    }

    if (payAmount > remainingDue + 0.001) {
      return res.status(400).json({
        success: false,
        error: `Payment amount (₹${payAmount}) exceeds remaining invoice due of ₹${remainingDue}.`,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const newPaidTotal = Number((order.paidAmount + payAmount).toFixed(2));
      const newStatus = newPaidTotal >= order.totalAmount - 0.001 ? 'PAID' : 'PARTIAL';

      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          paidAmount: newPaidTotal,
          paymentStatus: newStatus,
        },
      });

      // Reduce client balance without letting rounding make it negative
      const newClientBalance = Math.max(0, Number((order.client.currentBalance - payAmount).toFixed(2)));
      await tx.client.update({
        where: { id: order.clientId },
        data: {
          currentBalance: newClientBalance,
        },
      });

      // Record payment
      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          clientId: order.clientId,
          amount: payAmount,
          paymentDate: new Date(),
          paymentMethod: paymentMethod || 'UPI',
          referenceNumber: referenceNumber || null,
          notes: notes || `Payment received against ${order.invoiceNumber}`,
        },
      });

      return { order: updatedOrder, payment };
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    invalidateBootstrapCache();
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});
