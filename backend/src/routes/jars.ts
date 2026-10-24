import { Router } from 'express';
import { prisma } from '../prisma';

export const jarsRouter = Router();

// GET jar summary and client ledger
jarsRouter.get('/summary', async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      select: {
        id: true,
        name: true,
        clientType: true,
        contactPerson: true,
        phone: true,
        emptyJarsHeld: true,
        deliveryZone: true,
      },
      orderBy: { emptyJarsHeld: 'desc' },
    });

    const jarProduct = await prisma.product.findFirst({
      where: { category: 'JAR_20L' },
    });

    const totalJarsWithClients = clients.reduce((acc, c) => acc + c.emptyJarsHeld, 0);
    const jarsInDepotStock = jarProduct ? jarProduct.currentStock : 0;
    const totalAssetJars = totalJarsWithClients + jarsInDepotStock;

    const recentTransactions = await prisma.jarTransaction.findMany({
      include: {
        client: true,
        delivery: true,
      },
      orderBy: { date: 'desc' },
      take: 30,
    });

    res.json({
      success: true,
      data: {
        totalAssetJars,
        totalJarsWithClients,
        jarsInDepotStock,
        clients,
        recentTransactions,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST manual jar pickup or adjustment
jarsRouter.post('/adjust', async (req, res) => {
  try {
    const { clientId, type, quantity, notes } = req.body;
    const qty = Number(quantity);

    if (!clientId || !qty || qty <= 0) {
      return res.status(400).json({ success: false, error: 'Client ID and positive quantity required' });
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // type: 'COLLECTED_EMPTY' (pickup empties) | 'DELIVERED_FULL' | 'DAMAGED_LOST'
      let newBalance = client.emptyJarsHeld;
      let jarsOut = 0;
      let jarsIn = 0;

      if (type === 'COLLECTED_EMPTY') {
        jarsIn = qty;
        newBalance = Math.max(0, client.emptyJarsHeld - qty);
      } else if (type === 'DELIVERED_FULL') {
        jarsOut = qty;
        newBalance = client.emptyJarsHeld + qty;
      } else if (type === 'DAMAGED_LOST') {
        newBalance = Math.max(0, client.emptyJarsHeld - qty);
      }

      await tx.client.update({
        where: { id: clientId },
        data: { emptyJarsHeld: newBalance },
      });

      const transaction = await tx.jarTransaction.create({
        data: {
          clientId,
          date: new Date(),
          transactionType: type || 'COLLECTED_EMPTY',
          jarsOut,
          jarsIn,
          netChange: jarsOut - jarsIn,
          balanceAfter: newBalance,
          notes: notes || `Direct manual adjustment: ${type} ${qty} jars`,
        },
      });

      return { clientBalance: newBalance, transaction };
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});
