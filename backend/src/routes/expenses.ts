import { Router } from 'express';
import { prisma } from '../prisma';
import { invalidateBootstrapCache } from './bootstrap';
import { authenticateToken, requireRoles } from '../middleware/auth';

export const expensesRouter = Router();

// Base auth for all expense endpoints
expensesRouter.use(authenticateToken);

// GET all expenses (ADMIN & ACCOUNTANT)
expensesRouter.get('/', requireRoles('ADMIN', 'ACCOUNTANT'), async (req, res) => {
  try {
    const { category } = req.query;
    const where: any = {};
    if (category && category !== 'ALL') {
      where.category = String(category);
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    const totalAmount = expenses.reduce((acc, e) => acc + e.amount, 0);

    res.json({ success: true, data: expenses, totalAmount });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST new expense (ADMIN & ACCOUNTANT)
expensesRouter.post('/', requireRoles('ADMIN', 'ACCOUNTANT'), async (req, res) => {
  try {
    const {
      date,
      category,
      amount,
      paymentMethod,
      paidTo,
      vehicleNumber,
      description,
      notes,
    } = req.body;

    const expAmount = Number(amount);
    if (!expAmount || expAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Expense amount must be greater than zero.' });
    }

    const expenseNumber = `EXP-${Date.now().toString().slice(-6)}`;

    const expense = await prisma.expense.create({
      data: {
        expenseNumber,
        date: date ? new Date(date) : new Date(),
        category: category || 'MISC',
        amount: expAmount,
        paymentMethod: paymentMethod || 'UPI',
        paidTo: paidTo?.trim() || 'Vendor',
        vehicleNumber: vehicleNumber?.trim() || null,
        description: description?.trim() || 'Operational expense',
        notes: notes?.trim() || null,
      },
    });

    invalidateBootstrapCache();
    res.status(201).json({ success: true, data: expense });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE expense (strictly ADMIN)
expensesRouter.delete('/:id', requireRoles('ADMIN'), async (req, res) => {
  try {
    const id = req.params.id as string;
    await prisma.expense.delete({ where: { id } });
    invalidateBootstrapCache();
    res.json({ success: true, message: 'Expense deleted' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

