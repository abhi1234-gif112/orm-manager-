import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import type { UserRole } from '@prisma/client';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(userId: string, email: string, role: UserRole, name: string): string {
  return jwt.sign({ sub: userId, email, role, name }, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL,
  });
}

export async function storeRefreshToken(userId: string, token: string): Promise<void> {
  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
}

export async function rotateRefreshToken(
  oldToken: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const stored = await prisma.refreshToken.findUnique({ where: { token: oldToken }, include: { user: true } });
  if (!stored || stored.expiresAt < new Date()) return null;

  // Delete old token (rotation)
  await prisma.refreshToken.delete({ where: { token: oldToken } });

  const { user } = stored;
  const accessToken = signAccessToken(user.id, user.email, user.role, user.name);
  const refreshToken = signRefreshToken(user.id);
  await storeRefreshToken(user.id, refreshToken);

  return { accessToken, refreshToken };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { token } });
}
