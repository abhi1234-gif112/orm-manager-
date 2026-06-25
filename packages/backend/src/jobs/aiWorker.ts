import { Worker } from 'bullmq';
import { bullMQConnection } from '../config/redis.js';
import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import { analyzeMention, scoreIndividual } from '../services/claude.service.js';
import { evaluateForAlerts } from '../services/alert.service.js';
import type { PoliticalSentiment, ContentTone } from '@prisma/client';

export function startAiWorker(): Worker {
  const worker = new Worker(
    'ai',
    async (job) => {
      if (job.name === 'ai.analyze.mention') {
        await processMentionAnalysis(job.data as { mentionId: string; clientId: string });
      } else if (job.name === 'ai.score.individual') {
        await processIndividualScoring(job.data as { individualId: string; clientId: string });
      }
    },
    {
      connection: bullMQConnection,
      concurrency: 5, // rate-limit Claude API usage
    },
  );

  worker.on('completed', (job) => logger.debug('AI job completed', { jobId: job.id, name: job.name }));
  worker.on('failed', (job, err) =>
    logger.error('AI job failed', { jobId: job?.id, name: job?.name, error: err.message }),
  );

  logger.info('AI worker started');
  return worker;
}

async function processMentionAnalysis({ mentionId, clientId }: { mentionId: string; clientId: string }): Promise<void> {
  const mention = await prisma.mention.findUnique({
    where: { id: mentionId },
    include: { client: { select: { name: true, keywords: true } } },
  });

  if (!mention || mention.processedByAI) return;

  const result = await analyzeMention(
    mention.contentOriginal,
    mention.client.name,
    mention.client.keywords,
  );

  const updated = await prisma.mention.update({
    where: { id: mentionId },
    data: {
      politicalSentiment: result.politicalSentiment as PoliticalSentiment,
      contentTone: result.contentTone as ContentTone,
      sentimentScore: result.sentimentScore,
      topics: result.topics,
      namedEntities: result.namedEntities,
      isDisinformation: result.isDisinformation,
      threatLevel: result.threatLevel,
      contentSummaryEn: result.summaryEn,
      contentSummaryHi: result.summaryHi,
      language: result.detectedLanguage,
      contentTranslated: result.detectedLanguage !== 'en' ? result.summaryEn : undefined,
      processedByAI: true,
    },
  });

  // Trigger alert evaluation after AI analysis
  await evaluateForAlerts(clientId, [updated]);
}

async function processIndividualScoring({ individualId, clientId }: { individualId: string; clientId: string }): Promise<void> {
  const individual = await prisma.individual.findUnique({
    where: { id: individualId },
    include: {
      mentions: {
        where: { clientId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { contentOriginal: true },
      },
      clientProfiles: { where: { clientId } },
    },
  });

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } });
  if (!individual || !client) return;

  const recentMentions = individual.mentions.map((m) => m.contentOriginal);
  if (recentMentions.length === 0) return;

  const scores = await scoreIndividual(
    individual.name,
    individual.type,
    recentMentions,
    client.name,
    individual.totalFollowers,
  );

  await prisma.individual.update({
    where: { id: individualId },
    data: {
      influenceScore: scores.influenceScore,
      riskScore: scores.riskScore,
      stanceScore: scores.stanceScore,
      stance: scores.stance,
    },
  });

  // Update per-client stance if no manual override exists
  const clientProfile = individual.clientProfiles[0];
  if (clientProfile && !clientProfile.stanceOverride) {
    await prisma.clientIndividual.update({
      where: { clientId_individualId: { clientId, individualId } },
      data: { updatedAt: new Date() },
    });
  }
}
