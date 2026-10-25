import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { UserRole } from '@prisma/client';
const { findUser, verify } = vi.hoisted(() => ({ findUser: vi.fn(), verify: vi.fn() }));
vi.mock('../src/lib/prisma', () => ({ prisma: { user: { findUnique: findUser } } }));
vi.mock('../src/utils/jwt', () => ({ verifyToken: verify, signToken: vi.fn() }));
import { createApp } from '../src/app';
const app = createApp();

beforeEach(() => {
  vi.resetAllMocks();
  verify.mockReturnValue({ id: 'staff' });
  findUser.mockResolvedValue({ id: 'staff', email: 'staff@example.com', role: UserRole.STAFF, isActive: true });
});

describe('Sensitive server permissions', () => {
  it.each([
    ['get', '/api/admin/settings'], ['get', '/api/admin/store-settings'],
    ['get', '/api/admin/system-settings'], ['put', '/api/admin/settings'],
    ['patch', '/api/admin/system-settings'], ['post', '/api/admin/settings/reset'],
    ['patch', '/api/admin/users/owner/role'], ['patch', '/api/admin/users/owner'],
    ['post', '/api/admin/staff'], ['delete', '/api/admin/staff/owner'],
    ['post', '/api/admin/commission/ledger/batch-approve'],
    ['patch', '/api/admin/commission/ledger/entry/status'],
    ['post', '/api/commission/process-order/order'], ['post', '/api/commission/refund-order/order'],
    ['get', '/api/settings'],
  ])('rejects staff access to %s %s', async (method, path) => {
    const response = await (request(app) as any)[method](path).set('Authorization', 'Bearer staff-token').send({});
    expect(response.status).toBe(403);
  });
  it.each(['/api/upload', '/api/storefront/upload', '/api/storefront/upload-image'])('rejects anonymous uploads at %s before parsing files', async path => {
    expect((await request(app).post(path).send({})).status).toBe(401);
  });
  it.each(['/api/upload', '/api/storefront/upload', '/api/storefront/upload-image'])('rejects customer uploads at %s before parsing files', async path => {
    findUser.mockResolvedValue({ id: 'customer', email: 'customer@example.test', role: UserRole.CUSTOMER, isActive: true });
    expect((await request(app).post(path).set('Authorization', 'Bearer customer-token').send({})).status).toBe(403);
  });
  it.each(['password_reset', 'referral'])('does not accept a %s token as an authenticated session', async (purpose) => {
    verify.mockReturnValue({ id: 'owner', purpose });
    const response = await request(app).get('/api/admin/users').set('Authorization', 'Bearer purpose-token');
    expect(response.status).toBe(401);
    expect(findUser).not.toHaveBeenCalled();
  });
});
