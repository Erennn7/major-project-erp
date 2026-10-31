import { Router } from 'express';
import { prisma } from '../prisma';
import { invalidateBootstrapCache } from './bootstrap';
import { authenticateToken, requireRoles } from '../middleware/auth';

export const deliveriesRouter = Router();

// Base auth
deliveriesRouter.use(authenticateToken);

// GET all deliveries with filters (ADMIN, DISPATCHER, SALES)
deliveriesRouter.get('/', requireRoles('ADMIN', 'DISPATCHER', 'SALES'), async (req, res) => {
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
      take: 100,
    });

    res.json({ success: true, data: deliveries });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single delivery (ADMIN, DISPATCHER, SALES)
deliveriesRouter.get('/:id', requireRoles('ADMIN', 'DISPATCHER', 'SALES'), async (req, res) => {
  try {
    const id = req.params.id as string;
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

// PUT update delivery status (ADMIN & DISPATCHER only)
deliveriesRouter.put('/:id/status', requireRoles('ADMIN', 'DISPATCHER'), async (req, res) => {
  try {
    const id = req.params.id as string;
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
      return res.status(404).json({ success: false, error: 'Delivery challan not found.' });
    }

    if (existing.status === 'CANCELLED' && status !== 'CANCELLED') {
      return res.status(400).json({ success: false, error: 'Cannot modify or deliver a cancelled delivery challan.' });
    }

    const collectedCount = emptyJarsCollected !== undefined
      ? Math.max(0, Number(emptyJarsCollected))
      : existing.emptyJarsCollected;
    const damagedCount = emptyJarsDamaged !== undefined
      ? Math.max(0, Number(emptyJarsDamaged))
      : existing.emptyJarsDamaged;
    const deliveredCount = emptyJarsDelivered !== undefined
      ? Math.max(0, Number(emptyJarsDelivered))
      : existing.emptyJarsDelivered;

    if (damagedCount > collectedCount) {
      return res.status(400).json({
        success: false,
        error: `Damaged jars (${damagedCount}) cannot exceed total jars collected (${collectedCount}).`,
      });
    }

    const deliveryUpdate: any = {
      ...(status && { status }),
      ...(notes !== undefined && { notes: notes ? notes.trim() : null }),
      ...(driverName && { driverName: driverName.trim() }),
      ...(vehicleNumber && { vehicleNumber: vehicleNumber.trim() }),
      emptyJarsDelivered: deliveredCount,
      emptyJarsCollected: collectedCount,
      emptyJarsDamaged: damagedCount,
    };

    // Fast-path: If marking OUT_FOR_DELIVERY, SCHEDULED, or CANCELLED, no jar accounting needed
    if (status !== 'DELIVERED') {
      const updated = await prisma.delivery.update({
        where: { id },
        data: deliveryUpdate,
        include: { client: true },
      });
      invalidateBootstrapCache();
      return res.json({ success: true, data: updated });
    }

    // DELIVERED status requires receiver sign-off & jar transaction update
    const finalRecipient = recipientName?.trim() || existing.recipientName;
    if (!finalRecipient) {
      return res.status(400).json({ success: false, error: 'Recipient receiver name is required to confirm delivery.' });
    }

    deliveryUpdate.deliveredDate = deliveredDate ? new Date(deliveredDate) : new Date();
    deliveryUpdate.recipientName = finalRecipient;
    if (recipientPhone) deliveryUpdate.recipientPhone = recipientPhone.trim();

    const updated = await prisma.$transaction(async (tx) => {
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

      return tx.delivery.update({
        where: { id },
        data: deliveryUpdate,
        include: { client: true },
      });
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    invalidateBootstrapCache();
    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Delivery status update error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});
