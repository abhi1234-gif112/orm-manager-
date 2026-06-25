import type { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { sendError } from '../utils/apiResponse.js';

export function validate(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    sendError(res, errors.array()[0]?.msg ?? 'Validation error', 422);
    return;
  }
  next();
}
