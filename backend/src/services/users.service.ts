import { prisma } from '../lib/prisma';
import { hashPassword, comparePassword } from '../utils/hash';
import { UpdateProfileDTO, ChangePasswordDTO } from '../types/users.types';
import { UserResponseDTO } from '../types/auth.types';
import { User } from '@prisma/client';

export const formatUserProfile = (user: any): UserResponseDTO => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  isActive: user.isActive,
  avatar: user.avatar || null,
  repUsername: user.affiliate_profiles?.username || user.affiliate_profiles?.referralCode || undefined,
  isAffiliate: !!user.affiliate_profiles,
  affiliateStatus: user.affiliate_profiles?.status || undefined,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const getProfile = async (userId: string): Promise<UserResponseDTO> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { affiliate_profiles: true },
  });

  if (!user || !user.isActive) {
    const error: any = new Error('User not found or inactive');
    error.statusCode = 404;
    throw error;
  }

  return formatUserProfile(user);
};

export const updateProfile = async (userId: string, data: UpdateProfileDTO): Promise<UserResponseDTO> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.isActive) {
    const error: any = new Error('User not found or inactive');
    error.statusCode = 404;
    throw error;
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.avatar !== undefined && { avatar: data.avatar }),
    },
    include: { affiliate_profiles: true },
  });

  return formatUserProfile(updatedUser);
};

export const changePassword = async (userId: string, data: ChangePasswordDTO): Promise<{ message: string }> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.isActive) {
    const error: any = new Error('User not found or inactive');
    error.statusCode = 404;
    throw error;
  }

  const isMatch = await comparePassword(data.currentPassword, user.passwordHash);
  if (!isMatch) {
    const error: any = new Error('Incorrect current password');
    error.statusCode = 400;
    throw error;
  }

  const newPasswordHash = await hashPassword(data.newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newPasswordHash },
  });

  return { message: 'Password changed successfully' };
};

// Backward compatibility object export
export const usersService = {
  formatUser: formatUserProfile,
  getProfile,
  updateProfile,
  changePassword,
};
