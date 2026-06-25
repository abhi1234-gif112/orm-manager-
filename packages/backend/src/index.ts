import './config/env.js'; // validates env first
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from './config/prisma.js';
import { redis } from './config/redis.js';
import { errorHandler } from './middleware/errorHandler.js';
import { startIngestionWorker } from './jobs/ingestionWorker.js';
import { startAiWorker } from './jobs/aiWorker.js';
import { startScheduler } from './jobs/scheduler.js';

import authRoutes from './routes/auth.routes.js';
import clientRoutes from './routes/clients.routes.js';
import mentionRoutes from './routes/mentions.routes.js';
import alertRoutes from './routes/alerts.routes.js';
import individualRoutes from './routes/individuals.routes.js';
import assetRoutes from './routes/assets.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import ingestionRoutes from './routes/ingestion.routes.js';

const app = express();
const httpServer = createServer(app);

// WebSocket server for real-time alert delivery
const io = new SocketIOServer(httpServer, {
  cors: { origin: env.FRONTEND_URL, credentials: true },
});

// ── Security & parsing middleware ─────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.http(msg.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Global rate limiter — tighter limits applied per-route where needed
app.use(
  '/api',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false }),
);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/mentions', mentionRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/individuals', individualRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ingestion', ingestionRoutes);

app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'nazar-backend', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

// ── WebSocket — push alerts to connected clients ──────────────────────────────
io.on('connection', (socket) => {
  logger.debug('WS client connected', { id: socket.id });

  socket.on('subscribe:alerts', (clientId: string) => {
    void socket.join(`alerts:${clientId}`);
    logger.debug('Client subscribed to alerts', { socketId: socket.id, clientId });
  });

  socket.on('disconnect', () => {
    logger.debug('WS client disconnected', { id: socket.id });
  });
});

// Expose io globally for alert push from alert.service
(global as Record<string, unknown>)['__io__'] = io;

// ── Startup ───────────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  // Test DB connection
  await prisma.$connect();
  logger.info('Database connected');

  // Connect Redis
  await redis.connect();

  // Start background workers
  startIngestionWorker();
  startAiWorker();
  startScheduler();

  httpServer.listen(env.PORT, () => {
    logger.info(`NAZAR backend running on port ${env.PORT}`, {
      env: env.NODE_ENV,
      pid: process.pid,
    });
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  redis.quit();
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
});

start().catch((err) => {
  logger.error('Failed to start server', { err });
  process.exit(1);
});
