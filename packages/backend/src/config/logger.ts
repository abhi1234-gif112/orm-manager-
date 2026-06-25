import winston from 'winston';
import { env } from './env.js';

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    errors({ stack: true }),
    timestamp(),
    json(),
  ),
  transports: [
    new winston.transports.Console({
      format:
        env.NODE_ENV === 'production'
          ? combine(timestamp(), json())
          : combine(colorize(), simple()),
    }),
  ],
});
