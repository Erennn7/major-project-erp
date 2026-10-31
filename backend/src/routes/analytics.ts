import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken, requireRoles } from '../middleware/auth';

export const analyticsRouter = Router();

// Financial Analytics is restricted strictly to ADMIN & ACCOUNTANT
analyticsRouter.use(authenticateToken, requireRoles('ADMIN', 'ACCOUNTANT'));

analyticsRouter.get('/summary', async (req, res) => {
  try {
    const [orders, expenses, clients, batches, products, deliveries] = await Promise.all([
      prisma.order.findMany({
        select: {
          id: true,
          totalAmount: true,
          totalCost: true,
          grossProfit: true,
          orderDate: true,
          paymentStatus: true,
          paidAmount: true,
          clientId: true,
          client: {
            select: {
              name: true,
              emptyJarsHeld: true,
              currentBalance: true,
            },
          },
          items: {
            select: {
              productId: true,
              totalPrice: true,
              quantity: true,
              profit: true,
            },
          },
        },
        orderBy: { orderDate: 'desc' },
      }),
      prisma.expense.findMany({
        select: {
          id: true,
          amount: true,
          category: true,
          date: true,
        },
      }),
      prisma.client.findMany({
        select: {
          id: true,
          currentBalance: true,
          emptyJarsHeld: true,
        },
      }),
      prisma.batch.findMany({
        select: {
          id: true,
          quantityRemaining: true,
          landedCostPerUnit: true,
        },
      }),
      prisma.product.findMany({
        select: {
          id: true,
          category: true,
          currentStock: true,
        },
      }),
      prisma.delivery.findMany({
        select: {
          id: true,
          status: true,
        },
      }),
    ]);

    // Financial totals
    const totalRevenue = orders.reduce((acc, o) => acc + o.totalAmount, 0);
    const totalCOGS = orders.reduce((acc, o) => acc + o.totalCost, 0);
    const grossProfit = totalRevenue - totalCOGS;
    const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    const totalOperatingExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
    const netProfit = grossProfit - totalOperatingExpenses;
    const netMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Receivables (Unpaid dues from hotels)
    const totalReceivables = clients.reduce((acc, c) => acc + Math.max(0, c.currentBalance), 0);
    const overdueOrdersCount = orders.filter((o) => o.paymentStatus === 'OVERDUE' || (o.paymentStatus === 'PENDING' && o.paidAmount < o.totalAmount)).length;

    // Jars statistics
    const totalJarsWithClients = clients.reduce((acc, c) => acc + (c.emptyJarsHeld || 0), 0);
    const jarProduct = products.find((p) => p.category === 'JAR_20L');
    const jarsInDepotStock = jarProduct ? jarProduct.currentStock : 0;

    // Delivery metrics
    const deliveredCount = deliveries.filter((d) => d.status === 'DELIVERED').length;
    const outForDeliveryCount = deliveries.filter((d) => d.status === 'OUT_FOR_DELIVERY').length;
    const scheduledCount = deliveries.filter((d) => d.status === 'SCHEDULED').length;

    // Inventory value
    const totalInventoryValue = batches.reduce((acc, b) => acc + b.quantityRemaining * b.landedCostPerUnit, 0);

    // Sales by client (Top Hotels)
    const clientSalesMap: Record<string, { id: string; name: string; revenue: number; ordersCount: number; emptyJars: number; balance: number }> = {};
    for (const order of orders) {
      if (!clientSalesMap[order.clientId]) {
        clientSalesMap[order.clientId] = {
          id: order.clientId,
          name: order.client.name,
          revenue: 0,
          ordersCount: 0,
          emptyJars: order.client.emptyJarsHeld,
          balance: order.client.currentBalance,
        };
      }
      clientSalesMap[order.clientId].revenue += order.totalAmount;
      clientSalesMap[order.clientId].ordersCount += 1;
    }

    const topClients = Object.values(clientSalesMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Category breakdown
    const categoryRevenueMap: Record<string, { category: string; revenue: number; volume: number; profit: number }> = {};
    for (const order of orders) {
      for (const item of order.items) {
        const prod = products.find((p) => p.id === item.productId);
        const cat = prod?.category || 'OTHER';
        if (!categoryRevenueMap[cat]) {
          categoryRevenueMap[cat] = { category: cat, revenue: 0, volume: 0, profit: 0 };
        }
        categoryRevenueMap[cat].revenue += item.totalPrice;
        categoryRevenueMap[cat].volume += item.quantity;
        categoryRevenueMap[cat].profit += item.profit;
      }
    }

    // Expense breakdown by category
    const expenseCategoryMap: Record<string, number> = {};
    for (const exp of expenses) {
      expenseCategoryMap[exp.category] = (expenseCategoryMap[exp.category] || 0) + exp.amount;
    }

    // Daily/Weekly Financial trend (Revenue vs Cost vs Profit)
    const trendMap: Record<string, { date: string; revenue: number; cogs: number; profit: number; expenses: number }> = {};
    for (const o of orders) {
      const d = o.orderDate.toISOString().split('T')[0];
      if (!trendMap[d]) {
        trendMap[d] = { date: d, revenue: 0, cogs: 0, profit: 0, expenses: 0 };
      }
      trendMap[d].revenue += o.totalAmount;
      trendMap[d].cogs += o.totalCost;
      trendMap[d].profit += o.grossProfit;
    }

    for (const e of expenses) {
      const d = e.date.toISOString().split('T')[0];
      if (!trendMap[d]) {
        trendMap[d] = { date: d, revenue: 0, cogs: 0, profit: 0, expenses: 0 };
      }
      trendMap[d].expenses += e.amount;
    }

    const trend = Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      success: true,
      data: {
        financials: {
          totalRevenue,
          totalCOGS,
          grossProfit,
          grossMarginPct: Number(grossMarginPct.toFixed(2)),
          totalOperatingExpenses,
          netProfit,
          netMarginPct: Number(netMarginPct.toFixed(2)),
          totalReceivables,
          totalInventoryValue,
        },
        operations: {
          totalClients: clients.length,
          totalOrders: orders.length,
          overdueOrdersCount,
          totalJarsWithClients,
          jarsInDepotStock,
          deliveries: {
            delivered: deliveredCount,
            outForDelivery: outForDeliveryCount,
            scheduled: scheduledCount,
            total: deliveries.length,
          },
        },
        topClients,
        categoryBreakdown: Object.values(categoryRevenueMap),
        expenseCategoryBreakdown: expenseCategoryMap,
        trend,
      },
    });
  } catch (error: any) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
