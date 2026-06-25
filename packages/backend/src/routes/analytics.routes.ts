import { Router } from 'express';
import { query } from 'express-validator';
import { prisma } from '../config/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

const router = Router();
router.use(authenticate);

// GET /api/analytics/sentiment-trend?clientId=&days=7
router.get(
  '/sentiment-trend',
  [query('clientId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const { clientId, days = '7' } = req.query as Record<string, string>;
      const since = new Date(Date.now() - parseInt(days, 10) * 24 * 60 * 60 * 1000);

      // Group mentions by day and sentiment
      const mentions = await prisma.mention.findMany({
        where: { clientId, publishedAt: { gte: since }, sentimentScore: { not: null } },
        select: { publishedAt: true, sentimentScore: true, politicalSentiment: true },
        orderBy: { publishedAt: 'asc' },
      });

      // Bucket by day
      const buckets: Record<string, { scores: number[]; counts: Record<string, number> }> = {};
      for (const m of mentions) {
        const day = m.publishedAt?.toISOString().split('T')[0] ?? 'unknown';
        if (!buckets[day]) buckets[day] = { scores: [], counts: {} };
        if (m.sentimentScore != null) buckets[day].scores.push(m.sentimentScore);
        const sentiment = m.politicalSentiment ?? 'NEUTRAL';
        buckets[day].counts[sentiment] = (buckets[day].counts[sentiment] ?? 0) + 1;
      }

      const trend = Object.entries(buckets).map(([date, { scores, counts }]) => ({
        date,
        avgSentiment: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
        ...counts,
      }));

      sendSuccess(res, trend);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/analytics/source-breakdown?clientId=&days=
router.get(
  '/source-breakdown',
  [query('clientId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const { clientId, days = '7' } = req.query as Record<string, string>;
      const since = new Date(Date.now() - parseInt(days, 10) * 24 * 60 * 60 * 1000);

      const breakdown = await prisma.mention.groupBy({
        by: ['source'],
        where: { clientId, createdAt: { gte: since } },
        _count: true,
        _avg: { sentimentScore: true },
        orderBy: { _count: { source: 'desc' } },
      });

      sendSuccess(res, breakdown);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/analytics/topic-cloud?clientId=&days=
router.get(
  '/topic-cloud',
  [query('clientId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const { clientId, days = '7' } = req.query as Record<string, string>;
      const since = new Date(Date.now() - parseInt(days, 10) * 24 * 60 * 60 * 1000);

      const mentions = await prisma.mention.findMany({
        where: { clientId, createdAt: { gte: since }, topics: { isEmpty: false } },
        select: { topics: true, sentimentScore: true },
      });

      const topicMap: Record<string, { count: number; totalSentiment: number }> = {};
      for (const m of mentions) {
        for (const topic of m.topics) {
          if (!topicMap[topic]) topicMap[topic] = { count: 0, totalSentiment: 0 };
          topicMap[topic].count++;
          topicMap[topic].totalSentiment += m.sentimentScore ?? 0;
        }
      }

      const cloud = Object.entries(topicMap)
        .map(([topic, { count, totalSentiment }]) => ({
          topic,
          count,
          avgSentiment: count > 0 ? totalSentiment / count : 0,
        }))
        .sort((a, b) => b.count - a.count);

      sendSuccess(res, cloud);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/analytics/threat-radar?clientId=
router.get(
  '/threat-radar',
  [query('clientId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const { clientId } = req.query as { clientId: string };
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [topThreats, openAlerts, disinfoCount] = await Promise.all([
        prisma.individual.findMany({
          where: {
            clientProfiles: { some: { clientId } },
            stance: 'THREAT',
          },
          orderBy: [{ riskScore: 'desc' }, { influenceScore: 'desc' }],
          take: 10,
          select: { id: true, name: true, riskScore: true, influenceScore: true, stance: true, twitterHandle: true },
        }),
        prisma.alert.count({ where: { clientId, status: 'OPEN' } }),
        prisma.mention.count({ where: { clientId, isDisinformation: true, createdAt: { gte: since } } }),
      ]);

      sendSuccess(res, { topThreats, openAlerts, disinfoCount });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/analytics/snapshots?clientId=&period=daily
router.get(
  '/snapshots',
  [query('clientId').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const { clientId, period = 'daily', limit = '30' } = req.query as Record<string, string>;

      const snapshots = await prisma.analyticsSnapshot.findMany({
        where: { clientId, period },
        orderBy: { periodStart: 'desc' },
        take: parseInt(limit, 10),
      });

      sendSuccess(res, snapshots);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
