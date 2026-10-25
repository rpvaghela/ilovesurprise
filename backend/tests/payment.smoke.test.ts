import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { PaymentMethod, PaymentStatus, UserRole } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

const app = createApp();

describe('payments API smoke', () => {
  it('validates checkout payload before starting an order', async () => {
    const res = await request(app).post('/api/payments/checkout').send({});
    expect(res.status).toBe(400);
  });

  it('does not expose unknown payment status records', async () => {
    const res = await request(app).get('/api/payments/orders/x/status');
    expect(res.status).toBe(404);
  });

  it('allows guest payment status only with the original Stripe session id', async () => {
    const id = `pay_smoke_${Date.now()}`;
    const userId = `${id}_user`;
    const orderId = `${id}_order`;
    const sessionId = `cs_test_${id}`;

    await prisma.user.create({
      data: {
        id: userId,
        email: `${id}@example.com`,
        passwordHash: 'not-used',
        firstName: 'Guest',
        lastName: 'Checkout',
        role: UserRole.CUSTOMER,
        isActive: true,
      },
    });
    await prisma.orders.create({
      data: {
        id: orderId,
        orderNumber: `ILS-${id}`,
        userId,
        status: 'CONFIRMED',
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.STRIPE,
        currency: 'USD',
        subtotal: 10,
        shippingFee: 0,
        discountAmount: 0,
        totalAmount: 10,
        shippingAddressSnapshot: {
          fullName: 'Guest Checkout',
          email: `${id}@example.com`,
          phone: '555-111-2222',
          addressLine1: '1 Test Way',
          city: 'Testville',
          state: 'CA',
          zipCode: '90210',
          country: 'US',
          deliveryMethodId: 'standard',
        },
        updatedAt: new Date(),
      },
    });
    await prisma.payment_transactions.create({
      data: {
        id: `${id}_txn`,
        orderId,
        paymentMethod: PaymentMethod.STRIPE,
        amount: 10,
        currency: 'USD',
        status: PaymentStatus.PAID,
        gatewayResponse: { checkoutSessionId: sessionId },
        updatedAt: new Date(),
      },
    });

    try {
      const blocked = await request(app).get(`/api/payments/orders/${orderId}/status?session_id=wrong`);
      expect(blocked.status).toBe(401);

      const allowed = await request(app).get(`/api/payments/orders/${orderId}/status?session_id=${sessionId}`);
      expect(allowed.status).toBe(200);
      expect(allowed.body.data.status).toBe('paid');
      expect(allowed.body.data.order.id).toBe(orderId);
    } finally {
      await prisma.orders.deleteMany({ where: { id: orderId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  });

  it('rejects an unsigned webhook', async () => {
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ type: 'checkout.session.completed' }));
    expect(res.status).toBe(400);
  });
});
