import { Router } from 'express';
import { prisma } from '../prisma';

export const paymentsRouter = Router();

// GET recent payments
paymentsRouter.get('/', async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      include: {
        client: true,
        order: true,
      },
      orderBy: { paymentDate: 'desc' },
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

    if (!clientId || !payAmount || payAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Client ID and positive amount are required' });
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' });
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

      // Deduct from client's balance
      await tx.client.update({
        where: { id: clientId },
        data: {
          currentBalance: { decrement: payAmount },
        },
      });

      // If tied to order, update order status
      if (orderId) {
        const order = await tx.order.findUnique({ where: { id: orderId } });
        if (order) {
          const newPaid = order.paidAmount + payAmount;
          await tx.order.update({
            where: { id: orderId },
            data: {
              paidAmount: newPaid,
              paymentStatus: newPaid >= order.totalAmount ? 'PAID' : 'PARTIAL',
            },
          });
        }
      }

      return payment;
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});
