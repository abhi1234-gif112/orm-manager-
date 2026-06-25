import { Router } from 'express';
import { body, param } from 'express-validator';
import { prisma } from '../config/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { generateResponseAsset } from '../services/claude.service.js';
import type { AssetType, AssetStatus } from '@prisma/client';

const router = Router();
router.use(authenticate);

const VALID_ASSET_TYPES: AssetType[] = [
  'COUNTER_BRIEF',
  'RAPID_RESPONSE_TWEET',
  'PRESS_STATEMENT',
  'PRESS_KIT',
  'WHATSAPP_FORWARD',
  'SOCIAL_CAPTION',
  'TALKING_POINTS',
  'FACT_CHECK',
  'NARRATIVE_MEMO',
  'MEDIA_PITCH',
  'CRISIS_STATEMENT',
];

// POST /api/assets/generate
router.post(
  '/generate',
  [
    body('clientId').notEmpty(),
    body('assetType').isIn(VALID_ASSET_TYPES),
    body('context').notEmpty(),
    body('triggeringContent').notEmpty(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { clientId, assetType, context, triggeringContent, triggeredByAlertId, triggeredByMentionId } =
        req.body as {
          clientId: string;
          assetType: AssetType;
          context: string;
          triggeringContent: string;
          triggeredByAlertId?: string;
          triggeredByMentionId?: string;
        };

      const client = await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } });
      if (!client) return sendError(res, 'Client not found', 404);

      const generated = await generateResponseAsset(assetType, client.name, context, triggeringContent);

      const asset = await prisma.responseAsset.create({
        data: {
          clientId,
          type: assetType,
          title: generated.title,
          contentEn: generated.contentEn,
          contentHi: generated.contentHi,
          context,
          triggeredByAlertId,
          triggeredByMentionId,
        },
      });

      sendSuccess(res, asset, 201);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/assets?clientId=&type=
router.get('/', async (req, res, next) => {
  try {
    const { clientId, type, status } = req.query as Record<string, string>;
    if (!clientId) return sendError(res, 'clientId required', 400);

    const assets = await prisma.responseAsset.findMany({
      where: {
        clientId,
        ...(type && { type: type as AssetType }),
        ...(status && { status: status as AssetStatus }),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    sendSuccess(res, assets);
  } catch (err) {
    next(err);
  }
});

// GET /api/assets/:id
router.get('/:id', [param('id').notEmpty()], validate, async (req, res, next) => {
  try {
    const asset = await prisma.responseAsset.findUnique({ where: { id: req.params['id'] } });
    if (!asset) return sendError(res, 'Asset not found', 404);
    sendSuccess(res, asset);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/assets/:id/status
router.patch(
  '/:id/status',
  [param('id').notEmpty(), body('status').isIn(['DRAFT', 'APPROVED', 'PUBLISHED', 'ARCHIVED'])],
  validate,
  async (req, res, next) => {
    try {
      const asset = await prisma.responseAsset.update({
        where: { id: req.params['id'] },
        data: { status: req.body.status as AssetStatus },
      });
      sendSuccess(res, asset);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
