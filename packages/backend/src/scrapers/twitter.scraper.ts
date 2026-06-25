import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import { withRetry } from '../utils/retry.js';
import { aiQueue } from '../jobs/queues.js';
import { env } from '../config/env.js';
import type { MentionSource } from '@prisma/client';

interface TwitterSearchResult {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  public_metrics: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    impression_count: number;
  };
}

interface TwitterUser {
  id: string;
  name: string;
  username: string;
  public_metrics: { followers_count: number };
  verified: boolean;
}

export async function runTwitterIngestion(configId: string): Promise<void> {
  const config = await prisma.ingestionConfig.findUnique({
    where: { id: configId },
    include: { client: { select: { id: true, name: true, keywords: true } } },
  });

  if (!config || !config.isActive) return;
  if (!env.TWITTER_BEARER_TOKEN) {
    logger.warn('Twitter bearer token not configured, skipping');
    return;
  }

  const { query, maxResults = 50 } = config.config as { query: string; maxResults?: number };

  try {
    const tweets = await searchRecentTweets(query, maxResults);
    let ingested = 0;

    for (const tweet of tweets) {
      const existing = await prisma.mention.findUnique({
        where: { source_sourceId: { source: 'TWITTER', sourceId: tweet.id } },
      });
      if (existing) continue;

      const mention = await prisma.mention.create({
        data: {
          clientId: config.clientId,
          source: 'TWITTER' as MentionSource,
          sourceId: tweet.id,
          sourceUrl: `https://twitter.com/i/web/status/${tweet.id}`,
          authorHandle: tweet.user?.username,
          authorName: tweet.user?.name,
          authorFollowers: tweet.user?.public_metrics.followers_count ?? 0,
          authorVerified: tweet.user?.verified ?? false,
          platform: 'twitter',
          contentOriginal: tweet.text,
          likes: tweet.public_metrics.like_count,
          shares: tweet.public_metrics.retweet_count,
          comments: tweet.public_metrics.reply_count,
          views: tweet.public_metrics.impression_count,
          reachEstimate: tweet.public_metrics.impression_count,
          publishedAt: new Date(tweet.created_at),
        },
      });

      // Queue for Claude AI analysis
      await aiQueue.add('ai.analyze.mention', {
        mentionId: mention.id,
        clientId: config.clientId,
      });
      ingested++;
    }

    await prisma.ingestionConfig.update({
      where: { id: configId },
      data: { lastRunAt: new Date(), lastRunStatus: `OK: ${ingested} new tweets`, errorCount: 0 },
    });

    logger.info('Twitter ingestion complete', { configId, ingested });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await prisma.ingestionConfig.update({
      where: { id: configId },
      data: {
        lastRunAt: new Date(),
        lastRunStatus: `ERROR: ${error}`,
        errorCount: { increment: 1 },
      },
    });
    throw err;
  }
}

async function searchRecentTweets(
  query: string,
  maxResults: number,
): Promise<(TwitterSearchResult & { user?: TwitterUser })[]> {
  return withRetry(
    async () => {
      const params = new URLSearchParams({
        query,
        max_results: String(Math.min(100, maxResults)),
        'tweet.fields': 'created_at,public_metrics,author_id',
        'user.fields': 'name,username,public_metrics,verified',
        expansions: 'author_id',
      });

      const response = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
        headers: { Authorization: `Bearer ${env.TWITTER_BEARER_TOKEN}` },
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const error = new Error('Twitter rate limit exceeded') as Error & { response: Response };
        error.response = response;
        throw error;
      }

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        data?: TwitterSearchResult[];
        includes?: { users?: TwitterUser[] };
      };

      const tweets = data.data ?? [];
      const users = data.includes?.users ?? [];
      const userMap = new Map(users.map((u) => [u.id, u]));

      return tweets.map((t) => ({ ...t, user: userMap.get(t.author_id) }));
    },
    { context: 'Twitter.searchRecentTweets', maxAttempts: 4, baseDelayMs: 5000 },
  );
}
