import { Router } from 'express';
import { prisma } from '../prisma';

export const expensesRouter = Router();

// GET all expenses
expensesRouter.get('/', async (req, res) => {
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

// POST new expense
expensesRouter.post('/', async (req, res) => {
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

    const expenseNumber = `EXP-${Date.now().toString().slice(-6)}`;

    const expense = await prisma.expense.create({
      data: {
        expenseNumber,
        date: date ? new Date(date) : new Date(),
        category: category || 'MISC',
        amount: Number(amount) || 0,
        paymentMethod: paymentMethod || 'UPI',
        paidTo: paidTo || 'Vendor',
        vehicleNumber: vehicleNumber || null,
        description: description || 'Operational expense',
        notes: notes || null,
      },
    });

    res.status(201).json({ success: true, data: expense });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE expense
expensesRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.expense.delete({ where: { id } });
    res.json({ success: true, message: 'Expense deleted' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});
