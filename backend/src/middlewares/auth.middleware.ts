import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { prisma } from '../lib/prisma';
import { AuthUserPayload } from '../types/express';

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        status: 'error',
        success: false,
        message: 'Authentication token missing or invalid',
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken<AuthUserPayload & { purpose?: string }>(token);

    if (!payload || !payload.id || payload.purpose) {
      res.status(401).json({
        status: 'error',
        success: false,
        message: 'Invalid or expired token',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      res.status(401).json({
        status: 'error',
        success: false,
        message: 'User account not found or deactivated',
      });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuthenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken<AuthUserPayload & { purpose?: string }>(token);

    if (payload && payload.id && !payload.purpose) {
      const user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: { id: true, email: true, role: true, isActive: true },
      });

      if (user && user.isActive) {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
        };
      }
    }

    next();
  } catch {
    next();
  }
};
