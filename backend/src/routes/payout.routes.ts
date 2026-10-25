import { Router } from 'express';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { adminLimiter } from '../middlewares/rateLimit.middleware';
import * as payouts from '../services/payout.service';
import { config } from '../config/env';
import type { RequestHandler } from 'express';

const requirePayouts: RequestHandler = (_req, res, next) => {
  if (!config.payoutsEnabled) { res.status(503).json({ status: 'error', message: 'Payout requests are not enabled yet.' }); return; }
  next();
};

const listSchema = z.object({ query: z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  status: z.enum(['PENDING', 'APPROVED', 'HELD', 'PAID', 'REJECTED', 'CANCELLED']).optional(),
}) });
const requestSchema = z.object({ body: z.object({
  requestId: z.uuid(), amount: z.number().finite().min(25).max(99999999.99)
    .refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001, 'Amount must use cents'),
  method: z.enum(['paypal', 'bank_transfer', 'venmo', 'check']),
  destination: z.string().trim().min(3).max(500),
}) });
const updateSchema = z.object({ body: z.object({
  status: z.enum(['APPROVED', 'HELD', 'PAID', 'REJECTED']),
  note: z.string().trim().max(1000).optional(), referenceId: z.string().trim().min(3).max(150).optional(),
}) });

export const representativePayoutRouter = Router();
representativePayoutRouter.use(authenticate, adminLimiter, requirePayouts);
representativePayoutRouter.get('/', validateRequest(listSchema), async (req, res, next) => {
  try { res.json({ status: 'success', data: await payouts.listPayouts(req.user!.id, Number(req.query.page), req.query.status as string | undefined) }); }
  catch (error) { next(error); }
});
representativePayoutRouter.post('/', validateRequest(requestSchema), async (req, res, next) => {
  try { res.status(201).json({ status: 'success', data: await payouts.requestPayout(req.user!.id, req.body) }); }
  catch (error) { next(error); }
});
representativePayoutRouter.post('/:id/cancel', async (req, res, next) => {
  try { res.json({ status: 'success', data: await payouts.updatePayout(String(req.params.id), req.user!.id,
    { status: 'CANCELLED', note: 'Cancelled by representative' }, req.user!.id) }); }
  catch (error) { next(error); }
});

export const adminPayoutRouter = Router();
adminPayoutRouter.use(authenticate, requireRole(UserRole.ADMIN), adminLimiter, requirePayouts);
adminPayoutRouter.get('/', validateRequest(listSchema), async (req, res, next) => {
  try { res.json({ status: 'success', data: await payouts.listPayouts(null, Number(req.query.page), req.query.status as string | undefined) }); }
  catch (error) { next(error); }
});
adminPayoutRouter.patch('/:id', validateRequest(updateSchema), async (req, res, next) => {
  try { res.json({ status: 'success', data: await payouts.updatePayout(String(req.params.id), req.user!.id, req.body) }); }
  catch (error) { next(error); }
});
