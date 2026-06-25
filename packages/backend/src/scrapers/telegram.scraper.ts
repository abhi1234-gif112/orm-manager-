import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import { withRetry } from '../utils/retry.js';
import { aiQueue } from '../jobs/queues.js';
import { env } from '../config/env.js';

interface TelegramMessage {
  message_id: number;
  text?: string;
  caption?: string;
  date: number;
  forward_count?: number;
  views?: number;
}

export async function runTelegramIngestion(configId: string): Promise<void> {
  const config = await prisma.ingestionConfig.findUnique({
    where: { id: configId },
    include: { client: { select: { id: true, name: true } } },
  });

  if (!config || !config.isActive) return;
  if (!env.TELEGRAM_BOT_TOKEN) {
    logger.warn('Telegram bot token not configured, skipping');
    return;
  }

  const { channelUsername } = config.config as { channelUsername: string };

  try {
    const messages = await fetchChannelMessages(channelUsername);
    let ingested = 0;

    for (const msg of messages) {
      const content = msg.text ?? msg.caption ?? '';
      if (!content.trim()) continue;

      const sourceId = `${channelUsername}:${msg.message_id}`;
      const existing = await prisma.mention.findUnique({
        where: { source_sourceId: { source: 'TELEGRAM', sourceId } },
      });
      if (existing) continue;

      const mention = await prisma.mention.create({
        data: {
          clientId: config.clientId,
          source: 'TELEGRAM',
          sourceId,
          sourceUrl: `https://t.me/${channelUsername}/${msg.message_id}`,
          authorHandle: channelUsername,
          platform: 'telegram',
          contentOriginal: content,
          shares: msg.forward_count ?? 0,
          views: msg.views ?? 0,
          publishedAt: new Date(msg.date * 1000),
        },
      });

      await aiQueue.add('ai.analyze.mention', {
        mentionId: mention.id,
        clientId: config.clientId,
      });
      ingested++;
    }

    await prisma.ingestionConfig.update({
      where: { id: configId },
      data: { lastRunAt: new Date(), lastRunStatus: `OK: ${ingested} new messages`, errorCount: 0 },
    });

    logger.info('Telegram ingestion complete', { configId, ingested });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await prisma.ingestionConfig.update({
      where: { id: configId },
      data: { lastRunStatus: `ERROR: ${error}`, errorCount: { increment: 1 } },
    });
    throw err;
  }
}

async function fetchChannelMessages(channelUsername: string): Promise<TelegramMessage[]> {
  return withRetry(
    async () => {
      // Use Telegram Bot API getUpdates or channel export
      // Note: Requires the bot to be added as admin to the channel
      const response = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getUpdates?allowed_updates=["channel_post"]`,
      );

      if (!response.ok) throw new Error(`Telegram API: ${response.status}`);

      const data = (await response.json()) as {
        result?: Array<{ channel_post?: TelegramMessage & { chat: { username: string } } }>;
      };

      return (data.result ?? [])
        .map((u) => u.channel_post)
        .filter((p): p is TelegramMessage & { chat: { username: string } } => !!p)
        .filter((p) => p.chat.username === channelUsername);
    },
    { context: `Telegram:${channelUsername}`, maxAttempts: 3 },
  );
}
