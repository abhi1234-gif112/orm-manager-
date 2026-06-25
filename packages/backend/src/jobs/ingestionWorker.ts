import { Worker } from 'bullmq';
import { bullMQConnection } from '../config/redis.js';
import { logger } from '../config/logger.js';
import { runTwitterIngestion } from '../scrapers/twitter.scraper.js';
import { runNewsIngestion } from '../scrapers/news.scraper.js';
import { runYouTubeIngestion } from '../scrapers/youtube.scraper.js';
import { runTelegramIngestion } from '../scrapers/telegram.scraper.js';
import { runRedditIngestion } from '../scrapers/reddit.scraper.js';

export function startIngestionWorker(): Worker {
  const worker = new Worker(
    'ingestion',
    async (job) => {
      const { configId } = job.data as { configId: string };

      switch (job.name) {
        case 'ingest.twitter':
          await runTwitterIngestion(configId);
          break;
        case 'ingest.news.hindi':
        case 'ingest.news.english':
          await runNewsIngestion(configId);
          break;
        case 'ingest.youtube':
          await runYouTubeIngestion(configId);
          break;
        case 'ingest.telegram':
          await runTelegramIngestion(configId);
          break;
        case 'ingest.reddit':
          await runRedditIngestion(configId);
          break;
        default:
          logger.warn('Unknown ingestion job', { name: job.name });
      }
    },
    {
      connection: bullMQConnection,
      concurrency: 3,
    },
  );

  worker.on('failed', (job, err) =>
    logger.error('Ingestion job failed', { jobId: job?.id, name: job?.name, error: err.message }),
  );

  logger.info('Ingestion worker started');
  return worker;
}
