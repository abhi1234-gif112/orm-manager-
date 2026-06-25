import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { prisma } from '../config/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sendSuccess, sendError, getPaginationParams } from '../utils/apiResponse.js';
import type { ClientType, ClientTier } from '@prisma/client';

const router = Router();
router.use(authenticate);

// GET /api/clients
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, offset } = getPaginationParams(req.query);

    const where =
      req.user!.role === 'SUPER_ADMIN' || req.user!.role === 'ADMIN'
        ? {}
        : { users: { some: { userId: req.user!.id } } };

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { name: 'asc' },
        include: { _count: { select: { mentions: true, alerts: true } } },
      }),
      prisma.client.count({ where }),
    ]);

    sendSuccess(res, { data: clients, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
});

// POST /api/clients
router.post(
  '/',
  requireRole('SUPER_ADMIN', 'ADMIN'),
  [
    body('name').trim().notEmpty(),
    body('type').isIn(['POLITICIAN', 'PARTY', 'ORGANIZATION', 'MINISTRY']),
    body('tier').optional().isIn(['NATIONAL', 'STATE', 'DISTRICT', 'LOCAL']),
    body('keywords').isArray({ min: 1 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = req.body as {
        name: string;
        nameHindi?: string;
        type: ClientType;
        tier?: ClientTier;
        party?: string;
        constituency?: string;
        state?: string;
        bio?: string;
        photoUrl?: string;
        twitterHandle?: string;
        facebookPageId?: string;
        instagramHandle?: string;
        youtubeChannelId?: string;
        linkedinProfileId?: string;
        telegramChannel?: string;
        keywords: string[];
      };

      const client = await prisma.client.create({ data });
      sendSuccess(res, client, 201);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/clients/:id
router.get(
  '/:id',
  [param('id').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const client = await prisma.client.findUnique({
        where: { id: req.params['id'] },
        include: {
          _count: { select: { mentions: true, alerts: true, individuals: true } },
          ingestionConfigs: { where: { isActive: true } },
        },
      });
      if (!client) return sendError(res, 'Client not found', 404);
      sendSuccess(res, client);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/clients/:id
router.patch(
  '/:id',
  requireRole('SUPER_ADMIN', 'ADMIN'),
  [param('id').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const client = await prisma.client.update({
        where: { id: req.params['id'] },
        data: req.body as Record<string, unknown>,
      });
      sendSuccess(res, client);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/clients/:id
router.delete(
  '/:id',
  requireRole('SUPER_ADMIN'),
  [param('id').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      await prisma.client.delete({ where: { id: req.params['id'] } });
      sendSuccess(res, null);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/clients/:id/dashboard — aggregated stats for the client dashboard
router.get('/:id/dashboard', [param('id').notEmpty()], validate, async (req, res, next) => {
  try {
    const clientId = req.params['id']!;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [sentimentBreakdown, topTopics, recentAlerts, volumeBySource, mentionVolume] = await Promise.all([
      prisma.mention.groupBy({
        by: ['politicalSentiment'],
        where: { clientId, createdAt: { gte: since } },
        _count: true,
      }),
      prisma.mention.findMany({
        where: { clientId, createdAt: { gte: since }, topics: { isEmpty: false } },
        select: { topics: true },
        take: 500,
      }),
      prisma.alert.findMany({
        where: { clientId, status: 'OPEN' },
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
        take: 5,
      }),
      prisma.mention.groupBy({
        by: ['source'],
        where: { clientId, createdAt: { gte: since } },
        _count: true,
        orderBy: { _count: { source: 'desc' } },
      }),
      prisma.mention.count({ where: { clientId, createdAt: { gte: since } } }),
    ]);

    // Flatten and count topics
    const topicCounts: Record<string, number> = {};
    for (const m of topTopics) {
      for (const t of m.topics) {
        topicCounts[t] = (topicCounts[t] ?? 0) + 1;
      }
    }
    const sortedTopics = Object.entries(topicCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));

    sendSuccess(res, {
      mentionVolume,
      sentimentBreakdown,
      topTopics: sortedTopics,
      recentAlerts,
      volumeBySource,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
