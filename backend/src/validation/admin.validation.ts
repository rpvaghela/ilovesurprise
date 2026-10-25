import { z } from 'zod';
import { UserRole } from '@prisma/client';

export const updateUserSchema = z.object({
  body: z.object({
    firstName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    avatar: z.string().trim().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const updateUserRoleSchema = z.object({
  body: z.object({
    role: z.nativeEnum(UserRole, {
      message: 'Invalid role. Must be CUSTOMER, AFFILIATE, STAFF, or ADMIN',
    }),
  }),
});

export const listUsersSchema = z.object({
  query: z.object({
    page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 20)),
    search: z.string().optional(),
    role: z.nativeEnum(UserRole).optional(),
  }),
});

export const addStaffSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Staff member name must be at least 2 characters'),
    email: z.string().trim().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.string().optional().default('store_manager'),
  }),
});

