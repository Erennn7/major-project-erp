import { Router } from 'express';
import { prisma } from '../prisma';
import { invalidateBootstrapCache } from './bootstrap';

export const ordersRouter = Router();

// GET all orders
ordersRouter.get('/', async (req, res) => {
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
    res.json({ success: true, data: orders });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single order with full details
ordersRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
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

    res.json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST create sales order with full profit calculation & delivery challan creation
ordersRouter.post('/', async (req, res) => {
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
    } = req.body;

    if (!clientId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Client and items are required' });
    }

    const productIds = items.map((i: any) => i.productId);
    const [client, productsList, batchesList] = await Promise.all([
      prisma.client.findUnique({ where: { id: clientId } }),
      prisma.product.findMany({ where: { id: { in: productIds } } }),
      prisma.batch.findMany({
        where: { productId: { in: productIds }, quantityRemaining: { gt: 0 } },
        orderBy: { purchaseDate: 'asc' },
      }),
    ]);

    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    const productMap = new Map(productsList.map((p) => [p.id, p]));
    const batchMap = new Map(batchesList.map((b) => [b.id, b]));

    // Process order in a single atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      let orderSubtotal = 0;
      let orderTotalCost = 0;
      let totalReturnableJars = 0;
      const orderItemsData: any[] = [];
      const batchUpdates: Promise<any>[] = [];
      const productUpdates: Promise<any>[] = [];

      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        const qty = Number(item.quantity);
        const unitPrice = Number(item.unitPrice) || product.defaultPrice;

        // Determine batch & landed cost
        let selectedBatchId: string | null = item.batchId || null;
        let unitCost = product.defaultCost;

        if (selectedBatchId && batchMap.has(selectedBatchId)) {
          const batch = batchMap.get(selectedBatchId)!;
          unitCost = batch.landedCostPerUnit;
          batchUpdates.push(
            tx.batch.update({
              where: { id: batch.id },
              data: { quantityRemaining: { decrement: qty } },
            })
          );
        } else {
          // FIFO: find earliest batch from in-memory pre-fetched list
          const availableBatch = batchesList.find(
            (b) => b.productId === product.id && b.quantityRemaining > 0
          );

          if (availableBatch) {
            selectedBatchId = availableBatch.id;
            unitCost = availableBatch.landedCostPerUnit;
            availableBatch.quantityRemaining -= qty;
            batchUpdates.push(
              tx.batch.update({
                where: { id: availableBatch.id },
                data: { quantityRemaining: { decrement: qty } },
              })
            );
          }
        }

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

      const grossProfit = Number((orderSubtotal - orderTotalCost).toFixed(2));
      const grossMarginPct = orderSubtotal > 0 ? Number(((grossProfit / orderSubtotal) * 100).toFixed(2)) : 0;
      const initialPaid = Number(paidAmount) || 0;
      const status = initialPaid >= orderSubtotal ? 'PAID' : initialPaid > 0 ? 'PARTIAL' : (paymentStatus || 'PENDING');
      const unpaidDue = Math.max(0, orderSubtotal - initialPaid);

      // Run inventory updates in parallel
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

      // Update client balance
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

      // Attach client & product objects in memory (avoids 5 extra roundtrips across the network)
      const populatedOrder: any = {
        ...newOrder,
        client,
        items: newOrder.items.map((item) => ({
          ...item,
          product: productMap.get(item.productId),
          batch: item.batchId ? batchMap.get(item.batchId) : null,
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

// PUT update order status / payment
ordersRouter.put('/:id/payment', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, referenceNumber, notes } = req.body;
    const payAmount = Number(amount);

    if (!payAmount || payAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid payment amount is required' });
    }

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const newPaidTotal = order.paidAmount + payAmount;
      const newStatus = newPaidTotal >= order.totalAmount ? 'PAID' : 'PARTIAL';

      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          paidAmount: newPaidTotal,
          paymentStatus: newStatus,
        },
      });

      // Reduce client balance
      await tx.client.update({
        where: { id: order.clientId },
        data: {
          currentBalance: { decrement: payAmount },
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
