import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Water Distributor database...');

  // Clean old data in safe sequence
  await prisma.payment.deleteMany();
  await prisma.jarTransaction.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.client.deleteMany();
  await prisma.product.deleteMany();

  // 1. Create Products
  const p1 = await prisma.product.create({
    data: {
      name: '20L Packaged Drinking Water Jar',
      sku: 'WTR-20L-JAR',
      category: 'JAR_20L',
      unit: 'Jar',
      defaultPrice: 80.0,
      defaultCost: 32.0,
      isReturnable: true,
      depositAmount: 150.0,
      currentStock: 480,
      minStockAlert: 100,
    },
  });

  const p2 = await prisma.product.create({
    data: {
      name: '1L Bottled Mineral Water (Pack of 12)',
      sku: 'WTR-1L-PK12',
      category: 'BOTTLE_1L',
      unit: 'Box',
      defaultPrice: 210.0,
      defaultCost: 120.0,
      isReturnable: false,
      depositAmount: 0.0,
      currentStock: 220,
      minStockAlert: 50,
    },
  });

  const p3 = await prisma.product.create({
    data: {
      name: '500ml Bottled Mineral Water (Pack of 24)',
      sku: 'WTR-500ML-PK24',
      category: 'BOTTLE_500ML',
      unit: 'Box',
      defaultPrice: 240.0,
      defaultCost: 135.0,
      isReturnable: false,
      depositAmount: 0.0,
      currentStock: 185,
      minStockAlert: 40,
    },
  });

  const p4 = await prisma.product.create({
    data: {
      name: '250ml Water Cup Glasses (Box of 48)',
      sku: 'WTR-250ML-CUP48',
      category: 'CUP_250ML',
      unit: 'Box',
      defaultPrice: 190.0,
      defaultCost: 105.0,
      isReturnable: false,
      depositAmount: 0.0,
      currentStock: 140,
      minStockAlert: 30,
    },
  });

  const p5 = await prisma.product.create({
    data: {
      name: 'Tabletop Manual Water Dispenser Pump',
      sku: 'ACC-PUMP-MANUAL',
      category: 'DISPENSER',
      unit: 'Unit',
      defaultPrice: 350.0,
      defaultCost: 180.0,
      isReturnable: false,
      depositAmount: 0.0,
      currentStock: 35,
      minStockAlert: 10,
    },
  });

  // 2. Create Batches (Procurement from Bottling Plants)
  const b1 = await prisma.batch.create({
    data: {
      batchNumber: 'BATCH-2026-OCT-A1',
      productId: p1.id,
      supplierName: 'BluePeak Bottling Works Plant #2',
      purchaseDate: new Date('2026-10-01'),
      mfgDate: new Date('2026-09-30'),
      expiryDate: new Date('2026-11-30'),
      quantityReceived: 600,
      quantityRemaining: 180,
      purchaseCostPerUnit: 30.0,
      transportCostTotal: 1200.0,
      totalCost: 19200.0,
      landedCostPerUnit: 32.0,
      notes: 'Initial October delivery. 100% lab certified TDS 45ppm.',
    },
  });

  const b2 = await prisma.batch.create({
    data: {
      batchNumber: 'BATCH-2026-OCT-A2',
      productId: p1.id,
      supplierName: 'BluePeak Bottling Works Plant #2',
      purchaseDate: new Date('2026-10-15'),
      mfgDate: new Date('2026-10-14'),
      expiryDate: new Date('2026-12-15'),
      quantityReceived: 500,
      quantityRemaining: 300,
      purchaseCostPerUnit: 31.0,
      transportCostTotal: 1000.0,
      totalCost: 16500.0,
      landedCostPerUnit: 33.0,
      notes: 'Mid-month replenishment batch.',
    },
  });

  const b3 = await prisma.batch.create({
    data: {
      batchNumber: 'BATCH-2026-OCT-B1',
      productId: p2.id,
      supplierName: 'Aquaflow Springs Ltd',
      purchaseDate: new Date('2026-10-05'),
      mfgDate: new Date('2026-10-03'),
      expiryDate: new Date('2027-04-03'),
      quantityReceived: 350,
      quantityRemaining: 220,
      purchaseCostPerUnit: 115.0,
      transportCostTotal: 1750.0,
      totalCost: 42000.0,
      landedCostPerUnit: 120.0,
      notes: 'Standard 1L bottles box of 12.',
    },
  });

  const b4 = await prisma.batch.create({
    data: {
      batchNumber: 'BATCH-2026-OCT-C1',
      productId: p3.id,
      supplierName: 'Aquaflow Springs Ltd',
      purchaseDate: new Date('2026-10-08'),
      mfgDate: new Date('2026-10-06'),
      expiryDate: new Date('2027-04-06'),
      quantityReceived: 250,
      quantityRemaining: 185,
      purchaseCostPerUnit: 130.0,
      transportCostTotal: 1250.0,
      totalCost: 33750.0,
      landedCostPerUnit: 135.0,
      notes: '500ml catering cases.',
    },
  });

  // 3. Create Clients (Hotels, Resorts, Banquets)
  const c1 = await prisma.client.create({
    data: {
      name: 'Grand Hyatt Regency Hotel',
      clientType: 'HOTEL',
      contactPerson: 'Vikram Singhania (F&B Director)',
      phone: '+91 98220 11223',
      email: 'fb.desk@grandhyatt.local',
      address: 'Plot 44, Airport Approach Highway, South Zone',
      deliveryZone: 'South Ring Road',
      paymentTerms: 'DAYS_15',
      creditLimit: 75000.0,
      currentBalance: 16800.0,
      emptyJarsHeld: 85,
      notes: 'Daily morning delivery at 7:30 AM via Loading Bay 3.',
    },
  });

  const c2 = await prisma.client.create({
    data: {
      name: 'Royal Orchid Suites & Banquets',
      clientType: 'HOTEL',
      contactPerson: 'Sneha Roy (Procurement Mgr)',
      phone: '+91 98901 44556',
      email: 'purchase@royalorchidsuites.local',
      address: 'Sector 9, Cyber City Hub',
      deliveryZone: 'Tech Corridor',
      paymentTerms: 'DAYS_30',
      creditLimit: 100000.0,
      currentBalance: 32400.0,
      emptyJarsHeld: 140,
      notes: 'High volume for conference halls and guest rooms.',
    },
  });

  const c3 = await prisma.client.create({
    data: {
      name: 'Saffron Spice Fine Dining Restaurant',
      clientType: 'RESTAURANT',
      contactPerson: 'Chef Anil Patil',
      phone: '+91 97654 32109',
      email: 'anil@saffronspice.local',
      address: '12 Heritage Plaza, MG Road',
      deliveryZone: 'Central Downtown',
      paymentTerms: 'DAYS_7',
      creditLimit: 30000.0,
      currentBalance: 4800.0,
      emptyJarsHeld: 32,
      notes: 'Delivers 20L jars + 1L boxed bottles twice a week.',
    },
  });

  const c4 = await prisma.client.create({
    data: {
      name: 'Green Palms Banquet & Convention Lawn',
      clientType: 'EVENT_BANQUET',
      contactPerson: 'Rajesh Mehta (Ops Manager)',
      phone: '+91 94223 88990',
      email: 'ops@greenpalmslawn.local',
      address: 'Eastern Bypass, Near Golf Course',
      deliveryZone: 'East Bypass',
      paymentTerms: 'IMMEDIATE_CASH',
      creditLimit: 25000.0,
      currentBalance: 0.0,
      emptyJarsHeld: 45,
      notes: 'Requires 250ml cups + 20L dispensers for weekend weddings.',
    },
  });

  const c5 = await prisma.client.create({
    data: {
      name: 'Novotel Lakeside Resort',
      clientType: 'RESORT',
      contactPerson: 'Pooja Sharma (Stores Incharge)',
      phone: '+91 98112 55667',
      email: 'stores@novotellakeside.local',
      address: 'Lakeside Boulevard, West Hills',
      deliveryZone: 'West Hills',
      paymentTerms: 'DAYS_30',
      creditLimit: 80000.0,
      currentBalance: 24200.0,
      emptyJarsHeld: 95,
      notes: 'Requires delivery twice weekly on Tuesdays and Fridays.',
    },
  });

  // 4. Create Completed & Active Orders with accurate COGS and Profit
  // Order 1: Grand Hyatt
  const ord1 = await prisma.order.create({
    data: {
      invoiceNumber: 'INV-2026-1001',
      clientId: c1.id,
      orderDate: new Date('2026-10-18T08:00:00Z'),
      subtotal: 10600.0,
      taxAmount: 0.0,
      discountAmount: 0.0,
      totalAmount: 10600.0,
      totalCost: 4640.0,
      grossProfit: 5960.0,
      grossMarginPct: 56.23,
      paymentStatus: 'PAID',
      paidAmount: 10600.0,
      paymentMethod: 'BANK_TRANSFER',
      notes: 'Weekly standard delivery',
      items: {
        create: [
          {
            productId: p1.id,
            batchId: b1.id,
            quantity: 80,
            unitPrice: 80.0,
            unitCost: 32.0,
            totalPrice: 6400.0,
            totalCost: 2560.0,
            profit: 3840.0,
          },
          {
            productId: p2.id,
            batchId: b3.id,
            quantity: 20,
            unitPrice: 210.0,
            unitCost: 120.0,
            totalPrice: 4200.0,
            totalCost: 2400.0,
            profit: 1800.0,
          },
        ],
      },
    },
  });

  // Delivery 1 for Order 1 (Delivered)
  const del1 = await prisma.delivery.create({
    data: {
      challanNumber: 'DC-2026-0081',
      orderId: ord1.id,
      clientId: c1.id,
      scheduledDate: new Date('2026-10-18T08:00:00Z'),
      deliveredDate: new Date('2026-10-18T09:15:00Z'),
      status: 'DELIVERED',
      driverName: 'Ramesh Pawar',
      driverPhone: '+91 99221 00334',
      vehicleNumber: 'MH-12-PQ-4521 (Tata 407)',
      deliveryAddress: c1.address,
      recipientName: 'Manoj (Store Receiving Asst)',
      recipientPhone: '+91 98220 11224',
      notes: 'Delivered in good condition. All security seals verified.',
      emptyJarsDelivered: 80,
      emptyJarsCollected: 76,
      emptyJarsDamaged: 1,
    },
  });

  await prisma.jarTransaction.create({
    data: {
      clientId: c1.id,
      deliveryId: del1.id,
      date: new Date('2026-10-18T09:15:00Z'),
      transactionType: 'DELIVERED_FULL',
      jarsOut: 80,
      jarsIn: 76,
      netChange: 4,
      balanceAfter: 85,
      notes: '80 full jars given, 76 empty jars received, 1 broken jar accounted',
    },
  });

  await prisma.payment.create({
    data: {
      orderId: ord1.id,
      clientId: c1.id,
      amount: 10600.0,
      paymentDate: new Date('2026-10-19T11:00:00Z'),
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'NEFT-HDFC-9938482',
      notes: 'Full payment received against INV-2026-1001',
    },
  });

  // Order 2: Royal Orchid (Delivered, Pending Payment)
  const ord2 = await prisma.order.create({
    data: {
      invoiceNumber: 'INV-2026-1002',
      clientId: c2.id,
      orderDate: new Date('2026-10-20T09:30:00Z'),
      subtotal: 18400.0,
      taxAmount: 0.0,
      discountAmount: 0.0,
      totalAmount: 18400.0,
      totalCost: 7920.0,
      grossProfit: 10480.0,
      grossMarginPct: 56.96,
      paymentStatus: 'PENDING',
      paidAmount: 0.0,
      paymentMethod: 'CREDIT',
      notes: 'High demand for upcoming medical conference',
      items: {
        create: [
          {
            productId: p1.id,
            batchId: b2.id,
            quantity: 120,
            unitPrice: 80.0,
            unitCost: 33.0,
            totalPrice: 9600.0,
            totalCost: 3960.0,
            profit: 5640.0,
          },
          {
            productId: p2.id,
            batchId: b3.id,
            quantity: 30,
            unitPrice: 210.0,
            unitCost: 120.0,
            totalPrice: 6300.0,
            totalCost: 3600.0,
            profit: 2700.0,
          },
          {
            productId: p3.id,
            batchId: b4.id,
            quantity: 10,
            unitPrice: 250.0,
            unitCost: 135.0,
            totalPrice: 2500.0,
            totalCost: 1350.0,
            profit: 1150.0,
          },
        ],
      },
    },
  });

  const del2 = await prisma.delivery.create({
    data: {
      challanNumber: 'DC-2026-0082',
      orderId: ord2.id,
      clientId: c2.id,
      scheduledDate: new Date('2026-10-20T09:30:00Z'),
      deliveredDate: new Date('2026-10-20T11:45:00Z'),
      status: 'DELIVERED',
      driverName: 'Sunil Yadav',
      driverPhone: '+91 97665 44112',
      vehicleNumber: 'MH-14-GH-8812 (Tata Ace)',
      deliveryAddress: c2.address,
      recipientName: 'Kishore (Banquet Head)',
      recipientPhone: '+91 98901 44558',
      notes: 'Received at Banquet Dock B. Empties loaded.',
      emptyJarsDelivered: 120,
      emptyJarsCollected: 105,
      emptyJarsDamaged: 0,
    },
  });

  await prisma.jarTransaction.create({
    data: {
      clientId: c2.id,
      deliveryId: del2.id,
      date: new Date('2026-10-20T11:45:00Z'),
      transactionType: 'DELIVERED_FULL',
      jarsOut: 120,
      jarsIn: 105,
      netChange: 15,
      balanceAfter: 140,
      notes: '120 full jars delivered, 105 empties picked up',
    },
  });

  // Order 3: Saffron Spice (Delivered, Partial Payment)
  const ord3 = await prisma.order.create({
    data: {
      invoiceNumber: 'INV-2026-1003',
      clientId: c3.id,
      orderDate: new Date('2026-10-21T10:00:00Z'),
      subtotal: 5800.0,
      taxAmount: 0.0,
      discountAmount: 0.0,
      totalAmount: 5800.0,
      totalCost: 2640.0,
      grossProfit: 3160.0,
      grossMarginPct: 54.48,
      paymentStatus: 'PARTIAL',
      paidAmount: 2000.0,
      paymentMethod: 'UPI',
      notes: 'Restaurant bi-weekly order',
      items: {
        create: [
          {
            productId: p1.id,
            batchId: b2.id,
            quantity: 35,
            unitPrice: 80.0,
            unitCost: 33.0,
            totalPrice: 2800.0,
            totalCost: 1155.0,
            profit: 1645.0,
          },
          {
            productId: p3.id,
            batchId: b4.id,
            quantity: 12,
            unitPrice: 250.0,
            unitCost: 135.0,
            totalPrice: 3000.0,
            totalCost: 1620.0,
            profit: 1380.0,
          },
        ],
      },
    },
  });

  const del3 = await prisma.delivery.create({
    data: {
      challanNumber: 'DC-2026-0083',
      orderId: ord3.id,
      clientId: c3.id,
      scheduledDate: new Date('2026-10-21T10:00:00Z'),
      deliveredDate: new Date('2026-10-21T11:20:00Z'),
      status: 'DELIVERED',
      driverName: 'Ramesh Pawar',
      driverPhone: '+91 99221 00334',
      vehicleNumber: 'MH-12-PQ-4521 (Tata 407)',
      deliveryAddress: c3.address,
      recipientName: 'Chef Anil Patil',
      recipientPhone: '+91 97654 32109',
      notes: 'Kitchen pantry intake.',
      emptyJarsDelivered: 35,
      emptyJarsCollected: 30,
      emptyJarsDamaged: 0,
    },
  });

  await prisma.payment.create({
    data: {
      orderId: ord3.id,
      clientId: c3.id,
      amount: 2000.0,
      paymentDate: new Date('2026-10-21T12:00:00Z'),
      paymentMethod: 'UPI',
      referenceNumber: 'UPI-ICICI-28472911',
      notes: 'Part payment paid by Chef Anil',
    },
  });

  // Order 4: Green Palms Banquet (Out for Delivery Today)
  const ord4 = await prisma.order.create({
    data: {
      invoiceNumber: 'INV-2026-1004',
      clientId: c4.id,
      orderDate: new Date('2026-10-23T09:00:00Z'),
      subtotal: 8200.0,
      taxAmount: 0.0,
      discountAmount: 0.0,
      totalAmount: 8200.0,
      totalCost: 3730.0,
      grossProfit: 4470.0,
      grossMarginPct: 54.51,
      paymentStatus: 'PENDING',
      paidAmount: 0.0,
      paymentMethod: 'CASH',
      notes: 'Wedding event booking: 50 jars + 20 boxes cups',
      items: {
        create: [
          {
            productId: p1.id,
            batchId: b2.id,
            quantity: 50,
            unitPrice: 80.0,
            unitCost: 33.0,
            totalPrice: 4000.0,
            totalCost: 1650.0,
            profit: 2350.0,
          },
          {
            productId: p4.id,
            batchId: null,
            quantity: 20,
            unitPrice: 210.0,
            unitCost: 104.0,
            totalPrice: 4200.0,
            totalCost: 2080.0,
            profit: 2120.0,
          },
        ],
      },
    },
  });

  await prisma.delivery.create({
    data: {
      challanNumber: 'DC-2026-0084',
      orderId: ord4.id,
      clientId: c4.id,
      scheduledDate: new Date('2026-10-23T14:00:00Z'),
      deliveredDate: null,
      status: 'OUT_FOR_DELIVERY',
      driverName: 'Sunil Yadav',
      driverPhone: '+91 97665 44112',
      vehicleNumber: 'MH-14-GH-8812 (Tata Ace)',
      deliveryAddress: c4.address,
      recipientName: 'Rajesh Mehta',
      recipientPhone: '+91 94223 88990',
      notes: 'On route. Dispatched at 2:15 PM.',
      emptyJarsDelivered: 50,
      emptyJarsCollected: 0,
      emptyJarsDamaged: 0,
    },
  });

  // Order 5: Novotel Lakeside (Scheduled for Tomorrow)
  const ord5 = await prisma.order.create({
    data: {
      invoiceNumber: 'INV-2026-1005',
      clientId: c5.id,
      orderDate: new Date('2026-10-23T16:00:00Z'),
      subtotal: 12400.0,
      taxAmount: 0.0,
      discountAmount: 0.0,
      totalAmount: 12400.0,
      totalCost: 5540.0,
      grossProfit: 6860.0,
      grossMarginPct: 55.32,
      paymentStatus: 'PENDING',
      paidAmount: 0.0,
      paymentMethod: 'CREDIT',
      notes: 'Scheduled for tomorrow morning delivery',
      items: {
        create: [
          {
            productId: p1.id,
            batchId: b2.id,
            quantity: 90,
            unitPrice: 80.0,
            unitCost: 33.0,
            totalPrice: 7200.0,
            totalCost: 2970.0,
            profit: 4230.0,
          },
          {
            productId: p2.id,
            batchId: b3.id,
            quantity: 20,
            unitPrice: 210.0,
            unitCost: 120.0,
            totalPrice: 4200.0,
            totalCost: 2400.0,
            profit: 1800.0,
          },
          {
            productId: p5.id,
            batchId: null,
            quantity: 3,
            unitPrice: 333.33,
            unitCost: 180.0,
            totalPrice: 1000.0,
            totalCost: 540.0,
            profit: 460.0,
          },
        ],
      },
    },
  });

  await prisma.delivery.create({
    data: {
      challanNumber: 'DC-2026-0085',
      orderId: ord5.id,
      clientId: c5.id,
      scheduledDate: new Date('2026-10-24T08:30:00Z'),
      deliveredDate: null,
      status: 'SCHEDULED',
      driverName: 'Ramesh Pawar',
      driverPhone: '+91 99221 00334',
      vehicleNumber: 'MH-12-PQ-4521 (Tata 407)',
      deliveryAddress: c5.address,
      recipientName: 'Pooja Sharma',
      recipientPhone: '+91 98112 55667',
      notes: 'Scheduled morning slot. Hotel staff requested call 15 mins prior.',
      emptyJarsDelivered: 90,
      emptyJarsCollected: 0,
      emptyJarsDamaged: 0,
    },
  });

  // 5. Create Operating Expenses for accurate Net Profit calculation
  await prisma.expense.createMany({
    data: [
      {
        expenseNumber: 'EXP-2026-101',
        date: new Date('2026-10-05'),
        category: 'WAREHOUSE_RENT',
        amount: 22000.0,
        paymentMethod: 'BANK_TRANSFER',
        paidTo: 'Shree Sai Logistics Park',
        description: 'Monthly warehouse and staging depot rent for October',
      },
      {
        expenseNumber: 'EXP-2026-102',
        date: new Date('2026-10-10'),
        category: 'DRIVER_WAGES',
        amount: 18000.0,
        paymentMethod: 'BANK_TRANSFER',
        paidTo: 'Ramesh Pawar & Sunil Yadav',
        description: 'Driver advance & first-half salaries',
      },
      {
        expenseNumber: 'EXP-2026-103',
        date: new Date('2026-10-14'),
        category: 'FUEL',
        amount: 4500.0,
        paymentMethod: 'UPI',
        paidTo: 'Indian Oil Retail Outlet #44',
        vehicleNumber: 'MH-12-PQ-4521',
        description: 'Diesel refill 50 liters for delivery truck',
      },
      {
        expenseNumber: 'EXP-2026-104',
        date: new Date('2026-10-18'),
        category: 'FUEL',
        amount: 3200.0,
        paymentMethod: 'UPI',
        paidTo: 'Bharat Petroleum Highway',
        vehicleNumber: 'MH-14-GH-8812',
        description: 'Diesel refill for Tata Ace delivery vehicle',
      },
      {
        expenseNumber: 'EXP-2026-105',
        date: new Date('2026-10-19'),
        category: 'VEHICLE_MAINTENANCE',
        amount: 2800.0,
        paymentMethod: 'CASH',
        paidTo: 'Standard Auto Garage',
        vehicleNumber: 'MH-12-PQ-4521',
        description: 'Brake pad replacement and wheel alignment',
      },
      {
        expenseNumber: 'EXP-2026-106',
        date: new Date('2026-10-21'),
        category: 'PACKAGING_SEALS',
        amount: 1950.0,
        paymentMethod: 'UPI',
        paidTo: 'SuperPolymers Packaging',
        description: 'Tamper-evident neck shrink sleeves & heat seals (5,000 pcs)',
      },
      {
        expenseNumber: 'EXP-2026-107',
        date: new Date('2026-10-22'),
        category: 'WATER_TESTING',
        amount: 1500.0,
        paymentMethod: 'BANK_TRANSFER',
        paidTo: 'EnviroTech Analytical Labs',
        description: 'Mandatory FSSAI monthly microbiological & TDS water test certificate',
      },
    ],
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
