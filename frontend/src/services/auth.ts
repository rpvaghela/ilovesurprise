import type { UserProfile } from '../types';
import { apiClient } from './apiClient';
import { customerAuthService } from './customerAuthService';
import { isAdminRole, isStaffRole } from '../utils/roleUtils';
import { accountService } from './accountService';

export interface LoginPayload {
  identifier: string; // Email
  password: string;
  rememberMe?: boolean;
}

export interface RegisterPayload {
  name: string;
  email: string;
  mobile?: string;
  password: string;
  role?: 'customer' | 'representative';
  repUsername?: string;
  sponsorUsername?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: UserProfile;
  token?: string;
  error?: string;
  requiresVerification?: boolean;
  message?: string;
  isAlreadyRegistered?: boolean;
  isRateLimited?: boolean;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Validates password strength cleanly with minimal UI footprint
 */
export function evaluatePasswordStrength(password: string): {
  score: 1 | 2 | 3;
  label: 'Weak' | 'Medium' | 'Strong';
  color: string;
  percentage: number;
} {
  if (!password) {
    return { score: 1, label: 'Weak', color: '#ef4444', percentage: 0 };
  }

  let strength = 0;
  if (password.length >= 6) strength += 1;
  if (password.length >= 8 && /[0-9]/.test(password)) strength += 1;
  if (password.length >= 10 && /[^A-Za-z0-9]/.test(password)) strength += 1;

  if (strength >= 3) {
    return { score: 3, label: 'Strong', color: '#10b981', percentage: 100 };
  }
  if (strength === 2) {
    return { score: 2, label: 'Medium', color: '#f59e0b', percentage: 66 };
  }
  return { score: 1, label: 'Weak', color: '#ef4444', percentage: 33 };
}

/**
 * Validates email or 10-digit mobile number input
 */
export function isValidEmailOrMobile(value: string): boolean {
  const trimmed = value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const mobileRegex = /^(\+?\d{1,3}[- ]?)?\d{10}$/;
  return emailRegex.test(trimmed) || mobileRegex.test(trimmed.replace(/[\s-()]/g, ''));
}

/**
 * Validates email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validates mobile number format (US / International 10+ digits)
 */
export function isValidMobile(mobile: string): boolean {
  const cleaned = mobile.replace(/[\s-()]/g, '');
  return cleaned.length >= 10 && /^\+?\d+$/.test(cleaned);
}

/**
 * Maps authentication errors to truthful, user-friendly, and actionable messages.
 */
export function mapAuthError(
  error: any,
  _context: 'login' | 'register' | 'forgot_password' | 'reset_password' | 'resend_verification' = 'register'
): string {
  if (!error) return 'An unexpected authentication error occurred. Please try again.';
  return error.message || error.error_description || String(error) || 'Authentication failed. Please try again.';
}

/**
 * Admin Session Inactivity Configuration:
 * Inactivity window set to 1 hour (60 minutes = 3,600,000 ms).
 * Active administrator interactions touch and extend this window.
 */
export const ADMIN_SESSION_INACTIVITY_MS = 60 * 60 * 1000;
export const ADMIN_LAST_ACTIVITY_KEY = 'ils_admin_last_activity';
export const ADMIN_SESSION_START_KEY = 'ils_admin_session_start';

/**
 * Updates the admin last activity timestamp to prevent premature session expiration.
 */
export function touchAdminActivity(): void {
  if (typeof window === 'undefined') return;
  try {
    const now = Date.now();
    localStorage.setItem(ADMIN_LAST_ACTIVITY_KEY, String(now));
    if (!localStorage.getItem(ADMIN_SESSION_START_KEY)) {
      localStorage.setItem(ADMIN_SESSION_START_KEY, String(now));
    }
  } catch {
    // Storage quota or restricted environment
  }
}

/**
 * Returns elapsed milliseconds since the administrator last interacted with the app.
 */
export function getAdminIdleTime(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const last = localStorage.getItem(ADMIN_LAST_ACTIVITY_KEY);
    if (!last) return Infinity;
    const parsed = Number(last);
    if (isNaN(parsed) || parsed <= 0) return Infinity;
    return Date.now() - parsed;
  } catch {
    return 0;
  }
}

/**
 * Checks if the administrator session has exceeded the 1-hour inactivity limit.
 */
export function isAdminSessionExpired(): boolean {
  const idle = getAdminIdleTime();
  return idle >= ADMIN_SESSION_INACTIVITY_MS;
}

/**
 * Checks whether an admin session is currently active and within the 1-hour window.
 */
export function isAdminSessionActive(): boolean {
  if (typeof window === 'undefined') return false;
  const token = apiClient.getAuthToken();
  if (!token) return false;
  const storedUser = accountService.getStoredUser();
  if (!storedUser || !isAdminRole(storedUser.role)) return false;
  return !isAdminSessionExpired();
}

/**
 * Clears administrator session activity tracking keys.
 */
export function clearAdminSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ADMIN_LAST_ACTIVITY_KEY);
    localStorage.removeItem(ADMIN_SESSION_START_KEY);
  } catch {
    // Storage unavailable
  }
}

/**
 * Frontend Auth Service layer (Standalone Local Authentication)
 */
export const authService = {
  /**
   * Performs customer login
   */
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const res = await customerAuthService.loginWithEmailPassword(payload);
    return {
      success: res.success,
      user: res.user,
      error: res.error,
    };
  },

  /**
   * Performs customer registration
   */
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const res = await customerAuthService.registerWithEmailPassword(payload);
    return {
      success: res.success,
      user: res.user,
      error: res.error,
      isAlreadyRegistered: res.isAlreadyRegistered,
    };
  },

  /**
   * Returns remaining client-side cooldown seconds for a given email
   */
  getSignupCooldown(_email: string): number {
    return 0;
  },

  /**
   * Customer password reset
   */
  async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    return customerAuthService.forgotPassword(email);
  },

  /**
   * Resets the account password using a reset token issued by
   * `POST /api/auth/forgot-password`.
   *
   * A reset token is required: without one there is no way to authorize a
   * password change, so this reports failure rather than claiming success.
   */
  async resetPassword(
    newPassword: string,
    token?: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!newPassword || newPassword.length < 6) {
      return {
        success: false,
        error: 'New password must be at least 6 characters.',
      };
    }

    if (!token) {
      return {
        success: false,
        error:
          'This password reset link is missing or incomplete. Please request a new reset email.',
      };
    }

    return customerAuthService.resetPassword(token, newPassword);
  },

  /**
   * Email verification resend.
   *
   * The backend exposes no verification endpoint and does not gate sign-in on
   * email verification, so there is nothing to resend. This reports the real
   * state rather than fabricating a confirmation.
   */
  async resendVerification(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    return {
      success: false,
      error:
        'Email verification is not enabled for this store yet, so there is nothing to resend. You can sign in with your email and password.',
    };
  },

  /**
   * Signs out current user
   */
  async logout(): Promise<void> {
    await customerAuthService.logout();
  },

  /**
   * Customer Google Sign-In (Frontend demonstration login)
   */
  async loginWithGoogle(): Promise<AuthResponse> {
    const res = await customerAuthService.signInWithGoogle();
    return {
      success: res.success,
      user: res.user,
      error: res.error,
    };
  },

  /**
   * Re-reads the authenticated profile from the backend after an OAuth sign-in.
   */
  async syncOAuthUserProfile(user: any): Promise<UserProfile | null> {
    if (!user) return null;
    return customerAuthService.getCurrentUser();
  },

  /**
   * Fetches current authenticated user profile from backend API or local cache
   */
  async getCurrentUser(): Promise<UserProfile | null> {
    return customerAuthService.getCurrentUser();
  },

  touchAdminActivity,
  getAdminIdleTime,
  isAdminSessionExpired,
  isAdminSessionActive,
  clearAdminSession,

  /**
   * Verifies administrator privileges against the backend with a 1-hour inactivity window.
   *
   * Only expires after 1 continuous hour of inactivity. Active usage continuously touches
   * and renews this window. Transient network blips do not terminate an active 1-hour session.
   */
  async verifyAdminSession(): Promise<{ isAdmin: boolean; user: UserProfile | null; expired?: boolean }> {
    if (!apiClient.getAuthToken()) {
      clearAdminSession();
      return { isAdmin: false, user: null };
    }

    const hadSession =
      typeof window !== 'undefined' &&
      (!!localStorage.getItem(ADMIN_LAST_ACTIVITY_KEY) ||
        !!localStorage.getItem(ADMIN_SESSION_START_KEY));

    // If an existing admin session has exceeded 1 hour of inactivity:
    if (hadSession && isAdminSessionExpired()) {
      clearAdminSession();
      apiClient.setAuthToken(null);
      accountService.updateStoredUser(null);
      return { isAdmin: false, user: null, expired: true };
    }

    const stored = accountService.getStoredUser();

    // If stored user is an admin or staff and the session is active within the 1-hour window:
    if (stored && (isAdminRole(stored.role) || isStaffRole(stored.role)) && !isAdminSessionExpired()) {
      touchAdminActivity();
      try {
        const user = await customerAuthService.getCurrentUser();
        if (user) {
          if (isAdminRole(user.role) || isStaffRole(user.role)) {
            touchAdminActivity();
            return { isAdmin: true, user };
          }
          // Role changed on backend to non-admin/non-staff
          clearAdminSession();
          return { isAdmin: false, user };
        }
      } catch {
        // Network failure: keep active admin session alive within the 1-hour window
        return { isAdmin: true, user: stored };
      }
      return { isAdmin: true, user: stored };
    }

    // Direct check for new or unverified session
    const user = await customerAuthService.getCurrentUser();
    if (!user) {
      clearAdminSession();
      return { isAdmin: false, user: null };
    }

    if (!isAdminRole(user.role) && !isStaffRole(user.role)) {
      clearAdminSession();
      return { isAdmin: false, user };
    }

    touchAdminActivity();
    return { isAdmin: true, user };
  },

  /**
   * Authenticates an administrator or staff operator against the backend and starts the 1-hour session.
   *
   * This is the same `POST /api/auth/login` used by customers; the ADMIN or STAFF role
   * is then confirmed from the authenticated backend response.
   */
  async adminLogin(payload: LoginPayload): Promise<AuthResponse & { isAdmin?: boolean }> {
    const cleanEmail = payload.identifier.trim().toLowerCase();
    if (!cleanEmail || !payload.password) {
      return {
        success: false,
        error: 'Please enter both your administrator/staff email and password.',
      };
    }

    const res = await customerAuthService.loginWithEmailPassword({
      identifier: cleanEmail,
      password: payload.password,
      rememberMe: payload.rememberMe,
    });

    if (!res.success || !res.user) {
      return { success: false, error: res.error, isAdmin: false };
    }

    if (!isAdminRole(res.user.role) && !isStaffRole(res.user.role)) {
      await customerAuthService.logout();
      clearAdminSession();
      return {
        success: false,
        error:
          'Access denied. This account does not have administrator or staff privileges.',
        isAdmin: false,
      };
    }

    // Initialize 1-hour admin session tracking
    touchAdminActivity();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ils_admin_session_changed', {
          detail: { action: 'login', user: res.user },
        })
      );
    }

    return {
      success: true,
      user: res.user,
      token: res.token,
      isAdmin: true,
    };
  },

  /**
   * Signs out the administrator, clearing the 1-hour session and token.
   */
  async adminLogout(): Promise<void> {
    clearAdminSession();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ils_admin_session_changed', {
          detail: { action: 'logout' },
        })
      );
    }
    await customerAuthService.logout();
  },

  /**
   * Dispatches an administrator password reset through the real backend
   * endpoint. The backend intentionally returns the same generic message
   * whether or not the address exists, so no account enumeration occurs.
   */
  async adminForgotPassword(email: string): Promise<ForgotPasswordResponse> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      return {
        success: false,
        message: '',
        error: 'Please enter a valid email address.',
      };
    }

    return customerAuthService.forgotPassword(cleanEmail);
  },
};
