import { Router } from 'express';
import { body, param } from 'express-validator';
import { prisma } from '../config/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { ingestionQueue } from '../jobs/queues.js';
import type { IngestionSourceType } from '@prisma/client';

const INGESTION_JOB_MAP: Record<IngestionSourceType, string> = {
  TWITTER_SEARCH: 'ingest.twitter',
  TWITTER_USER_TIMELINE: 'ingest.twitter',
  FACEBOOK_PAGE: 'ingest.facebook',
  INSTAGRAM_HASHTAG: 'ingest.facebook',
  YOUTUBE_CHANNEL: 'ingest.youtube',
  YOUTUBE_SEARCH: 'ingest.youtube',
  LINKEDIN_SEARCH: 'ingest.linkedin',
  TELEGRAM_CHANNEL: 'ingest.telegram',
  REDDIT_SEARCH: 'ingest.reddit',
  HINDI_NEWS_SCRAPE: 'ingest.news.hindi',
  ENGLISH_NEWS_SCRAPE: 'ingest.news.english',
  WEB_SCRAPE: 'ingest.news.english',
};

const router = Router();
router.use(authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'ANALYST'));

// GET /api/ingestion?clientId=
router.get('/', async (req, res, next) => {
  try {
    const { clientId } = req.query as { clientId?: string };
    const configs = await prisma.ingestionConfig.findMany({
      where: clientId ? { clientId } : {},
      include: { client: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, configs);
  } catch (err) {
    next(err);
  }
});

// POST /api/ingestion
router.post(
  '/',
  [
    body('clientId').notEmpty(),
    body('sourceType').notEmpty(),
    body('config').isObject(),
    body('intervalMinutes').optional().isInt({ min: 5, max: 1440 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { clientId, sourceType, config, intervalMinutes } = req.body as {
        clientId: string;
        sourceType: IngestionSourceType;
        config: Record<string, unknown>;
        intervalMinutes?: number;
      };

      const ingestionConfig = await prisma.ingestionConfig.create({
        data: { clientId, sourceType, config, intervalMinutes: intervalMinutes ?? 15 },
      });

      sendSuccess(res, ingestionConfig, 201);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/ingestion/:id/trigger — manual trigger
router.post('/:id/trigger', [param('id').notEmpty()], validate, async (req, res, next) => {
  try {
    const config = await prisma.ingestionConfig.findUnique({ where: { id: req.params['id'] } });
    if (!config) return sendError(res, 'Config not found', 404);

    const jobName = INGESTION_JOB_MAP[config.sourceType];
    if (!jobName) return sendError(res, 'Unsupported source type', 400);

    await ingestionQueue.add(jobName, { configId: config.id }, { priority: 1 });
    sendSuccess(res, { queued: true, jobName });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/ingestion/:id
router.patch('/:id', [param('id').notEmpty()], validate, async (req, res, next) => {
  try {
    const config = await prisma.ingestionConfig.update({
      where: { id: req.params['id'] },
      data: req.body as Record<string, unknown>,
    });
    sendSuccess(res, config);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/ingestion/:id
router.delete('/:id', requireRole('SUPER_ADMIN', 'ADMIN'), [param('id').notEmpty()], validate, async (req, res, next) => {
  try {
    await prisma.ingestionConfig.delete({ where: { id: req.params['id'] } });
    sendSuccess(res, null);
  } catch (err) {
    next(err);
  }
});

export default router;
