import { Router } from 'express';
import { prisma } from '../prisma';
import { invalidateBootstrapCache } from './bootstrap';
import { authenticateToken, requireRoles } from '../middleware/auth';

export const paymentsRouter = Router();

// Payment ledgers and payment recording are restricted to ADMIN & ACCOUNTANT
paymentsRouter.use(authenticateToken, requireRoles('ADMIN', 'ACCOUNTANT'));

// GET recent payments
paymentsRouter.get('/', async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      include: {
        client: true,
        order: true,
      },
      orderBy: { paymentDate: 'desc' },
      take: 100,
    });
    res.json({ success: true, data: payments });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST record payment
paymentsRouter.post('/', async (req, res) => {
  try {
    const { clientId, orderId, amount, paymentDate, paymentMethod, referenceNumber, notes } = req.body;
    const payAmount = Number(amount);

    if (!clientId || typeof clientId !== 'string') {
      return res.status(400).json({ success: false, error: 'Client ID is required.' });
    }

    if (!payAmount || payAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Payment amount must be greater than zero.' });
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found in database.' });
    }

    // If payment is against a specific order, validate against that order
    let targetOrder: any = null;
    if (orderId) {
      targetOrder = await prisma.order.findUnique({ where: { id: orderId } });
      if (!targetOrder) {
        return res.status(404).json({ success: false, error: 'Target order not found.' });
      }
      if (targetOrder.clientId !== clientId) {
        return res.status(400).json({ success: false, error: 'Selected order does not belong to this client.' });
      }
      const orderDue = Number((targetOrder.totalAmount - targetOrder.paidAmount).toFixed(2));
      if (orderDue <= 0) {
        return res.status(400).json({ success: false, error: 'Selected order is already fully paid.' });
      }
      if (payAmount > orderDue + 0.01) {
        return res.status(400).json({
          success: false,
          error: `Payment amount (₹${payAmount}) exceeds remaining order balance of ₹${orderDue}.`,
        });
      }
    } else {
      // Direct client collection: client must have positive balance
      if (client.currentBalance <= 0) {
        return res.status(400).json({
          success: false,
          error: `Client "${client.name}" has no outstanding balance to collect (Current balance: ₹${client.currentBalance}).`,
        });
      }
      if (payAmount > client.currentBalance + 0.01) {
        return res.status(400).json({
          success: false,
          error: `Payment amount (₹${payAmount}) exceeds client outstanding balance of ₹${client.currentBalance}.`,
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create payment
      const payment = await tx.payment.create({
        data: {
          clientId,
          orderId: orderId || null,
          amount: payAmount,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          paymentMethod: paymentMethod || 'BANK_TRANSFER',
          referenceNumber: referenceNumber || null,
          notes: notes || null,
        },
      });

      // Deduct from client's balance (safe clamped to 0)
      const newClientBalance = Math.max(0, Number((client.currentBalance - payAmount).toFixed(2)));
      await tx.client.update({
        where: { id: clientId },
        data: {
          currentBalance: newClientBalance,
        },
      });

      // If tied to order, update order status
      if (targetOrder) {
        const newPaid = Number((targetOrder.paidAmount + payAmount).toFixed(2));
        await tx.order.update({
          where: { id: targetOrder.id },
          data: {
            paidAmount: newPaid,
            paymentStatus: newPaid >= targetOrder.totalAmount - 0.01 ? 'PAID' : 'PARTIAL',
          },
        });
      }

      return payment;
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    invalidateBootstrapCache();
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});
