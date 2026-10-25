import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Standard JSON response handler when a rate limit is exceeded.
 */
const createRateLimitHandler = (message: string) => {
  return (_req: Request, res: Response) => {
    const retryAfter = res.getHeader('Retry-After') || 900;
    res.status(429).json({
      status: 'error',
      error: 'Too Many Requests',
      message,
      retryAfterSeconds: Number(retryAfter) || 900,
    });
  };
};

/**
 * Helper to determine if the request is running in local development or test mode,
 * or originating from loopback / localhost addresses.
 */
export const isLocalOrDev = (req: Request): boolean => {
  if (process.env.NODE_ENV === 'test') return true;
  if (process.env.NODE_ENV !== 'production') return true;
  const ip = req.ip || req.socket.remoteAddress || '';
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip === 'localhost'
  );
};

/**
 * 1. Global API Rate Limiter
 * Applies across all /api routes to protect against DDoS and aggressive scraping.
 * Window: 15 minutes.
 * Max: 3,000 requests per IP (Production). Bypassed in dev/localhost.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many requests from this IP address. Please slow down and try again later.'
  ),
  skip: (req: Request) => req.path === '/health' || isLocalOrDev(req),
});

/**
 * 2. Authentication Rate Limiter
 * Applied to:
 * - POST /api/auth/login (brute-force credential stuffing protection)
 * - POST /api/auth/register (spam signup prevention)
 * - POST /api/auth/forgot-password (reset email spam prevention)
 * - POST /api/auth/reset-password (reset token attack prevention)
 * Window: 15 minutes.
 * Max: 60 attempts per IP (Production). Bypassed in dev/localhost.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many authentication attempts from this IP. Please wait a few moments before trying again.'
  ),
  skip: (req: Request) => isLocalOrDev(req),
});

/**
 * 3. Checkout & Payment Rate Limiter
 * Protects credit card testing and automated purchase attempts.
 * Window: 15 minutes.
 * Max: 60 checkout attempts per IP (Production). Bypassed in dev/localhost.
 */
export const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many payment or checkout attempts. Please wait a few moments before retrying.'
  ),
  skip: (req: Request) => isLocalOrDev(req),
});

/**
 * 4. Appraisal Code Lookup Rate Limiter
 * Protects against appraisal code harvesting and dictionary attacks.
 * Window: 15 minutes.
 * Max: 150 lookups per IP (Production). Bypassed in dev/localhost.
 */
export const appraisalLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many jewelry appraisal code lookups. Please wait a few moments before trying again.'
  ),
  skip: (req: Request) => isLocalOrDev(req),
});

/**
 * 5. Admin Sensitive Actions Rate Limiter
 * Applies to write operations (POST, PUT, DELETE, PATCH) on /api/admin.
 * Window: 15 minutes.
 * Max: 500 mutations per IP (Production). Bypassed in dev/localhost.
 */
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many administrative actions from this IP. Please wait a few moments before trying again.'
  ),
  skip: (req: Request) => req.method === 'GET' || isLocalOrDev(req),
});
