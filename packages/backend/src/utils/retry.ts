import { logger } from '../config/logger.js';

/**
 * Exponential backoff retry with jitter.
 * Handles API rate limits from Twitter, Meta, YouTube, etc.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    context?: string;
  } = {},
): Promise<T> {
  const {
    maxAttempts = 4,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    context = 'operation',
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt === maxAttempts) break;

      // Respect Retry-After headers from rate limit responses
      const retryAfter = extractRetryAfter(lastError);
      const delay = retryAfter
        ? retryAfter * 1000
        : Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1) + Math.random() * 1000);

      logger.warn(`${context} failed (attempt ${attempt}/${maxAttempts}), retrying in ${Math.round(delay)}ms`, {
        error: lastError.message,
      });

      await sleep(delay);
    }
  }

  throw lastError;
}

function extractRetryAfter(err: Error): number | null {
  // Some HTTP clients attach the response to the error object
  const anyErr = err as Record<string, unknown>;
  const headers = anyErr['response'] as Record<string, Record<string, string>> | undefined;
  const retryAfter = headers?.['headers']?.['retry-after'];
  return retryAfter ? parseInt(retryAfter, 10) : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
