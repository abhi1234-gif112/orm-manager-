import cron from 'node-cron';
import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import { ingestionQueue } from './queues.js';
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

export function startScheduler(): void {
  // Every 5 minutes: check which ingestion configs are due and queue them
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();
      const configs = await prisma.ingestionConfig.findMany({
        where: {
          isActive: true,
          errorCount: { lt: 10 }, // pause configs that keep failing
          OR: [
            { lastRunAt: null },
            {
              lastRunAt: {
                lte: new Date(now.getTime() - 5 * 60 * 1000), // at least 5 min ago
              },
            },
          ],
        },
      });

      for (const config of configs) {
        const intervalMs = config.intervalMinutes * 60 * 1000;
        const lastRun = config.lastRunAt?.getTime() ?? 0;
        if (now.getTime() - lastRun < intervalMs) continue;

        const jobName = INGESTION_JOB_MAP[config.sourceType];
        if (!jobName) continue;

        await ingestionQueue.add(jobName, { configId: config.id }, {
          jobId: `${config.id}-${Date.now()}`,
          removeOnComplete: { count: 10 },
        });
      }
    } catch (err) {
      logger.error('Scheduler error', { err });
    }
  });

  // Daily analytics snapshot at midnight IST (18:30 UTC)
  cron.schedule('30 18 * * *', async () => {
    try {
      const clients = await prisma.client.findMany({ where: { isActive: true }, select: { id: true } });
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const endOfYesterday = new Date(yesterday);
      endOfYesterday.setHours(23, 59, 59, 999);

      for (const client of clients) {
        await generateDailySnapshot(client.id, yesterday, endOfYesterday);
      }
    } catch (err) {
      logger.error('Daily snapshot error', { err });
    }
  });

  logger.info('Scheduler started — ingestion poll every 5 minutes');
}

async function generateDailySnapshot(
  clientId: string,
  start: Date,
  end: Date,
): Promise<void> {
  const [agg, topTopics] = await Promise.all([
    prisma.mention.aggregate({
      where: { clientId, publishedAt: { gte: start, lte: end } },
      _count: true,
      _avg: { sentimentScore: true },
      _sum: { reachEstimate: true },
    }),
    prisma.mention.findMany({
      where: { clientId, publishedAt: { gte: start, lte: end } },
      select: { topics: true },
    }),
  ]);

  const [positive, negative, neutral] = await Promise.all([
    prisma.mention.count({
      where: { clientId, publishedAt: { gte: start, lte: end }, politicalSentiment: { in: ['POSITIVE', 'STRONGLY_POSITIVE'] } },
    }),
    prisma.mention.count({
      where: { clientId, publishedAt: { gte: start, lte: end }, politicalSentiment: { in: ['NEGATIVE', 'STRONGLY_NEGATIVE'] } },
    }),
    prisma.mention.count({
      where: { clientId, publishedAt: { gte: start, lte: end }, politicalSentiment: 'NEUTRAL' },
    }),
  ]);

  const topicCounts: Record<string, number> = {};
  for (const m of topTopics) {
    for (const t of m.topics) topicCounts[t] = (topicCounts[t] ?? 0) + 1;
  }
  const topTopicsSorted = Object.entries(topicCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  await prisma.analyticsSnapshot.upsert({
    where: { clientId_period_periodStart: { clientId, period: 'daily', periodStart: start } },
    create: {
      clientId,
      period: 'daily',
      periodStart: start,
      periodEnd: end,
      totalMentions: agg._count,
      positiveCount: positive,
      negativeCount: negative,
      neutralCount: neutral,
      estimatedReach: BigInt(agg._sum.reachEstimate ?? 0),
      avgSentimentScore: agg._avg.sentimentScore ?? 0,
      topTopics: topTopicsSorted,
    },
    update: {
      totalMentions: agg._count,
      positiveCount: positive,
      negativeCount: negative,
      neutralCount: neutral,
      estimatedReach: BigInt(agg._sum.reachEstimate ?? 0),
      avgSentimentScore: agg._avg.sentimentScore ?? 0,
      topTopics: topTopicsSorted,
    },
  });
}
