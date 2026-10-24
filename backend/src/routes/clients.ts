import { Router } from 'express';
import { prisma } from '../prisma';

export const clientsRouter = Router();

// GET all clients
clientsRouter.get('/', async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      include: {
        _count: {
          select: { orders: true, deliveries: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: clients });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single client by ID with deep order and jar history
clientsRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        orders: {
          include: {
            items: { include: { product: true } },
            delivery: true,
          },
          orderBy: { orderDate: 'desc' },
        },
        deliveries: {
          orderBy: { scheduledDate: 'desc' },
        },
        jarTransactions: {
          orderBy: { date: 'desc' },
          take: 20,
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    res.json({ success: true, data: client });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST new client
clientsRouter.post('/', async (req, res) => {
  try {
    const {
      name,
      clientType,
      contactPerson,
      phone,
      email,
      address,
      deliveryZone,
      paymentTerms,
      creditLimit,
      notes,
    } = req.body;

    const client = await prisma.client.create({
      data: {
        name,
        clientType: clientType || 'HOTEL',
        contactPerson: contactPerson || 'F&B Manager',
        phone,
        email: email || null,
        address,
        deliveryZone: deliveryZone || 'General Zone',
        paymentTerms: paymentTerms || 'DAYS_15',
        creditLimit: Number(creditLimit) || 50000,
        currentBalance: 0,
        emptyJarsHeld: 0,
        notes: notes || null,
      },
    });

    res.status(201).json({ success: true, data: client });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// PUT update client
clientsRouter.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      clientType,
      contactPerson,
      phone,
      email,
      address,
      deliveryZone,
      paymentTerms,
      creditLimit,
      notes,
    } = req.body;

    const client = await prisma.client.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(clientType && { clientType }),
        ...(contactPerson && { contactPerson }),
        ...(phone && { phone }),
        ...(email !== undefined && { email }),
        ...(address && { address }),
        ...(deliveryZone !== undefined && { deliveryZone }),
        ...(paymentTerms && { paymentTerms }),
        ...(creditLimit !== undefined && { creditLimit: Number(creditLimit) }),
        ...(notes !== undefined && { notes }),
      },
    });

    res.json({ success: true, data: client });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE client
clientsRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.client.delete({ where: { id } });
    res.json({ success: true, message: 'Client deleted' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});
