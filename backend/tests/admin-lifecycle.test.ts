import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { signToken } from '../src/utils/jwt';

const app = createApp();
const prefix = crypto.randomUUID();
let adminToken: string;
let memberId: string, membershipId: string, profileId: string, planId: string;

beforeAll(async () => {
  const admin = await prisma.user.create({ data: {
    email: `admin-lifecycle-${prefix}@example.test`, passwordHash: 'unused', role: 'ADMIN',
  } });
  adminToken = signToken({ id: admin.id, email: admin.email, role: admin.role });
  const member = await prisma.user.create({ data: { email: `member-${prefix}@example.test`, passwordHash: 'unused' } });
  memberId = member.id;
});

describe('Persisted staff accounts', () => {
  it('creates credentials, edits the account, then revokes existing sessions on removal', async () => {
    const email = `staff-${prefix}@example.test`;
    const created = await request(app).post('/api/admin/staff').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Local Staff', email, password: 'OnlyForIsolatedTests123!', role: 'store_manager' });
    expect(created.status).toBe(201);
    expect(created.body.data.role).toBe('STAFF');
    const id = created.body.data.id;
    const login = await request(app).post('/api/auth/login').send({ email, password: 'OnlyForIsolatedTests123!' });
    expect(login.status).toBe(200);
    const staffToken = login.body.data.token;
    expect((await request(app).patch(`/api/admin/staff/${id}`).set('Authorization', `Bearer ${staffToken}`)
      .send({ role: 'super_admin' })).status).toBe(403);
    expect((await request(app).patch(`/api/admin/staff/${id}`).set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Staff', password: 'UpdatedIsolatedPassword123!' })).status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id } })).firstName).toBe('Updated');
    expect((await request(app).post('/api/auth/login').send({ email, password: 'OnlyForIsolatedTests123!' })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email, password: 'UpdatedIsolatedPassword123!' })).status).toBe(200);
    expect((await request(app).delete(`/api/admin/staff/${id}`).set('Authorization', `Bearer ${adminToken}`)).status).toBe(200);
    const removed = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(removed.isActive).toBe(false);
    expect(removed.role).toBe('CUSTOMER');
    expect((await request(app).get('/api/admin/users').set('Authorization', `Bearer ${staffToken}`)).status).toBe(401);
  });

  it('cannot demote the protected primary administrator through the staff-create upsert', async () => {
    const email = 'ilovesurprisedotcom@gmail.com';
    const primary = await prisma.user.upsert({ where: { email }, update: {}, create: {
      email, passwordHash: 'isolated-fixture-not-a-live-account', role: 'ADMIN',
    } });
    const response = await request(app).post('/api/admin/staff').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Protected Admin Fixture', email, password: 'IsolatedFixturePassword123!', role: 'store_manager' });
    expect(response.status).toBe(201);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: primary.id } })).role).toBe('ADMIN');
  });
});

describe('Membership and representative synchronization', () => {
  it('assigns a plan and maintains one representative profile under concurrent assignment', async () => {
    const plans = await request(app).get('/api/memberships/plans');
    planId = plans.body.plans[0].id;
    const responses = await Promise.all([0, 1].map(() => request(app).post('/api/admin/memberships')
      .set('Authorization', `Bearer ${adminToken}`).send({ userId: memberId, planId, status: 'ACTIVE' })));
    expect(responses.map(r => r.status)).toEqual([201, 201]);
    expect(responses[0].body.data.membership.id).toBe(responses[1].body.data.membership.id);
    membershipId = responses[0].body.data.membership.id;
    const profile = await prisma.affiliate_profiles.findUniqueOrThrow({ where: { userId: memberId } });
    profileId = profile.id;
    expect(profile.isActive).toBe(true);
  });

  it('suspends representative access together with the membership and reactivates the same profile', async () => {
    const url = `/api/admin/memberships/${membershipId}/status`;
    expect((await request(app).patch(url).set('Authorization', `Bearer ${adminToken}`).send({ status: 'suspended' })).status).toBe(200);
    expect((await prisma.affiliate_profiles.findUniqueOrThrow({ where: { id: profileId } })).isActive).toBe(false);
    expect((await request(app).patch(url).set('Authorization', `Bearer ${adminToken}`).send({ status: 'active' })).status).toBe(200);
    expect((await prisma.affiliate_profiles.findUniqueOrThrow({ where: { id: profileId } })).isActive).toBe(true);
  });

  it('cancels without deleting membership, genealogy, or representative history', async () => {
    expect((await request(app).delete(`/api/admin/memberships/${membershipId}`).set('Authorization', `Bearer ${adminToken}`)).status).toBe(200);
    const membership = await prisma.user_memberships.findUniqueOrThrow({ where: { id: membershipId } });
    expect(membership.status).toBe('CANCELLED');
    expect(membership.autoRenew).toBe(false);
    expect((await prisma.affiliate_profiles.findUniqueOrThrow({ where: { id: profileId } })).isActive).toBe(false);
  });

  it('does not reactivate an expired membership without assigning a new period', async () => {
    await prisma.user_memberships.update({ where: { id: membershipId }, data: { endDate: new Date('2020-01-01') } });
    expect((await request(app).patch(`/api/admin/memberships/${membershipId}/status`)
      .set('Authorization', `Bearer ${adminToken}`).send({ status: 'active' })).status).toBe(409);
    expect((await prisma.user_memberships.findUniqueOrThrow({ where: { id: membershipId } })).status).toBe('CANCELLED');
    expect((await prisma.affiliate_profiles.findUniqueOrThrow({ where: { id: profileId } })).isActive).toBe(false);
  });
});
