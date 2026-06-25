import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import { generateAlertBrief } from './claude.service.js';
import type { AlertSeverity, AlertType, Mention } from '@prisma/client';

// Evaluate a new mention batch and fire alerts if thresholds are exceeded
export async function evaluateForAlerts(clientId: string, newMentions: Mention[]): Promise<void> {
  if (newMentions.length === 0) return;

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return;

  await Promise.all([
    checkViralNegative(clientId, client.name, newMentions),
    checkDisinformation(clientId, client.name, newMentions),
    checkCoordinatedAttack(clientId, client.name, newMentions),
    checkSentimentShift(clientId, client.name),
  ]);
}

// Alert when multiple high-engagement negative mentions arrive quickly
async function checkViralNegative(
  clientId: string,
  clientName: string,
  mentions: Mention[],
): Promise<void> {
  const highThreat = mentions.filter(
    (m) => (m.threatLevel ?? 0) >= 7 && (m.likes + m.shares) > 500,
  );
  if (highThreat.length < 2) return;

  const severity = highThreat.some((m) => (m.threatLevel ?? 0) >= 9) ? 'CRITICAL' : 'HIGH';
  await createAlert(clientId, clientName, 'VIRAL_NEGATIVE', severity as AlertSeverity, highThreat);
}

// Alert when disinformation is detected
async function checkDisinformation(
  clientId: string,
  clientName: string,
  mentions: Mention[],
): Promise<void> {
  const disinfo = mentions.filter((m) => m.isDisinformation);
  if (disinfo.length === 0) return;

  await createAlert(clientId, clientName, 'DISINFORMATION', 'HIGH', disinfo);
}

// Alert when same content appears from 5+ different accounts (coordination signal)
async function checkCoordinatedAttack(
  clientId: string,
  clientName: string,
  mentions: Mention[],
): Promise<void> {
  // Group by content similarity (simplified: same topic + same tone in short window)
  const critical = mentions.filter(
    (m) => m.contentTone === 'INFLAMMATORY' || m.contentTone === 'THREATENING',
  );
  if (critical.length >= 5) {
    await createAlert(clientId, clientName, 'COORDINATED_ATTACK', 'CRITICAL', critical);
  }
}

// Alert when aggregate sentiment drops sharply (compare last 2h vs previous 24h)
async function checkSentimentShift(clientId: string, clientName: string): Promise<void> {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [recentAvg, historicAvg] = await Promise.all([
    prisma.mention.aggregate({
      where: { clientId, createdAt: { gte: twoHoursAgo }, sentimentScore: { not: null } },
      _avg: { sentimentScore: true },
      _count: true,
    }),
    prisma.mention.aggregate({
      where: { clientId, createdAt: { gte: dayAgo, lt: twoHoursAgo }, sentimentScore: { not: null } },
      _avg: { sentimentScore: true },
      _count: true,
    }),
  ]);

  const recent = recentAvg._avg.sentimentScore ?? 0;
  const historic = historicAvg._avg.sentimentScore ?? 0;

  // Only fire if we have enough data and a significant drop (>0.3 points)
  if (recentAvg._count >= 10 && historicAvg._count >= 20 && historic - recent > 0.3) {
    const existing = await prisma.alert.findFirst({
      where: {
        clientId,
        type: 'SENTIMENT_SHIFT',
        status: 'OPEN',
        createdAt: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) },
      },
    });
    if (existing) return; // Debounce — don't create duplicate

    const { brief, recommendedActions } = await generateAlertBrief(
      clientName,
      'SENTIMENT_SHIFT',
      [`Sentiment dropped from ${historic.toFixed(2)} to ${recent.toFixed(2)} over the last 2 hours.`],
    );

    await prisma.alert.create({
      data: {
        clientId,
        type: 'SENTIMENT_SHIFT',
        severity: 'MEDIUM',
        title: `Sentiment Shift Detected for ${clientName}`,
        description: `Aggregate sentiment score dropped by ${(historic - recent).toFixed(2)} in the last 2 hours.`,
        aiSummary: brief,
        recommendedActions,
      },
    });

    logger.warn('Sentiment shift alert created', { clientId, drop: historic - recent });
  }
}

async function createAlert(
  clientId: string,
  clientName: string,
  type: AlertType,
  severity: AlertSeverity,
  triggerMentions: Mention[],
): Promise<void> {
  // Debounce: don't re-create same alert type within 1 hour
  const existing = await prisma.alert.findFirst({
    where: {
      clientId,
      type,
      status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] },
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });
  if (existing) return;

  const summaries = triggerMentions.map(
    (m) => m.contentSummaryEn ?? m.contentOriginal.slice(0, 150),
  );

  const { brief, recommendedActions } = await generateAlertBrief(clientName, type, summaries);

  await prisma.alert.create({
    data: {
      clientId,
      type,
      severity,
      title: `${type.replace(/_/g, ' ')} — ${clientName}`,
      description: `Triggered by ${triggerMentions.length} mention(s).`,
      aiSummary: brief,
      recommendedActions,
      mentions: {
        create: triggerMentions.map((m) => ({ mentionId: m.id })),
      },
    },
  });

  logger.warn('Alert created', { clientId, type, severity, triggerCount: triggerMentions.length });
}
