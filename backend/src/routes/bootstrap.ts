import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';

export const bootstrapRouter = Router();

// In-memory micro-cache (5 second TTL) keyed by user role
const roleCache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL_MS = 5000;

export function invalidateBootstrapCache() {
  for (const key of Object.keys(roleCache)) {
    delete roleCache[key];
  }
}

bootstrapRouter.get('/', authenticateToken, async (req, res) => {
  try {
    const role = req.user?.role || 'ADMIN';
    const now = Date.now();
    if (roleCache[role] && now - roleCache[role].timestamp < CACHE_TTL_MS) {
      return res.json({ success: true, data: roleCache[role].data, cached: true });
    }

    // Execute queries in parallel using warm backend connections
    const [orders, deliveries, clients, products, batches, expenses] = await Promise.all([
      prisma.order.findMany({
        include: {
          client: {
            select: { id: true, name: true, phone: true, address: true, emptyJarsHeld: true, currentBalance: true },
          },
          items: {
            include: {
              product: {
                select: { id: true, name: true, category: true, unit: true },
              },
            },
          },
        },
        orderBy: { orderDate: 'desc' },
        take: 100,
      }),
      prisma.delivery.findMany({
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
      }),
      prisma.client.findMany({
        orderBy: { name: 'asc' },
      }),
      prisma.product.findMany({
        orderBy: { name: 'asc' },
      }),
      prisma.batch.findMany({
        include: { product: true },
        orderBy: { purchaseDate: 'desc' },
      }),
      prisma.expense.findMany({
        select: { id: true, amount: true, category: true, date: true },
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

    // Receivables
    const totalReceivables = clients.reduce((acc, c) => acc + Math.max(0, c.currentBalance), 0);
    const overdueOrdersCount = orders.filter(
      (o) => o.paymentStatus === 'OVERDUE' || (o.paymentStatus === 'PENDING' && o.paidAmount < o.totalAmount)
    ).length;

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
          name: order.client?.name || 'Client',
          revenue: 0,
          ordersCount: 0,
          emptyJars: order.client?.emptyJarsHeld || 0,
          balance: order.client?.currentBalance || 0,
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

    // Trend
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

    // Role-tailored filtering
    let tailoredAnalytics: any = null;
    let tailoredBatches = batches;
    let tailoredClients = clients;
    let tailoredOrders = orders;

    if (role === 'DISPATCHER') {
      // Dispatcher: Only operational statistics (jars, deliveries, depot stock). No margins, P&L, or financial ledger.
      tailoredAnalytics = {
        financials: {
          totalRevenue: 0,
          totalCOGS: 0,
          grossProfit: 0,
          grossMarginPct: 0,
          totalOperatingExpenses: 0,
          netProfit: 0,
          netMarginPct: 0,
          totalReceivables: 0,
          totalInventoryValue: 0,
        },
        operations: {
          totalClients: clients.length,
          totalOrders: orders.length,
          overdueOrdersCount: 0,
          totalJarsWithClients,
          jarsInDepotStock,
          deliveries: {
            delivered: deliveredCount,
            outForDelivery: outForDeliveryCount,
            scheduled: scheduledCount,
            total: deliveries.length,
          },
        },
        topClients: topClients.map((c) => ({
          id: c.id,
          name: c.name,
          revenue: 0,
          ordersCount: c.ordersCount,
          emptyJars: c.emptyJars,
          balance: 0,
        })),
        categoryBreakdown: Object.values(categoryRevenueMap).map((cat) => ({
          category: cat.category,
          revenue: 0,
          volume: cat.volume,
          profit: 0,
        })),
        expenseCategoryBreakdown: {},
        trend: [],
      };

      // Disallow unit landed costs from batches
      tailoredBatches = batches.map((b) => ({
        ...b,
        purchaseCostPerUnit: 0,
        transportCostTotal: 0,
        totalCost: 0,
        landedCostPerUnit: 0,
      }));

      // Hide client financial dues
      tailoredClients = clients.map((c) => ({
        ...c,
        currentBalance: 0,
        creditLimit: 0,
      }));

      // Hide order costs and profit margins
      tailoredOrders = orders.map((o) => ({
        ...o,
        totalCost: 0,
        grossProfit: 0,
        grossMarginPct: 0,
        items: o.items.map((it) => ({
          ...it,
          costPricePerUnit: 0,
          profit: 0,
        })),
      }));
    } else if (role === 'SALES') {
      // Sales: Revenue & receivables visible, but company overheads and net margin confidential
      tailoredAnalytics = {
        financials: {
          totalRevenue,
          totalCOGS: 0,
          grossProfit: 0,
          grossMarginPct: 0,
          totalOperatingExpenses: 0,
          netProfit: 0,
          netMarginPct: 0,
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
        categoryBreakdown: Object.values(categoryRevenueMap).map((cat) => ({
          category: cat.category,
          revenue: cat.revenue,
          volume: cat.volume,
          profit: 0,
        })),
        expenseCategoryBreakdown: {},
        trend: trend.map((t) => ({
          date: t.date,
          revenue: t.revenue,
          cogs: 0,
          profit: 0,
          expenses: 0,
        })),
      };

      // Sales does not manage batches
      tailoredBatches = [];

      // Sales sees invoice totals, but not factory cost margins
      tailoredOrders = orders.map((o) => ({
        ...o,
        totalCost: 0,
        grossProfit: 0,
        grossMarginPct: 0,
        items: o.items.map((it) => ({
          ...it,
          costPricePerUnit: 0,
          profit: 0,
        })),
      }));
    } else {
      // ADMIN & ACCOUNTANT: Full access
      tailoredAnalytics = {
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
      };
    }

    const payload = {
      analytics: tailoredAnalytics,
      deliveries,
      orders: tailoredOrders,
      clients: tailoredClients,
      products,
      batches: tailoredBatches,
    };

    roleCache[role] = { data: payload, timestamp: Date.now() };

    res.json({ success: true, data: payload, cached: false });
  } catch (error: any) {
    console.error('Bootstrap error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
