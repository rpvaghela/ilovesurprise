/**
 * Canonical role normalization and authorization helpers.
 * Handles the mapping between backend uppercase role enums (ADMIN, CUSTOMER, AFFILIATE, STAFF)
 * and frontend client role representations without weakening authorization.
 */

export type CanonicalRole = 'admin' | 'customer' | 'representative' | 'staff';

/**
 * Safely normalizes any role string to a canonical frontend role.
 * - 'ADMIN' / 'admin' -> 'admin'
 * - 'AFFILIATE' / 'affiliate' / 'REPRESENTATIVE' / 'representative' -> 'representative'
 * - 'STAFF' / 'staff' -> 'staff'
 * - 'CUSTOMER' / 'customer' (or unrecognized role) -> 'customer'
 *
 * Security: Arbitrary role strings NEVER resolve to 'admin'.
 */
export function normalizeRole(rawRole?: string | null): CanonicalRole {
  if (!rawRole || typeof rawRole !== 'string') {
    return 'customer';
  }
  const clean = rawRole.trim().toUpperCase();
  switch (clean) {
    case 'ADMIN':
      return 'admin';
    case 'AFFILIATE':
    case 'REPRESENTATIVE':
      return 'representative';
    case 'STAFF':
      return 'staff';
    case 'CUSTOMER':
      return 'customer';
    default:
      return 'customer';
  }
}

/**
 * Strictly checks whether the given role is an administrator role.
 * Case-insensitive comparison ensuring only 'ADMIN' or 'admin' returns true.
 * Does NOT allow arbitrary strings to gain admin privileges.
 */
export function isAdminRole(rawRole?: string | null): boolean {
  if (!rawRole || typeof rawRole !== 'string') {
    return false;
  }
  return rawRole.trim().toUpperCase() === 'ADMIN';
}

/**
 * Strictly checks whether the given role is an affiliate/representative role.
 */
export function isAffiliateRole(rawRole?: string | null): boolean {
  if (!rawRole || typeof rawRole !== 'string') {
    return false;
  }
  const clean = rawRole.trim().toUpperCase();
  return clean === 'AFFILIATE' || clean === 'REPRESENTATIVE';
}

/**
 * Strictly checks whether the given role is a staff role.
 */
export function isStaffRole(rawRole?: string | null): boolean {
  if (!rawRole || typeof rawRole !== 'string') {
    return false;
  }
  return rawRole.trim().toUpperCase() === 'STAFF';
}

/**
 * Authoritatively determines if the user has already become an active, approved representative.
 * When true, the user is recognized as an active representative consultant.
 * Pending, rejected, deleted, or un-enrolled users return false.
 */
export function isRepresentativeUser(user?: {
  role?: string | null;
  repUsername?: string | null;
  isAffiliate?: boolean;
  affiliateStatus?: string | null;
} | null): boolean {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('ilovesurprises_user_v1');
      if (stored) {
        const u = JSON.parse(stored);
        const status = (u.affiliateStatus || '').toUpperCase();
        if (status === 'PENDING' || status === 'REJECTED' || status === 'DELETED' || status === 'INACTIVE') {
          return false;
        }
        if (status === 'ACTIVE' || status === 'APPROVED') {
          return true;
        }
        if (isAffiliateRole(u.role) || u.role === 'representative' || u.role === 'AFFILIATE') {
          return true;
        }
      }
    } catch {
      // ignore
    }

    if (localStorage.getItem('ils_consultant_subscribed') === 'true') {
      const status = (localStorage.getItem('ils_consultant_status') || '').toUpperCase();
      if (status !== 'PENDING' && status !== 'REJECTED' && status !== 'DELETED') {
        return true;
      }
    }
  }

  if (!user) return false;
  const status = (user.affiliateStatus || '').toUpperCase();
  if (status === 'PENDING' || status === 'REJECTED' || status === 'DELETED' || status === 'INACTIVE') {
    return false;
  }
  if (status === 'ACTIVE' || status === 'APPROVED') return true;
  if (isAffiliateRole(user.role) || user.role === 'representative' || user.role === 'AFFILIATE') return true;
  if (Boolean(user.repUsername) && status !== 'PENDING' && status !== 'REJECTED' && status !== 'DELETED') return true;
  if (Boolean(user.isAffiliate) && status !== 'PENDING' && status !== 'REJECTED') return true;
  return false;
}

/**
 * Checks whether the user has submitted a representative application that is awaiting approval.
 */
export function isRepresentativePending(user?: {
  role?: string | null;
  affiliateStatus?: string | null;
} | null): boolean {
  if (!user && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('ilovesurprises_user_v1');
      if (stored) user = JSON.parse(stored);
    } catch {}
  }
  if (typeof window !== 'undefined') {
    if (localStorage.getItem('ils_consultant_status') === 'PENDING') return true;
    if (localStorage.getItem('ils_consultant_subscribed') === 'pending') return true;
  }
  if (!user) return false;
  const status = (user.affiliateStatus || '').toUpperCase();
  return status === 'PENDING' || status === 'SUBMITTED' || status === 'UNDER_REVIEW';
}
