import type { Response } from 'express';
import type { ApiResponse } from '../types/index.js';

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  const body: ApiResponse<T> = { success: true, data };
  res.status(statusCode).json(body);
}

export function sendError(res: Response, error: string, statusCode = 400): void {
  const body: ApiResponse = { success: false, error };
  res.status(statusCode).json(body);
}

export function sendMessage(res: Response, message: string, statusCode = 200): void {
  const body: ApiResponse = { success: true, message };
  res.status(statusCode).json(body);
}

export function getPaginationParams(query: Record<string, unknown>): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, parseInt(String(query['page'] ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(query['limit'] ?? '20'), 10)));
  return { page, limit, offset: (page - 1) * limit };
}
