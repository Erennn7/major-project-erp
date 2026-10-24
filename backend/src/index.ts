import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { analyticsRouter } from './routes/analytics';
import { productsRouter } from './routes/products';
import { batchesRouter } from './routes/batches';
import { clientsRouter } from './routes/clients';
import { ordersRouter } from './routes/orders';
import { deliveriesRouter } from './routes/deliveries';
import { jarsRouter } from './routes/jars';
import { expensesRouter } from './routes/expenses';
import { paymentsRouter } from './routes/payments';

import { authRouter } from './routes/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());

// Root endpoint for Render health and deployment status
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'AquaFlow Packaged Water Distribution API',
    database: 'Neon PostgreSQL Connected',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/products', productsRouter);
app.use('/api/batches', batchesRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/deliveries', deliveriesRouter);
app.use('/api/jars', jarsRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/payments', paymentsRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'AquaFlow Packaged Water Distribution API',
    timestamp: new Date().toISOString(),
  });
});

// Catch-all 404 for API routes
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.url}` });
});

app.listen(PORT, () => {
  console.log(`Water Distribution Backend Server running on port ${PORT}`);
});
