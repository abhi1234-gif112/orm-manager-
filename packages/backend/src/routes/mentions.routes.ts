import { Router } from 'express';
import { param, query } from 'express-validator';
import { prisma } from '../config/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sendSuccess, sendError, getPaginationParams } from '../utils/apiResponse.js';
import { aiQueue } from '../jobs/queues.js';
import multer from 'multer';
import type { MentionSource, PoliticalSentiment, ContentTone } from '@prisma/client';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
router.use(authenticate);

// GET /api/mentions?clientId=&source=&sentiment=&from=&to=&page=&limit=
router.get(
  '/',
  [query('clientId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const { page, limit, offset } = getPaginationParams(req.query);
      const { clientId, source, sentiment, tone, topic, from, to, threatLevel, search } = req.query as Record<string, string>;

      const where = {
        clientId,
        ...(source && { source: source as MentionSource }),
        ...(sentiment && { politicalSentiment: sentiment as PoliticalSentiment }),
        ...(tone && { contentTone: tone as ContentTone }),
        ...(topic && { topics: { has: topic } }),
        ...(threatLevel && { threatLevel: { gte: parseInt(threatLevel, 10) } }),
        ...(from || to
          ? {
              publishedAt: {
                ...(from && { gte: new Date(from) }),
                ...(to && { lte: new Date(to) }),
              },
            }
          : {}),
        ...(search && {
          OR: [
            { contentOriginal: { contains: search, mode: 'insensitive' as const } },
            { contentSummaryEn: { contains: search, mode: 'insensitive' as const } },
            { authorName: { contains: search, mode: 'insensitive' as const } },
          ],
        }),
      };

      const [mentions, total] = await Promise.all([
        prisma.mention.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { publishedAt: 'desc' },
          include: { individual: { select: { id: true, name: true, stance: true } } },
        }),
        prisma.mention.count({ where }),
      ]);

      sendSuccess(res, { data: mentions, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/mentions/:id
router.get('/:id', [param('id').notEmpty()], validate, async (req, res, next) => {
  try {
    const mention = await prisma.mention.findUnique({
      where: { id: req.params['id'] },
      include: { individual: true, alerts: { include: { alert: true } } },
    });
    if (!mention) return sendError(res, 'Mention not found', 404);
    sendSuccess(res, mention);
  } catch (err) {
    next(err);
  }
});

// POST /api/mentions/:id/reanalyze — re-run Claude analysis
router.post('/:id/reanalyze', [param('id').notEmpty()], validate, async (req, res, next) => {
  try {
    const mention = await prisma.mention.findUnique({
      where: { id: req.params['id'] },
      select: { id: true, clientId: true },
    });
    if (!mention) return sendError(res, 'Mention not found', 404);

    await prisma.mention.update({ where: { id: mention.id }, data: { processedByAI: false } });
    await aiQueue.add('ai.analyze.mention', { mentionId: mention.id, clientId: mention.clientId });

    sendSuccess(res, { queued: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/mentions/upload/whatsapp — manual WhatsApp screenshot/text upload
router.post(
  '/upload/whatsapp',
  upload.single('file'),
  async (req, res, next) => {
    try {
      const { clientId, content } = req.body as { clientId: string; content?: string };
      const text = content ?? req.file?.buffer.toString('utf-8') ?? '';

      if (!text.trim()) return sendError(res, 'No content provided', 400);

      const mention = await prisma.mention.create({
        data: {
          clientId,
          source: 'WHATSAPP_UPLOAD' as MentionSource,
          platform: 'whatsapp',
          contentOriginal: text,
          publishedAt: new Date(),
        },
      });

      await aiQueue.add('ai.analyze.mention', { mentionId: mention.id, clientId });
      sendSuccess(res, { id: mention.id, queued: true }, 201);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
