import { Router } from 'express';
import { body } from 'express-validator';
import { prisma } from '../config/prisma.js';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  storeRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from '../services/auth.service.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

const router = Router();

// POST /api/auth/register (SUPER_ADMIN only — seeded)
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').trim().notEmpty(),
    body('role').optional().isIn(['SUPER_ADMIN', 'ADMIN', 'ANALYST', 'VIEWER']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, password, name, role } = req.body as {
        email: string;
        password: string;
        name: string;
        role?: string;
      };

      const exists = await prisma.user.findUnique({ where: { email } });
      if (exists) return sendError(res, 'Email already registered', 409);

      const passwordHash = await hashPassword(password);
      const user = await prisma.user.create({
        data: { email, passwordHash, name, role: (role as 'ADMIN') ?? 'ANALYST' },
      });

      sendSuccess(res, { id: user.id, email: user.email, name: user.name, role: user.role }, 201);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/auth/login
router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const { email, password } = req.body as { email: string; password: string };

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.isActive) return sendError(res, 'Invalid credentials', 401);

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) return sendError(res, 'Invalid credentials', 401);

      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

      const accessToken = signAccessToken(user.id, user.email, user.role, user.name);
      const refreshToken = signRefreshToken(user.id);
      await storeRefreshToken(user.id, refreshToken);

      sendSuccess(res, {
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/auth/refresh
router.post('/refresh', [body('refreshToken').notEmpty()], validate, async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    const tokens = await rotateRefreshToken(refreshToken);
    if (!tokens) return sendError(res, 'Invalid or expired refresh token', 401);
    sendSuccess(res, tokens);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (refreshToken) await revokeRefreshToken(refreshToken);
    sendSuccess(res, null);
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, name: true, role: true, lastLoginAt: true, createdAt: true },
    });
    if (!user) return sendError(res, 'User not found', 404);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
});

export default router;
