import * as cheerio from 'cheerio';
import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import { withRetry } from '../utils/retry.js';
import { aiQueue } from '../jobs/queues.js';
import type { MentionSource } from '@prisma/client';

// Supported news portal configurations
const NEWS_PORTAL_CONFIG: Record<string, {
  articleSelector: string;
  titleSelector: string;
  textSelector: string;
  linkSelector: string;
  dateSelector: string;
}> = {
  'ndtv.com': {
    articleSelector: '.news_Itm',
    titleSelector: '.newsHdng a',
    textSelector: '.newsCont',
    linkSelector: '.newsHdng a',
    dateSelector: '.posted-on',
  },
  'aajtak.in': {
    articleSelector: '.widget-story-list__item',
    titleSelector: 'h3 a',
    textSelector: '.intro',
    linkSelector: 'h3 a',
    dateSelector: 'time',
  },
  'thehindu.com': {
    articleSelector: '.story-card',
    titleSelector: 'h3 a',
    textSelector: '.intro',
    linkSelector: 'h3 a',
    dateSelector: '.dateline',
  },
  'hindustantimes.com': {
    articleSelector: '.storyShortDetail',
    titleSelector: 'h3 a',
    textSelector: '.detail',
    linkSelector: 'h3 a',
    dateSelector: '.dateTime',
  },
  'indiatoday.in': {
    articleSelector: '.story-with-img',
    titleSelector: 'h2 a',
    textSelector: '.story-kicker',
    linkSelector: 'h2 a',
    dateSelector: '.date-display-single',
  },
};

export async function runNewsIngestion(configId: string): Promise<void> {
  const config = await prisma.ingestionConfig.findUnique({
    where: { id: configId },
    include: { client: { select: { id: true, name: true, keywords: true } } },
  });

  if (!config || !config.isActive) return;

  const { url, source } = config.config as {
    url: string;
    source: MentionSource;
  };

  try {
    const articles = await scrapeNewsPortal(url, config.client.keywords);
    let ingested = 0;

    for (const article of articles) {
      const existing = await prisma.mention.findUnique({
        where: { source_sourceId: { source, sourceId: article.url } },
      });
      if (existing) continue;

      const mention = await prisma.mention.create({
        data: {
          clientId: config.clientId,
          source,
          sourceId: article.url,
          sourceUrl: article.url,
          platform: new URL(url).hostname,
          contentOriginal: `${article.title}\n\n${article.text}`,
          publishedAt: article.publishedAt,
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
      data: { lastRunAt: new Date(), lastRunStatus: `OK: ${ingested} new articles`, errorCount: 0 },
    });

    logger.info('News ingestion complete', { configId, ingested, url });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await prisma.ingestionConfig.update({
      where: { id: configId },
      data: { lastRunStatus: `ERROR: ${error}`, errorCount: { increment: 1 } },
    });
    throw err;
  }
}

async function scrapeNewsPortal(
  url: string,
  keywords: string[],
): Promise<{ url: string; title: string; text: string; publishedAt: Date | null }[]> {
  return withRetry(
    async () => {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; NazarBot/1.0; political news aggregator)',
          'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);

      const html = await response.text();
      const $ = cheerio.load(html);

      const hostname = new URL(url).hostname.replace('www.', '');
      const portalConfig = NEWS_PORTAL_CONFIG[hostname];

      const articles: { url: string; title: string; text: string; publishedAt: Date | null }[] = [];

      if (portalConfig) {
        $(portalConfig.articleSelector).each((_, el) => {
          const title = $(el).find(portalConfig.titleSelector).text().trim();
          const text = $(el).find(portalConfig.textSelector).text().trim();
          const href = $(el).find(portalConfig.linkSelector).attr('href') ?? '';
          const dateStr = $(el).find(portalConfig.dateSelector).attr('datetime') ??
            $(el).find(portalConfig.dateSelector).text().trim();

          const articleUrl = href.startsWith('http') ? href : new URL(href, url).href;
          const content = `${title} ${text}`.toLowerCase();

          // Only include if it mentions our client keywords
          const relevant = keywords.some((kw) => content.includes(kw.toLowerCase()));
          if (relevant && title) {
            articles.push({
              url: articleUrl,
              title,
              text,
              publishedAt: dateStr ? new Date(dateStr) : null,
            });
          }
        });
      } else {
        // Fallback: extract all anchor tags with keyword matches
        $('a').each((_, el) => {
          const text = $(el).text().trim();
          const href = $(el).attr('href') ?? '';
          if (!href || !text || text.length < 20) return;

          const lower = text.toLowerCase();
          const relevant = keywords.some((kw) => lower.includes(kw.toLowerCase()));
          if (relevant) {
            const articleUrl = href.startsWith('http') ? href : new URL(href, url).href;
            articles.push({ url: articleUrl, title: text, text: '', publishedAt: null });
          }
        });
      }

      return articles.slice(0, 30); // Cap per run to avoid overwhelming AI queue
    },
    { context: `scrapeNewsPortal:${url}`, maxAttempts: 3, baseDelayMs: 2000 },
  );
}
