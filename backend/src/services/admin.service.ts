import { prisma } from '../lib/prisma';
import { hashPassword } from '../utils/hash';
import { UpdateUserDTO, UpdateUserRoleDTO, ListUsersQueryDTO } from '../types/admin.types';
import { UserResponseDTO } from '../types/auth.types';
import { Prisma, User, UserRole } from '@prisma/client';

const PRIMARY_SUPER_ADMIN_EMAIL = 'ilovesurprisedotcom@gmail.com';

export const formatUser = (user: User): UserResponseDTO => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  isActive: user.isActive,
  avatar: (user as any).avatar || null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const listUsers = async (query: ListUsersQueryDTO): Promise<{
  users: UserResponseDTO[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}> => {
  const page = Math.max(1, query.page || 1);
  const limit = Math.max(1, Math.min(100, query.limit || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {};

  if (query.role) {
    where.role = query.role;
  }

  if (query.search) {
    const searchTerm = query.search.trim();
    where.OR = [
      { email: { contains: searchTerm, mode: 'insensitive' } },
      { firstName: { contains: searchTerm, mode: 'insensitive' } },
      { lastName: { contains: searchTerm, mode: 'insensitive' } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    users: users.map(formatUser),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getUserById = async (userId: string): Promise<UserResponseDTO> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    const error: any = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return formatUser(user);
};

export const updateUser = async (userId: string, data: UpdateUserDTO): Promise<UserResponseDTO> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    const error: any = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.avatar !== undefined && { avatar: data.avatar }),
      ...(data.isActive !== undefined && user.email !== PRIMARY_SUPER_ADMIN_EMAIL && { isActive: data.isActive }),
    } as any,
  });

  return formatUser(updatedUser);
};

export const updateUserRole = async (userId: string, data: UpdateUserRoleDTO): Promise<UserResponseDTO> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    const error: any = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { role: user.email === PRIMARY_SUPER_ADMIN_EMAIL ? UserRole.ADMIN : data.role },
  });

  // Keep affiliate_profiles in sync with role
  if (data.role === UserRole.AFFILIATE) {
    const existingProfile = await prisma.affiliate_profiles.findUnique({ where: { userId } });
    if (existingProfile) {
      await prisma.affiliate_profiles.update({
        where: { id: existingProfile.id },
        data: { status: 'ACTIVE', isActive: true, payoutStatus: 'active' },
      });
    }
  } else if (data.role === UserRole.CUSTOMER) {
    const existingProfile = await prisma.affiliate_profiles.findUnique({ where: { userId } });
    if (existingProfile && existingProfile.status === 'PENDING') {
      await prisma.affiliate_profiles.update({
        where: { id: existingProfile.id },
        data: { status: 'REJECTED', isActive: false },
      });
    }
  }

  return formatUser(updatedUser);
};

export const listRepresentatives = async (): Promise<any[]> => {
  const [profiles, allMemberships] = await Promise.all([
    prisma.affiliate_profiles.findMany({
      where: { status: { not: 'ARCHIVED' } },
      include: {
        users: true,
        affiliate_profiles: {
          select: { id: true, username: true, referralCode: true },
        },
        other_affiliate_profiles: {
          select: { id: true, username: true, status: true },
        },
        commission_ledger: {
          select: { id: true, amountUsd: true, status: true, level: true, createdAt: true },
        },
        attributed_orders: {
          select: { id: true, totalAmount: true, createdAt: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user_memberships.findMany({
      where: { users: { NOT: { affiliate_profiles: { is: { status: 'ARCHIVED' } } } } },
      include: {
        membership_plans: true,
        users: {
          include: {
            orders: {
              select: { attributedAffiliateId: true },
              take: 1,
            },
            affiliate_profiles: {
              select: { sponsorId: true },
            },
          },
        },
      },
    }),
  ]);

  const profileUserIds = new Set(profiles.map((p) => p.userId));
  const affiliateUsersWithoutProfile = await prisma.user.findMany({
    where: {
      role: UserRole.AFFILIATE,
      id: { notIn: Array.from(profileUserIds) },
    },
  });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const membershipByUserId = new Map(allMemberships.map((m) => [m.userId, m]));
  const normalizeMembershipStatus = (status?: string | null) => {
    switch ((status || '').toUpperCase()) {
      case 'ACTIVE':
        return 'active';
      case 'PAST_DUE':
        return 'past_due';
      case 'SUSPENDED':
        return 'suspended';
      case 'CANCELLED':
        return 'cancelled';
      default:
        return 'cancelled';
    }
  };
  const resolveRepStatus = (isProfileActive: boolean, membershipStatus: string) => {
    if (!isProfileActive || membershipStatus === 'suspended' || membershipStatus === 'cancelled') {
      return 'suspended';
    }
    if (membershipStatus === 'past_due') {
      return 'past_due';
    }
    return 'active';
  };

  const reps = profiles.map((p) => {
    const u = p.users;
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email.split('@')[0];
    const repUsername =
      p.username ||
      p.slug ||
      p.referralCode ||
      u.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '');

    // Direct orders referred by this rep
    const directOrders = p.attributed_orders || [];
    const directSalesLifetime = directOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const personalSalesMonth = directOrders
      .filter((o) => new Date(o.createdAt) >= startOfMonth)
      .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

    // Ledger totals
    const ledgers = p.commission_ledger || [];
    const pendingBalance = Number(p.pendingBalance || 0);
    const currentBalance = Number(p.currentBalance || 0);
    const lifetimeCommissions = Number(p.lifetimeEarnings || 0);

    // VIP Memberships referred by this rep
    const referredMembers = allMemberships.filter(
      (m) =>
        m.users?.orders?.some((o) => o.attributedAffiliateId === p.id) ||
        m.users?.affiliate_profiles?.sponsorId === p.id ||
        m.userId === p.userId
    );
    const activeVipMembers = referredMembers.filter((m) => (m.status || '').toUpperCase() === 'ACTIVE');
    const vipMrr = activeVipMembers.reduce((sum, m) => sum + Number(m.membership_plans?.price || 0), 0);
    const ownMembership = membershipByUserId.get(p.userId);
    const membershipStatus = normalizeMembershipStatus(ownMembership?.status);
    const membershipPlan = ownMembership?.membership_plans
      ? ownMembership.membership_plans.name
      : 'No VIP Membership';

    return {
      id: u.id,
      affiliateId: p.id,
      name,
      repUsername,
      email: u.email,
      phone: (u as any).phone || '',
      avatar: u.avatar || '',
      sponsorUsername: p.affiliate_profiles?.username || 'company',
      sponsorName: p.affiliate_profiles?.username ? `@${p.affiliate_profiles.username}` : 'Direct / Corporate',
      status: resolveRepStatus(Boolean(p.isActive), membershipStatus),
      approvalStatus: p.status === 'PENDING' ? 'pending' : p.status === 'REJECTED' ? 'rejected' : 'approved',
      currentRank: 'Brand Ambassador',
      membershipStatus,
      membershipPlan,
      joinDate: p.createdAt ? p.createdAt.toISOString().slice(0, 10) : '',
      lifetimeSales: directSalesLifetime > 0 ? directSalesLifetime : lifetimeCommissions * 5,
      personalSalesMonth,
      teamSalesMonth: 0,
      teamSize: p.other_affiliate_profiles?.length || 0,
      totalCommissionsEarned: lifetimeCommissions,
      pendingBalance,
      currentBalance,
      vipMembersCount: activeVipMembers.length,
      vipMembersMrr: vipMrr,
    };
  });

  for (const u of affiliateUsersWithoutProfile) {
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email.split('@')[0];
    const ownMembership = membershipByUserId.get(u.id);
    const membershipStatus = normalizeMembershipStatus(ownMembership?.status);
    const membershipPlan = ownMembership?.membership_plans
      ? ownMembership.membership_plans.name
      : 'No VIP Membership';
    reps.push({
      id: u.id,
      affiliateId: u.id,
      name,
      repUsername: u.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, ''),
      email: u.email,
      phone: (u as any).phone || '',
      avatar: u.avatar || '',
      sponsorUsername: 'company',
      sponsorName: 'Direct / Corporate',
      status: resolveRepStatus(Boolean(u.isActive), membershipStatus),
      approvalStatus: 'approved',
      currentRank: 'Brand Ambassador',
      membershipStatus,
      membershipPlan,
      joinDate: u.createdAt ? u.createdAt.toISOString().slice(0, 10) : '',
      lifetimeSales: 0,
      personalSalesMonth: 0,
      teamSalesMonth: 0,
      teamSize: 0,
      totalCommissionsEarned: 0,
      pendingBalance: 0,
      currentBalance: 0,
      vipMembersCount: 0,
      vipMembersMrr: 0,
    });
  }

  return reps;
};

export const approveRepresentative = async (
  id: string
): Promise<{ success: boolean; message: string }> => {
  const profile = await prisma.affiliate_profiles.findFirst({
    where: { OR: [{ id }, { userId: id }] },
  });

  const userId = profile ? profile.userId : id;

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    const isProtectedAdmin =
      user?.role === UserRole.ADMIN ||
      user?.email?.toLowerCase() === PRIMARY_SUPER_ADMIN_EMAIL;

    await tx.user.update({
      where: { id: userId },
      data: {
        role: isProtectedAdmin ? UserRole.ADMIN : UserRole.AFFILIATE,
        isActive: true,
      },
    });

    if (profile) {
      await tx.affiliate_profiles.update({
        where: { id: profile.id },
        data: { status: 'ACTIVE', isActive: true, payoutStatus: 'active' },
      });
    } else {
      if (user) {
        const repUsername = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '');
        await tx.affiliate_profiles.create({
          data: {
            id: crypto.randomUUID(),
            userId: user.id,
            username: repUsername,
            referralCode: repUsername,
            slug: repUsername,
            status: 'ACTIVE',
            isActive: true,
            payoutStatus: 'active',
            updatedAt: new Date(),
          },
        });
      }
    }
  });

  return { success: true, message: 'Representative approved and storefront URL activated' };
};

export const rejectRepresentative = async (
  id: string
): Promise<{ success: boolean; message: string }> => {
  const profile = await prisma.affiliate_profiles.findFirst({
    where: { OR: [{ id }, { userId: id }] },
  });

  const userId = profile ? profile.userId : id;

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    const isProtectedAdmin =
      user?.role === UserRole.ADMIN ||
      user?.email?.toLowerCase() === PRIMARY_SUPER_ADMIN_EMAIL;

    if (user && !isProtectedAdmin) {
      await tx.user.update({
        where: { id: userId },
        data: { role: UserRole.CUSTOMER },
      });
    }

    if (profile) {
      await tx.affiliate_profiles.update({
        where: { id: profile.id },
        data: { status: 'REJECTED', isActive: false },
      });
    }
  });

  return { success: true, message: 'Representative application rejected' };
};

export const deleteRepresentative = async (
  id: string
): Promise<{ success: boolean; message: string }> => {
  const profile = await prisma.affiliate_profiles.findFirst({
    where: { OR: [{ id }, { userId: id }] },
  });

  if (!profile) {
    const user = await prisma.user.findUnique({ where: { id } });
    const isProtectedAdmin =
      user?.role === UserRole.ADMIN ||
      user?.email?.toLowerCase() === PRIMARY_SUPER_ADMIN_EMAIL;

    if (user && user.role === UserRole.AFFILIATE && !isProtectedAdmin) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: UserRole.CUSTOMER },
      });
      return { success: true, message: `Representative role removed for ${user.email}.` };
    }
    return { success: false, message: 'Representative profile not found' };
  }

  const userId = profile.userId;

  await prisma.$transaction(async (tx) => {
    // Keep the permanent sponsor chain and financial history for audit/reversals.
    await tx.affiliate_profiles.update({
      where: { id: profile.id },
      data: { status: 'ARCHIVED', isActive: false, payoutStatus: 'suspended' },
    });
    await tx.user_memberships.updateMany({ where: { userId }, data: { status: 'CANCELLED', autoRenew: false } });

    // 4. Update the user role back to CUSTOMER if not an administrator
    const user = await tx.user.findUnique({ where: { id: userId } });
    const isProtectedAdmin =
      user?.role === UserRole.ADMIN ||
      user?.email?.toLowerCase() === PRIMARY_SUPER_ADMIN_EMAIL;

    if (user && !isProtectedAdmin) {
      await tx.user.update({
        where: { id: userId },
        data: { role: UserRole.CUSTOMER },
      });
    }
  });

  return { success: true, message: `Representative @${profile.username} removed; financial history retained.` };
};

export const createStaffUser = async (data: {
  name: string;
  email: string;
  password: string;
  role?: string;
}): Promise<UserResponseDTO> => {
  const normalizedEmail = data.email.toLowerCase().trim();
  const passwordHash = await hashPassword(data.password);
  const nameParts = data.name.trim().split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || null;

  const targetRole =
    normalizedEmail === PRIMARY_SUPER_ADMIN_EMAIL || data.role === 'super_admin' || data.role === 'ADMIN'
      ? UserRole.ADMIN : UserRole.STAFF;

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    const updated = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        passwordHash,
        firstName: firstName || existingUser.firstName,
        lastName: lastName || existingUser.lastName,
        role: targetRole,
        isActive: true,
      },
    });
    return formatUser(updated);
  }

  const created = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      firstName,
      lastName,
      role: targetRole,
      isActive: true,
    },
  });

  return formatUser(created);
};

export const deleteStaffUser = async (
  identifier: string
): Promise<{ success: boolean; message: string }> => {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ id: identifier }, { email: identifier.toLowerCase().trim() }],
    },
  });

  if (!user) {
    return { success: false, message: 'Staff user not found in database' };
  }

  if (
    user.email === PRIMARY_SUPER_ADMIN_EMAIL ||
    user.role === UserRole.ADMIN
  ) {
    throw new Error('Primary administrator accounts are protected and cannot be deleted.');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isActive: false, role: UserRole.CUSTOMER },
  });

  return { success: true, message: `Staff user ${user.email} deactivated.` };
};

export const updateStaffUser = async (
  identifier: string,
  data: {
    name?: string;
    email?: string;
    role?: string;
    password?: string;
    isActive?: boolean;
  }
): Promise<UserResponseDTO> => {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ id: identifier }, { email: identifier.toLowerCase().trim() }],
    },
  });

  if (!user) {
    throw new Error('Staff user not found in database');
  }

  const isProtectedAdmin =
    user.email === PRIMARY_SUPER_ADMIN_EMAIL;

  const updatePayload: any = {};

  if (data.name !== undefined) {
    const nameParts = data.name.trim().split(' ');
    updatePayload.firstName = nameParts[0] || '';
    updatePayload.lastName = nameParts.slice(1).join(' ') || null;
  }

  if (data.email !== undefined && !isProtectedAdmin) {
    const cleanEmail = data.email.toLowerCase().trim();
    if (cleanEmail && cleanEmail !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (existing && existing.id !== user.id) {
        throw new Error(`Email ${cleanEmail} is already in use.`);
      }
      updatePayload.email = cleanEmail;
    }
  }

  if (data.role !== undefined) {
    if (isProtectedAdmin) {
      updatePayload.role = UserRole.ADMIN;
    } else {
      updatePayload.role =
        data.role === 'super_admin' || data.role === 'ADMIN' ? UserRole.ADMIN : UserRole.STAFF;
    }
  }

  if (data.password && data.password.trim().length >= 6) {
    updatePayload.passwordHash = await hashPassword(data.password.trim());
  }

  if (data.isActive !== undefined && !isProtectedAdmin) {
    updatePayload.isActive = data.isActive;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updatePayload,
  });

  return formatUser(updated);
};

// Object alias for backward compatibility
export const adminService = {
  formatUser,
  listUsers,
  getUserById,
  updateUser,
  updateUserRole,
  listRepresentatives,
  approveRepresentative,
  rejectRepresentative,
  deleteRepresentative,
  createStaffUser,
  updateStaffUser,
  deleteStaffUser,
};

