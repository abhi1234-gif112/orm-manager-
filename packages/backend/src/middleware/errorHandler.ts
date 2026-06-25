import type { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';
import { Prisma } from '@prisma/client';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Prisma constraint violations
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ success: false, error: 'Resource already exists' });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ success: false, error: 'Resource not found' });
      return;
    }
  }

  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).json({
    success: false,
    error:
      process.env['NODE_ENV'] === 'production' ? 'Internal server error' : err.message,
  });
}
