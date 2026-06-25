import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import { withRetry } from '../utils/retry.js';
import { aiQueue } from '../jobs/queues.js';
import { env } from '../config/env.js';

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    channelTitle: string;
    channelId: string;
    publishedAt: string;
  };
}

export async function runYouTubeIngestion(configId: string): Promise<void> {
  const config = await prisma.ingestionConfig.findUnique({
    where: { id: configId },
    include: { client: { select: { id: true, name: true, keywords: true } } },
  });

  if (!config || !config.isActive) return;
  if (!env.YOUTUBE_API_KEY) {
    logger.warn('YouTube API key not configured, skipping');
    return;
  }

  const { query, channelId } = config.config as { query?: string; channelId?: string };
  const searchQuery = query ?? config.client.keywords[0] ?? config.client.name;

  try {
    const videos = await searchYouTube(searchQuery, channelId);
    let ingested = 0;

    for (const video of videos) {
      const videoId = video.id.videoId;
      const existing = await prisma.mention.findUnique({
        where: { source_sourceId: { source: 'YOUTUBE', sourceId: videoId } },
      });
      if (existing) continue;

      const mention = await prisma.mention.create({
        data: {
          clientId: config.clientId,
          source: 'YOUTUBE',
          sourceId: videoId,
          sourceUrl: `https://youtube.com/watch?v=${videoId}`,
          authorName: video.snippet.channelTitle,
          authorHandle: video.snippet.channelId,
          platform: 'youtube',
          contentOriginal: `${video.snippet.title}\n\n${video.snippet.description}`,
          publishedAt: new Date(video.snippet.publishedAt),
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
      data: { lastRunAt: new Date(), lastRunStatus: `OK: ${ingested} new videos`, errorCount: 0 },
    });

    logger.info('YouTube ingestion complete', { configId, ingested });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await prisma.ingestionConfig.update({
      where: { id: configId },
      data: { lastRunStatus: `ERROR: ${error}`, errorCount: { increment: 1 } },
    });
    throw err;
  }
}

async function searchYouTube(query: string, channelId?: string): Promise<YouTubeSearchItem[]> {
  return withRetry(
    async () => {
      const params = new URLSearchParams({
        part: 'snippet',
        type: 'video',
        q: query,
        maxResults: '25',
        order: 'date',
        relevanceLanguage: 'hi',
        key: env.YOUTUBE_API_KEY!,
      });

      if (channelId) params.set('channelId', channelId);

      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
      if (!response.ok) throw new Error(`YouTube API: ${response.status}`);

      const data = (await response.json()) as { items?: YouTubeSearchItem[] };
      return data.items ?? [];
    },
    { context: 'YouTube.search', maxAttempts: 3, baseDelayMs: 2000 },
  );
}
