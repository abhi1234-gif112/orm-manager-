import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { prisma } from '../config/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sendSuccess, sendError, getPaginationParams } from '../utils/apiResponse.js';
import { aiQueue } from '../jobs/queues.js';
import type { IndividualStance, IndividualType } from '@prisma/client';

const router = Router();
router.use(authenticate);

// GET /api/individuals?clientId=&stance=&type=&minRisk=
router.get(
  '/',
  [query('clientId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const { page, limit, offset } = getPaginationParams(req.query);
      const { clientId, stance, type, minRisk, minInfluence, search } = req.query as Record<string, string>;

      const where = {
        clientProfiles: { some: { clientId } },
        ...(stance && { stance: stance as IndividualStance }),
        ...(type && { type: type as IndividualType }),
        ...(minRisk && { riskScore: { gte: parseInt(minRisk, 10) } }),
        ...(minInfluence && { influenceScore: { gte: parseInt(minInfluence, 10) } }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { twitterHandle: { contains: search, mode: 'insensitive' as const } },
            { party: { contains: search, mode: 'insensitive' as const } },
          ],
        }),
      };

      const [individuals, total] = await Promise.all([
        prisma.individual.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [{ riskScore: 'desc' }, { influenceScore: 'desc' }],
          include: {
            clientProfiles: { where: { clientId }, select: { stanceOverride: true, notes: true } },
            _count: { select: { mentions: true } },
          },
        }),
        prisma.individual.count({ where }),
      ]);

      sendSuccess(res, { data: individuals, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/individuals
router.post(
  '/',
  [body('name').notEmpty(), body('clientId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const { clientId, ...data } = req.body as {
        clientId: string;
        name: string;
        nameHindi?: string;
        type?: IndividualType;
        party?: string;
        twitterHandle?: string;
        totalFollowers?: number;
      };

      const individual = await prisma.individual.create({
        data: {
          ...data,
          clientProfiles: { create: { clientId } },
        },
      });

      sendSuccess(res, individual, 201);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/individuals/:id
router.get('/:id', [param('id').notEmpty()], validate, async (req, res, next) => {
  try {
    const individual = await prisma.individual.findUnique({
      where: { id: req.params['id'] },
      include: {
        clientProfiles: true,
        mentions: { orderBy: { createdAt: 'desc' }, take: 10 },
        _count: { select: { mentions: true } },
      },
    });
    if (!individual) return sendError(res, 'Individual not found', 404);
    sendSuccess(res, individual);
  } catch (err) {
    next(err);
  }
});

// POST /api/individuals/:id/rescore
router.post('/:id/rescore', [param('id').notEmpty(), body('clientId').notEmpty()], validate, async (req, res, next) => {
  try {
    const { clientId } = req.body as { clientId: string };
    await aiQueue.add('ai.score.individual', { individualId: req.params['id'], clientId });
    sendSuccess(res, { queued: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/individuals/:id/stance — manual stance override
router.patch(
  '/:id/stance',
  [param('id').notEmpty(), body('clientId').notEmpty(), body('stance').isIn(['ALLY', 'THREAT', 'WATCHLIST', 'NEUTRAL'])],
  validate,
  async (req, res, next) => {
    try {
      const { clientId, stance, notes } = req.body as {
        clientId: string;
        stance: IndividualStance;
        notes?: string;
      };

      await prisma.clientIndividual.upsert({
        where: { clientId_individualId: { clientId, individualId: req.params['id']! } },
        create: { clientId, individualId: req.params['id']!, stanceOverride: stance, notes },
        update: { stanceOverride: stance, notes },
      });

      sendSuccess(res, { updated: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
