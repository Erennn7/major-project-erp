import { Router } from 'express';
import { prisma } from '../prisma';
import { invalidateBootstrapCache } from './bootstrap';
import { authenticateToken, requireRoles } from '../middleware/auth';

export const clientsRouter = Router();

// Base auth
clientsRouter.use(authenticateToken);

// GET all clients (All authenticated roles)
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

    if (req.user?.role === 'DISPATCHER') {
      const sanitized = clients.map((c) => ({
        ...c,
        currentBalance: 0,
        creditLimit: 0,
      }));
      return res.json({ success: true, data: sanitized });
    }

    res.json({ success: true, data: clients });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single client by ID with deep order and jar history
clientsRouter.get('/:id', async (req, res) => {
  try {
    const id = req.params.id as string;
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

    if (req.user?.role === 'DISPATCHER') {
      const sanitized = {
        ...client,
        currentBalance: 0,
        creditLimit: 0,
        payments: [],
      };
      return res.json({ success: true, data: sanitized });
    }

    res.json({ success: true, data: client });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST new client (ADMIN & SALES)
clientsRouter.post('/', requireRoles('ADMIN', 'SALES'), async (req, res) => {
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

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Client / Hotel name is required.' });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, error: 'Contact phone number is required.' });
    }

    const limit = Number(creditLimit);
    if (isNaN(limit) || limit < 0) {
      return res.status(400).json({ success: false, error: 'Credit limit cannot be negative.' });
    }

    const client = await prisma.client.create({
      data: {
        name: name.trim(),
        clientType: clientType || 'HOTEL',
        contactPerson: contactPerson?.trim() || 'F&B Manager',
        phone: phone.trim(),
        email: email?.trim() || null,
        address: address?.trim() || 'Main Campus / Premises',
        deliveryZone: deliveryZone?.trim() || 'General Zone',
        paymentTerms: paymentTerms || 'DAYS_15',
        creditLimit: limit,
        currentBalance: 0,
        emptyJarsHeld: 0,
        notes: notes?.trim() || null,
      },
    });

    invalidateBootstrapCache();
    res.status(201).json({ success: true, data: client });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// PUT update client (ADMIN & SALES)
clientsRouter.put('/:id', requireRoles('ADMIN', 'SALES'), async (req, res) => {
  try {
    const id = req.params.id as string;
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
        ...(name && { name: name.trim() }),
        ...(clientType && { clientType }),
        ...(contactPerson && { contactPerson: contactPerson.trim() }),
        ...(phone && { phone: phone.trim() }),
        ...(email !== undefined && { email: email ? email.trim() : null }),
        ...(address && { address: address.trim() }),
        ...(deliveryZone !== undefined && { deliveryZone: deliveryZone ? deliveryZone.trim() : null }),
        ...(paymentTerms && { paymentTerms }),
        ...(creditLimit !== undefined && { creditLimit: Math.max(0, Number(creditLimit)) }),
        ...(notes !== undefined && { notes: notes ? notes.trim() : null }),
      },
    });

    invalidateBootstrapCache();
    res.json({ success: true, data: client });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE client (strictly ADMIN)
clientsRouter.delete('/:id', requireRoles('ADMIN'), async (req, res) => {
  try {
    const id = req.params.id as string;
    await prisma.client.delete({ where: { id } });
    invalidateBootstrapCache();
    res.json({ success: true, message: 'Client deleted' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

