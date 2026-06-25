import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { sendError } from '../utils/apiResponse.js';
import type { UserRole } from '@prisma/client';

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  name: string;
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    sendError(res, 'Authentication required', 401);
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = { id: payload.sub, email: payload.email, role: payload.role, name: payload.name };
    next();
  } catch {
    sendError(res, 'Invalid or expired token', 401);
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      sendError(res, 'Insufficient permissions', 403);
      return;
    }
    next();
  };
}
