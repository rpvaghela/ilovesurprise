import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { UserRole, Prisma } from '@prisma/client';
import {
  AffiliateDashboardStatsDTO,
  AffiliateProfileDTO,
  GenealogyTreeNode,
  RegisterAffiliateDTO,
} from '../types/affiliate.types';
import { isUsernameRestricted, ensureInitialized } from './settings.service';
import { saveBase64Image } from '../middlewares/upload.middleware';
import { config } from '../config/env';
import { reservedPayoutAmount } from './payout.service';

export const RESERVED_USERNAMES = new Set([
  'admin',
  'api',
  'auth',
  'cart',
  'checkout',
  'orders',
  'products',
  'product',
  'storefront',
  'health',
  'users',
  'user',
  'affiliate',
  'affiliates',
  'support',
  'help',
  'terms',
  'privacy',
  'dashboard',
  'settings',
  'login',
  'register',
  'signup',
  'signin',
  'shop', 'categories', 'collection', 'collections', 'account', 'payment',
  'order-confirmation', 'about', 'faq', 'contact', 'rewards', 'shipping-policy',
  'refund-policy', 'privacy-policy', 'official-rules', 'reset-password',
]);

export function formatAffiliateProfile(profile: any): AffiliateProfileDTO {
  return {
    id: profile.id,
    userId: profile.userId,
    username: profile.username || profile.referralCode,
    referralCode: profile.referralCode,
    slug: profile.slug,
    sponsorId: profile.sponsorId,
    status: profile.status,
    isActive: profile.isActive,
    payoutStatus: profile.payoutStatus,
    lifetimeEarnings: Number(profile.lifetimeEarnings || 0),
    currentBalance: Number(profile.currentBalance || 0),
    pendingBalance: Number(profile.pendingBalance || 0),
    commissionRate: Number(profile.commissionRate || 0.2),
    avatar: profile.users?.avatar || null,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    sponsor: profile.affiliate_profiles
      ? {
          id: profile.affiliate_profiles.id,
          username: profile.affiliate_profiles.username || profile.affiliate_profiles.referralCode,
          referralCode: profile.affiliate_profiles.referralCode,
        }
      : null,
  };
}

/**
 * Resolves an affiliate by their username or referral code.
 * Also logs a visit record in referral_visits.
 */
export async function resolveAffiliateByUsername(
  rawUsername: string,
  visitMetadata?: {
    ipAddress?: string;
    userAgent?: string;
    landingPage?: string;
    referrerUrl?: string;
  }
): Promise<AffiliateProfileDTO | null> {
  const normalized = rawUsername.trim().toLowerCase();

  const affiliate = await prisma.affiliate_profiles.findFirst({
    where: {
      OR: [
        { username: { equals: normalized, mode: 'insensitive' } },
        { referralCode: { equals: normalized, mode: 'insensitive' } },
        { slug: { equals: normalized, mode: 'insensitive' } },
      ],
      isActive: true,
    },
    include: {
      affiliate_profiles: {
        select: { id: true, username: true, referralCode: true },
      },
    },
  });

  if (!affiliate) {
    return null;
  }

  // Record referral visit
  try {
    await prisma.referral_visits.create({
      data: {
        id: crypto.randomUUID(),
        affiliateId: affiliate.id,
        ipAddress: visitMetadata?.ipAddress || null,
        userAgent: visitMetadata?.userAgent || null,
        landingPage: visitMetadata?.landingPage || `/${normalized}`,
        referrerUrl: visitMetadata?.referrerUrl || null,
      },
    });
  } catch (err) {
    console.warn('Failed to record referral visit:', err);
  }

  return formatAffiliateProfile(affiliate);
}

/**
 * Registers a user as an affiliate.
 * Validates unique handle, reserved usernames, and sponsor hierarchy.
 */
export async function registerAffiliate(
  data: RegisterAffiliateDTO
): Promise<AffiliateProfileDTO> {
  const normalizedUsername = data.username.trim().toLowerCase();
  await ensureInitialized();

  // Validate reserved routes and restricted rep usernames configured in system settings
  if (RESERVED_USERNAMES.has(normalizedUsername) || isUsernameRestricted(normalizedUsername)) {
    const error: any = new Error(`Username "${normalizedUsername}" is reserved by the system`);
    error.statusCode = 400;
    throw error;
  }

  // Validate handle format (alphanumeric, hyphens, underscores, 3-30 chars)
  if (!/^[a-z0-9_-]{3,30}$/.test(normalizedUsername)) {
    const error: any = new Error(
      'Username must be between 3 and 30 characters and contain only lowercase letters, numbers, hyphens, or underscores'
    );
    error.statusCode = 400;
    throw error;
  }

  // Check if user is already an affiliate
  const existingAffiliate = await prisma.affiliate_profiles.findUnique({
    where: { userId: data.userId },
  });
  if (existingAffiliate) {
    const error: any = new Error('User is already registered as an affiliate');
    error.statusCode = 409;
    throw error;
  }

  // Check if username is taken
  const existingHandle = await prisma.affiliate_profiles.findFirst({
    where: {
      OR: [
        { username: normalizedUsername },
        { referralCode: normalizedUsername },
        { slug: normalizedUsername },
      ],
    },
  });
  if (existingHandle) {
    const error: any = new Error(`Username "${normalizedUsername}" is already taken`);
    error.statusCode = 409;
    throw error;
  }

  // Resolve sponsor if provided
  let sponsorId: string | null = null;
  if (data.sponsorCodeOrId) {
    const sponsorLookup = data.sponsorCodeOrId.trim().toLowerCase();
    const sponsor = await prisma.affiliate_profiles.findFirst({
      where: {
        OR: [
          { id: data.sponsorCodeOrId },
          { username: sponsorLookup },
          { referralCode: sponsorLookup },
          { slug: sponsorLookup },
        ],
        isActive: true,
      },
    });

    if (sponsor) {
      if (sponsor.userId === data.userId) {
        const error: any = new Error('Self-sponsorship is not permitted');
        error.statusCode = 400;
        throw error;
      }
      sponsorId = sponsor.id;
    }
  }

  // Handle avatar if provided
  let savedAvatarUrl: string | null = null;
  if (data.avatar) {
    if (data.avatar.startsWith('data:image/')) {
      try {
        savedAvatarUrl = await saveBase64Image(data.avatar);
      } catch (e) {
        console.warn('Failed to save base64 avatar on registration:', e);
      }
    } else {
      savedAvatarUrl = data.avatar;
    }
  }

  // Create affiliate profile in PENDING status awaiting Admin approval
  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: data.userId } });
    if (!user) {
      const error: any = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const userUpdate: any = {};
    if (savedAvatarUrl) {
      userUpdate.avatar = savedAvatarUrl;
    }
    if (Object.keys(userUpdate).length > 0) {
      await tx.user.update({
        where: { id: data.userId },
        data: userUpdate,
      });
    }

    return await tx.affiliate_profiles.create({
      data: {
        id: crypto.randomUUID(),
        userId: data.userId,
        username: normalizedUsername,
        referralCode: normalizedUsername,
        slug: normalizedUsername,
        sponsorId,
        status: 'PENDING',
        isActive: false,
        payoutStatus: 'pending',
        payoutMethod: data.payoutMethod || null,
        payoutDetails: data.payoutDetails ?? Prisma.JsonNull,
        updatedAt: new Date(),
      },
      include: {
        affiliate_profiles: {
          select: { id: true, username: true, referralCode: true },
        },
        users: {
          select: { id: true, email: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });
  });

  return formatAffiliateProfile(created);
}

/**
 * Updates an affiliate/representative avatar
 */
export async function updateAffiliateAvatar(userId: string, avatarData: string): Promise<string> {
  let finalUrl = avatarData;
  if (avatarData.startsWith('data:image/')) {
    finalUrl = await saveBase64Image(avatarData);
  }
  await prisma.user.update({
    where: { id: userId },
    data: { avatar: finalUrl } as any,
  });
  return finalUrl;
}

/**
 * Retrieves affiliate dashboard stats and metrics for the logged-in user.
 */
export async function getAffiliateDashboard(
  userId: string
): Promise<AffiliateDashboardStatsDTO> {
  const profile = await prisma.affiliate_profiles.findUnique({
    where: { userId },
    include: {
      affiliate_profiles: {
        select: { id: true, username: true, referralCode: true },
      },
    },
  });

  if (!profile) {
    const error: any = new Error('Affiliate profile not found');
    error.statusCode = 404;
    throw error;
  }

  // Query order stats
  const [totalOrdersReferred, directReferralOrders, recentCommissions] = await Promise.all([
    prisma.commission_ledger.count({
      where: { beneficiaryId: profile.id, status: { not: 'reversed' } },
    }),
    prisma.orders.count({
      where: { attributedAffiliateId: profile.id },
    }),
    prisma.commission_ledger.findMany({
      where: { beneficiaryId: profile.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  return {
    profile: formatAffiliateProfile(profile),
    metrics: {
      lifetimeEarnings: Number(profile.lifetimeEarnings || 0),
      pendingBalance: Number(profile.pendingBalance || 0),
      availableBalance: Math.max(0, Number(profile.currentBalance || 0) -
        (config.payoutsEnabled ? Number(await reservedPayoutAmount(profile.id)) : 0)),
      totalOrdersReferred,
      directReferralOrders,
    },
    recentCommissions: recentCommissions.map((c) => ({
      id: c.id,
      orderId: c.orderId,
      level: c.level,
      rate: Number(c.rate),
      amountUsd: Number(c.amountUsd),
      status: c.status,
      createdAt: c.createdAt,
      availableAt: c.availableAt,
    })),
  };
}

/**
 * Retrieves paginated audit ledger for an affiliate.
 */
export async function getAffiliateLedger(
  affiliateId: string,
  query: {
    page?: number;
    limit?: number;
    status?: string;
  }
) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.max(1, Math.min(100, query.limit || 20));
  const skip = (page - 1) * limit;

  const where: any = { beneficiaryId: affiliateId };
  if (query.status) {
    where.status = ['approved', 'available'].includes(query.status.toLowerCase())
      ? { in: ['approved', 'available'] } : query.status;
  }

  const [total, entries] = await Promise.all([
    prisma.commission_ledger.count({ where }),
    prisma.commission_ledger.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        orders: {
          select: {
            orderNumber: true,
            totalAmount: true,
            currency: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  return {
    entries: entries.map((e) => ({
      id: e.id,
      orderId: e.orderId,
      orderNumber: e.orders?.orderNumber,
      level: e.level,
      rate: Number(e.rate),
      commissionableBaseUsd: Number(e.commissionableBaseUsd),
      amountUsd: Number(e.amountUsd),
      status: e.status,
      ruleVersion: e.ruleVersion,
      parentLedgerId: e.parentLedgerId,
      note: e.note,
      createdAt: e.createdAt,
      availableAt: e.availableAt,
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Traverses downlines up to 5 levels to visualize the affiliate's organization.
 */
export async function getGenealogyDownlines(
  affiliateId: string,
  maxLevels: number = 5
): Promise<GenealogyTreeNode[]> {
  async function fetchLevelDownlines(
    currentIds: string[],
    currentLevel: number
  ): Promise<GenealogyTreeNode[]> {
    if (currentIds.length === 0 || currentLevel > maxLevels) return [];

    const sponsors = await prisma.affiliate_profiles.findMany({
      where: { sponsorId: { in: currentIds } },
      select: {
        id: true,
        username: true,
        referralCode: true,
        isActive: true,
        payoutStatus: true,
        createdAt: true,
      },
    });

    const results: GenealogyTreeNode[] = [];
    for (const s of sponsors) {
      const children = await fetchLevelDownlines([s.id], currentLevel + 1);
      results.push({
        affiliateId: s.id,
        username: s.username || s.referralCode,
        referralCode: s.referralCode,
        level: currentLevel,
        isActive: s.isActive,
        payoutStatus: s.payoutStatus,
        createdAt: s.createdAt,
        children: children.length > 0 ? children : undefined,
      });
    }

    return results;
  }

  return fetchLevelDownlines([affiliateId], 1);
}
