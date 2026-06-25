import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import { withRetry } from '../utils/retry.js';
import { aiQueue } from '../jobs/queues.js';

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  score: number;
  num_comments: number;
  url: string;
  permalink: string;
  created_utc: number;
  subreddit: string;
}

export async function runRedditIngestion(configId: string): Promise<void> {
  const config = await prisma.ingestionConfig.findUnique({
    where: { id: configId },
    include: { client: { select: { id: true, name: true, keywords: true } } },
  });

  if (!config || !config.isActive) return;

  const { subreddit, query } = config.config as { subreddit?: string; query?: string };
  const searchQuery = query ?? config.client.keywords[0] ?? config.client.name;

  try {
    const posts = await searchReddit(searchQuery, subreddit);
    let ingested = 0;

    for (const post of posts) {
      const existing = await prisma.mention.findUnique({
        where: { source_sourceId: { source: 'REDDIT', sourceId: post.id } },
      });
      if (existing) continue;

      const content = `${post.title}\n\n${post.selftext}`.trim();
      if (!content) continue;

      const mention = await prisma.mention.create({
        data: {
          clientId: config.clientId,
          source: 'REDDIT',
          sourceId: post.id,
          sourceUrl: `https://reddit.com${post.permalink}`,
          authorHandle: post.author,
          platform: `reddit.com/r/${post.subreddit}`,
          contentOriginal: content,
          likes: post.score,
          comments: post.num_comments,
          publishedAt: new Date(post.created_utc * 1000),
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
      data: { lastRunAt: new Date(), lastRunStatus: `OK: ${ingested} new posts`, errorCount: 0 },
    });

    logger.info('Reddit ingestion complete', { configId, ingested });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await prisma.ingestionConfig.update({
      where: { id: configId },
      data: { lastRunStatus: `ERROR: ${error}`, errorCount: { increment: 1 } },
    });
    throw err;
  }
}

async function searchReddit(query: string, subreddit?: string): Promise<RedditPost[]> {
  return withRetry(
    async () => {
      const base = subreddit ? `https://www.reddit.com/r/${subreddit}/search.json` : 'https://www.reddit.com/search.json';
      const params = new URLSearchParams({
        q: query,
        sort: 'new',
        limit: '25',
        t: 'week',
        restrict_sr: subreddit ? '1' : '0',
      });

      const response = await fetch(`${base}?${params}`, {
        headers: { 'User-Agent': 'NazarPoliticalMonitor/1.0' },
      });

      if (response.status === 429) throw new Error('Reddit rate limit');
      if (!response.ok) throw new Error(`Reddit API: ${response.status}`);

      const data = (await response.json()) as {
        data?: { children?: Array<{ data: RedditPost }> };
      };

      return (data.data?.children ?? []).map((c) => c.data);
    },
    { context: `Reddit:${query}`, maxAttempts: 3, baseDelayMs: 3000 },
  );
}
