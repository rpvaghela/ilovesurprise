import { Request, Response, NextFunction } from 'express';
import * as paymentService from '../services/payment.service';
import { PaymentError } from '../services/payment.service';
import { verifyToken } from '../utils/jwt';

const sendPaymentError = (error: unknown, res: Response, next: NextFunction) => {
  if (error instanceof PaymentError) {
    res.status(error.statusCode).json({ status: 'error', message: error.message });
    return;
  }
  next(error);
};

import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { hashPassword } from '../utils/hash';
import { UserRole } from '@prisma/client';

export const createCheckout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let userId = req.user?.id;
    if (!userId) {
      const guestEmail = (req.body.shippingAddress?.email || '').toLowerCase().trim();
      if (!guestEmail) {
        res.status(400).json({ status: 'error', message: 'Email address is required for checkout.' });
        return;
      }
      let guestUser = await prisma.user.findUnique({ where: { email: guestEmail } });
      if (!guestUser) {
        const nameParts = (req.body.shippingAddress?.fullName || 'Customer').trim().split(' ');
        const passwordHash = await hashPassword(crypto.randomUUID());
        guestUser = await prisma.user.create({
          data: {
            email: guestEmail,
            passwordHash,
            firstName: nameParts[0] || 'Customer',
            lastName: nameParts.slice(1).join(' ') || null,
            role: UserRole.CUSTOMER,
            isActive: true,
          },
        });
      }
      userId = guestUser.id;
    }

    let affiliateId: string | null = null;
    try {
      const referral = verifyToken<{ id: string; purpose: string }>(req.cookies?.ils_affiliate_id || '');
      if (referral?.purpose === 'referral') affiliateId = referral.id;
    } catch { /* Expired or tampered referral cookies do not attribute new orders. */ }
    const result = await paymentService.createCheckout(userId, req.body, req.get('origin'), affiliateId, Boolean(req.user));
    res.status(201).json({ status: 'success', data: result });
  } catch (error) {
    sendPaymentError(error, res, next);
  }
};

export const getPaymentStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId =
      typeof req.query.session_id === 'string'
        ? req.query.session_id
        : typeof req.query.sessionId === 'string'
          ? req.query.sessionId
          : undefined;
    const result = await paymentService.getPaymentStatus(String(req.params.orderId), req.user?.id, sessionId);
    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    sendPaymentError(error, res, next);
  }
};

/** Stripe webhook. Needs the raw request body for signature verification. */
export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    await paymentService.handleWebhook(req.body as Buffer, req.header('stripe-signature'));
    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[payments] Webhook rejected:', error?.message);
    res.status(400).json({ status: 'error', message: 'Webhook verification failed' });
  }
};

export const paymentController = { createCheckout, getPaymentStatus, handleWebhook };
