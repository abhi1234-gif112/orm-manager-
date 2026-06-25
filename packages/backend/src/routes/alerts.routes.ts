import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { prisma } from '../config/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sendSuccess, sendError, getPaginationParams } from '../utils/apiResponse.js';
import type { AlertStatus, AlertSeverity, AlertType } from '@prisma/client';

const router = Router();
router.use(authenticate);

// GET /api/alerts?clientId=&status=&severity=&type=
router.get(
  '/',
  [query('clientId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const { page, limit, offset } = getPaginationParams(req.query);
      const { clientId, status, severity, type } = req.query as Record<string, string>;

      const where = {
        clientId,
        ...(status && { status: status as AlertStatus }),
        ...(severity && { severity: severity as AlertSeverity }),
        ...(type && { type: type as AlertType }),
      };

      const [alerts, total] = await Promise.all([
        prisma.alert.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
          include: {
            mentions: { include: { mention: { select: { id: true, contentSummaryEn: true, source: true } } }, take: 3 },
          },
        }),
        prisma.alert.count({ where }),
      ]);

      sendSuccess(res, { data: alerts, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/alerts/:id
router.get('/:id', [param('id').notEmpty()], validate, async (req, res, next) => {
  try {
    const alert = await prisma.alert.findUnique({
      where: { id: req.params['id'] },
      include: {
        mentions: { include: { mention: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!alert) return sendError(res, 'Alert not found', 404);
    sendSuccess(res, alert);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/alerts/:id/status
router.patch(
  '/:id/status',
  [
    param('id').notEmpty(),
    body('status').isIn(['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { status } = req.body as { status: AlertStatus };
      const now = new Date();

      const alert = await prisma.alert.update({
        where: { id: req.params['id'] },
        data: {
          status,
          ...(status === 'ACKNOWLEDGED' && { acknowledgedAt: now }),
          ...(status === 'RESOLVED' && { resolvedAt: now }),
        },
      });
      sendSuccess(res, alert);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
