import { Router } from 'express';
import { prisma } from '../prisma';

export const deliveriesRouter = Router();

// GET all deliveries with filters
deliveriesRouter.get('/', async (req, res) => {
  try {
    const { status, clientId, date } = req.query;

    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = String(status);
    }
    if (clientId) {
      where.clientId = String(clientId);
    }

    const deliveries = await prisma.delivery.findMany({
      where,
      include: {
        client: true,
        order: {
          include: {
            items: {
              include: { product: true },
            },
          },
        },
      },
      orderBy: { scheduledDate: 'desc' },
    });

    res.json({ success: true, data: deliveries });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single delivery
deliveriesRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: {
        client: true,
        order: {
          include: {
            items: {
              include: { product: true, batch: true },
            },
          },
        },
        jarTransaction: true,
      },
    });

    if (!delivery) {
      return res.status(404).json({ success: false, error: 'Delivery not found' });
    }

    res.json({ success: true, data: delivery });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update delivery status (SCHEDULED -> OUT_FOR_DELIVERY -> DELIVERED)
deliveriesRouter.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      deliveredDate,
      recipientName,
      recipientPhone,
      notes,
      emptyJarsDelivered,
      emptyJarsCollected,
      emptyJarsDamaged,
      driverName,
      vehicleNumber,
    } = req.body;

    const existing = await prisma.delivery.findUnique({
      where: { id },
      include: { client: true },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Delivery not found' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const deliveredCount = emptyJarsDelivered !== undefined ? Number(emptyJarsDelivered) : existing.emptyJarsDelivered;
      const collectedCount = emptyJarsCollected !== undefined ? Number(emptyJarsCollected) : existing.emptyJarsCollected;
      const damagedCount = emptyJarsDamaged !== undefined ? Number(emptyJarsDamaged) : existing.emptyJarsDamaged;

      const deliveryUpdate: any = {
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
        ...(driverName && { driverName }),
        ...(vehicleNumber && { vehicleNumber }),
        emptyJarsDelivered: deliveredCount,
        emptyJarsCollected: collectedCount,
        emptyJarsDamaged: damagedCount,
      };

      if (status === 'DELIVERED') {
        deliveryUpdate.deliveredDate = deliveredDate ? new Date(deliveredDate) : new Date();
        if (recipientName) deliveryUpdate.recipientName = recipientName;
        if (recipientPhone) deliveryUpdate.recipientPhone = recipientPhone;

        // If newly marked DELIVERED and wasn't already delivered
        if (existing.status !== 'DELIVERED') {
          const netJarChange = deliveredCount - collectedCount;
          const newClientJarBalance = Math.max(0, existing.client.emptyJarsHeld + netJarChange);

          // Update client jar count
          await tx.client.update({
            where: { id: existing.clientId },
            data: { emptyJarsHeld: newClientJarBalance },
          });

          // Create Jar transaction
          await tx.jarTransaction.create({
            data: {
              clientId: existing.clientId,
              deliveryId: existing.id,
              date: deliveryUpdate.deliveredDate,
              transactionType: 'DELIVERED_FULL',
              jarsOut: deliveredCount,
              jarsIn: collectedCount,
              netChange: netJarChange,
              balanceAfter: newClientJarBalance,
              notes: `Delivery ${existing.challanNumber}: Delivered ${deliveredCount} jars, collected ${collectedCount} empty cans (${damagedCount} damaged).`,
            },
          });
        }
      }

      return tx.delivery.update({
        where: { id },
        data: deliveryUpdate,
        include: { client: true, order: true },
      });
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Delivery status update error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});
