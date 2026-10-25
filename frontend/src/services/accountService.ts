import type { SavedAddress, UserProfile, UserSettings } from '../types';
import { apiClient, ApiError, unwrap, type ApiResponse } from './apiClient';
import { mapBackendUser, type BackendUser } from './userMapping';

const ADDRESSES_STORAGE_KEY = 'ilovesurprises_addresses_v1';
const USER_STORAGE_KEY = 'ilovesurprises_user_v1';
const SETTINGS_STORAGE_KEY = 'ilovesurprises_settings_v1';

const MAX_SAVED_ADDRESSES = 3;

const dispatchAddressesUpdated = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ilovesurprises_addresses_updated'));
  }
};

const normalizeAddressList = (addresses: SavedAddress[]): SavedAddress[] => {
  const uniqueList: SavedAddress[] = [];
  for (const address of addresses) {
    const cleanAddress = {
      ...address,
      addressLine2: address.addressLine2 || '',
      isDefault: false,
    };
    if (!uniqueList.some((existing) => isSameAddress(existing, cleanAddress))) {
      uniqueList.push(cleanAddress);
    }
    if (uniqueList.length >= MAX_SAVED_ADDRESSES) break;
  }
  return uniqueList;
};

const persistAddresses = (addresses: SavedAddress[]): boolean => {
  if (typeof window === 'undefined') return false;

  const compact = normalizeAddressList(addresses);
  const payload = JSON.stringify(compact);

  try {
    localStorage.setItem(ADDRESSES_STORAGE_KEY, payload);
    sessionStorage.removeItem(ADDRESSES_STORAGE_KEY);
    dispatchAddressesUpdated();
    return true;
  } catch (err) {
    try {
      localStorage.removeItem(ADDRESSES_STORAGE_KEY);
      sessionStorage.setItem(ADDRESSES_STORAGE_KEY, payload);
      dispatchAddressesUpdated();
      return true;
    } catch (fallbackErr) {
      console.warn('Unable to persist saved addresses; checkout will continue without saving this address.', fallbackErr || err);
      return false;
    }
  }
};

/**
 * Normalizes and checks if two addresses represent the exact same delivery location
 */
export function isSameAddress(
  a: { addressLine1: string; city: string; state: string; zipCode: string },
  b: { addressLine1: string; city: string; state: string; zipCode: string }
): boolean {
  const norm = (val?: string) =>
    (val || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[.,#-]/g, '');

  return (
    norm(a.addressLine1) === norm(b.addressLine1) &&
    norm(a.city) === norm(b.city) &&
    norm(a.state) === norm(b.state) &&
    norm(a.zipCode) === norm(b.zipCode)
  );
}

let inMemoryUser: UserProfile | null = null;
let userStorageUnavailable = false;

/**
 * Account Service layer - connects user profile to backend (GET/PATCH /api/users/me)
 * while maintaining reliable local storage for addresses.
 */
export const accountService = {
  MAX_SAVED_ADDRESSES,

  /**
   * Fetches user profile from backend (GET /api/users/me) if authenticated
   */
  async fetchProfile(): Promise<UserProfile | null> {
    const token = apiClient.getAuthToken();

    // No token means no session; a cached profile is not proof of one.
    if (!token) {
      if (this.getStoredUser()) {
        this.updateStoredUser(null);
      }
      return null;
    }

    try {
      const response = await apiClient.get<ApiResponse<{ user: BackendUser }>>(
        '/api/users/me'
      );
      const user = unwrap<{ user: BackendUser }>(response, '/api/users/me').user;

      const updated = mapBackendUser(user, this.getStoredUser());
      this.updateStoredUser(updated);
      return updated;
    } catch (err: any) {
      if (err instanceof ApiError && err.isUnauthorized) {
        // apiClient has already discarded the token.
        this.updateStoredUser(null);
        return null;
      }
      // Transient failure: keep showing the last verified profile.
      return this.getStoredUser();
    }
  },

  /**
   * Updates user profile via backend (PATCH /api/users/me)
   */
  async updateProfile(data: {
    name?: string;
    firstName?: string;
    lastName?: string;
    avatar?: string | null;
    mobile?: string;
  }): Promise<UserProfile | null> {
    const token = apiClient.getAuthToken();
    let firstName = data.firstName;
    let lastName = data.lastName;

    if (data.name && (!firstName || !lastName)) {
      const parts = data.name.trim().split(' ');
      firstName = parts[0] || data.name;
      lastName = parts.slice(1).join(' ') || undefined;
    }

    if (!token) {
      throw new ApiError(
        'You must be signed in to update your profile.',
        401,
        'unauthorized',
        { endpoint: '/api/users/me', method: 'PATCH' }
      );
    }

    const payload: { firstName?: string; lastName?: string; avatar?: string | null } = {};
    if (firstName !== undefined) payload.firstName = firstName;
    if (lastName !== undefined) payload.lastName = lastName;
    if (data.avatar !== undefined) payload.avatar = data.avatar;

    // Errors propagate: a profile update is only reported as successful once
    // the backend has persisted it. There is no local write-through fallback,
    // because that would show the user a change the database never accepted.
    const response = await apiClient.patch<ApiResponse<{ user: BackendUser }>>(
      '/api/users/me',
      payload
    );

    const user = unwrap<{ user: BackendUser }>(response, '/api/users/me').user;

    const current = this.getStoredUser();
    const updated = mapBackendUser(user, current);
    if (data.mobile !== undefined) {
      updated.mobile = data.mobile;
    }
    this.updateStoredUser(updated);
    window.dispatchEvent(new CustomEvent('ilovesurprises_user_updated'));
    return updated;
  },

  /**
   * Changes user password via backend (PATCH /api/users/me/password)
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiClient.patch('/api/users/me/password', {
      currentPassword,
      newPassword,
    });
  },

  /**
   * Loads saved addresses from storage (max 3) - filters out and removes default saved address
   */
  async fetchAddresses(): Promise<SavedAddress[]> {

    return this.getSavedAddresses();
  },

  getSavedAddresses(): SavedAddress[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored =
        localStorage.getItem(ADDRESSES_STORAGE_KEY) ||
        sessionStorage.getItem(ADDRESSES_STORAGE_KEY);
      if (stored) {
        const parsed: SavedAddress[] = JSON.parse(stored);
        const normalized = normalizeAddressList(parsed.filter((a) => !a.isDefault));
        if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
          persistAddresses(normalized);
        }
        return normalized;
      }
      return [];
    } catch {
      try {
        localStorage.removeItem(ADDRESSES_STORAGE_KEY);
        sessionStorage.removeItem(ADDRESSES_STORAGE_KEY);
      } catch {
        // ignore
      }
      return [];
    }
  },

  /**
   * Records / syncs a delivery address from an order.
   * - Deduplicates: If the same address already exists, updates recipient info without creating a duplicate.
   * - Enforces MAX 3 different addresses (keeps up to 3 distinct locations).
   */
  recordOrderShippingAddress(shipping: {
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  }): SavedAddress {
    const list = this.getSavedAddresses();

    // 1. Check if the exact same physical delivery address already exists
    const existingIndex = list.findIndex((a) => isSameAddress(a, shipping));

    if (existingIndex >= 0) {
      // Address already exists -> Update name/phone, do not duplicate
      list[existingIndex] = {
        ...list[existingIndex],
        fullName: shipping.fullName.trim() || list[existingIndex].fullName,
        phone: shipping.phone.trim() || list[existingIndex].phone,
        addressLine2: shipping.addressLine2?.trim() || list[existingIndex].addressLine2 || '',
        country: shipping.country?.trim() || list[existingIndex].country || 'United States',
        isDefault: false,
      };

      if (typeof window !== 'undefined') {
        persistAddresses(list);
      }
      return list[existingIndex];
    }

    // 2. New distinct address: Create and add
    const newAddress: SavedAddress = {
      id: 'addr-' + Date.now(),
      label: `Delivery Address ${list.length + 1}`,
      fullName: shipping.fullName.trim(),
      phone: shipping.phone.trim(),
      addressLine1: shipping.addressLine1.trim(),
      addressLine2: shipping.addressLine2?.trim() || '',
      city: shipping.city.trim(),
      state: shipping.state.trim().toUpperCase(),
      zipCode: shipping.zipCode.trim(),
      country: shipping.country?.trim() || 'United States',
      isDefault: false,
    };

    // Add to top and cap at MAX 3 addresses
    list.unshift(newAddress);
    const capped = list.slice(0, MAX_SAVED_ADDRESSES);

    if (typeof window !== 'undefined') {
      persistAddresses(capped);
    }

    return newAddress;
  },

  /**
   * Adds or updates a saved address with deduplication and 3-address cap
   */
  saveAddress(data: Omit<SavedAddress, 'id' | 'isDefault'> & { id?: string; isDefault?: boolean }): SavedAddress {
    const list = this.getSavedAddresses();
    let saved: SavedAddress;

    if (data.id) {
      // Update existing address by ID
      const index = list.findIndex((a) => a.id === data.id);
      saved = {
        ...(list[index] || {}),
        isDefault: data.isDefault ?? list[index]?.isDefault ?? false,
        ...data,
        id: data.id,
      } as SavedAddress;

      if (data.isDefault) {
        list.forEach((a) => {
          if (a.id !== data.id) a.isDefault = false;
        });
      }
      if (index >= 0) {
        list[index] = saved;
      } else {
        list.push(saved);
      }
    } else {
      // Check if duplicate exists before creating
      const existingIndex = list.findIndex((a) => isSameAddress(a, data));
      if (existingIndex >= 0) {
        list[existingIndex] = {
          ...list[existingIndex],
          ...data,
          id: list[existingIndex].id,
          isDefault: data.isDefault ?? list[existingIndex].isDefault ?? false,
        };
        if (data.isDefault) {
          list.forEach((a) => {
            if (a.id !== list[existingIndex].id) a.isDefault = false;
          });
        }
        if (typeof window !== 'undefined') {
          persistAddresses(list);
        }
        return list[existingIndex];
      }

      // Create new address
      saved = {
        label: data.label || 'Saved Location',
        addressLine2: data.addressLine2 || '',
        ...data,
        id: 'addr-' + Date.now(),
        isDefault: data.isDefault ?? false,
      };

      if (saved.isDefault) {
        list.forEach((a) => (a.isDefault = false));
      }

      list.unshift(saved);
    }

    const cappedList = list.slice(0, MAX_SAVED_ADDRESSES);

    if (typeof window !== 'undefined') {
      persistAddresses(cappedList);
    }

    return saved;
  },

  /**
   * Deletes a saved address
   */
  deleteAddress(id: string): void {
    let list = this.getSavedAddresses();
    list = list.filter((a) => a.id !== id);

    if (typeof window !== 'undefined') {
      persistAddresses(list);
    }
  },

  /**
   * Removes any default address from saved addresses storage
   */
  removeDefaultAddress(): void {
    const list = this.getSavedAddresses().filter((a) => !a.isDefault);
    if (typeof window !== 'undefined') {
      persistAddresses(list);
    }
  },

  /**
   * Sets an address as the default shipping address
   */
  setDefaultAddress(id: string): void {
    const list = this.getSavedAddresses();
    list.forEach((a) => {
      a.isDefault = a.id === id;
    });

    if (typeof window !== 'undefined') {
      persistAddresses(list);
    }
  },

  /**
   * Gets stored user profile or null
   */
  getStoredUser(): UserProfile | null {
    if (userStorageUnavailable) return inMemoryUser;
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(USER_STORAGE_KEY);
      if (!stored) return null;
      const parsed: UserProfile = JSON.parse(stored);
      const isGoogleOrRemoteAvatar =
        parsed.avatar &&
        (parsed.avatar.includes('googleusercontent.com') ||
          (parsed.avatar.startsWith('https://') && !parsed.avatar.includes('unsplash.com')));

      if (
        !parsed.avatar ||
        parsed.avatar.includes('/reviews/') ||
        parsed.avatar.includes('unsplash.com') ||
        (!isGoogleOrRemoteAvatar && parsed.avatar.startsWith('http'))
      ) {
        parsed.avatar = '/assets/ilovesurprises/Profile/profile image.webp';
      }
      inMemoryUser = parsed;
      return parsed;
    } catch {
      return null;
    }
  },

  /**
   * Updates stored user profile
   */
  updateStoredUser(user: UserProfile | null): void {
    inMemoryUser = user;
    userStorageUnavailable = false;
    if (typeof window === 'undefined') return;
    try {
      if (user) {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(USER_STORAGE_KEY);
        localStorage.removeItem('ils_consultant_subscribed');
        localStorage.removeItem('ils_consultant_username');
        localStorage.removeItem('ils_consultant_name');
      }
    } catch (err) {
      // Storage quota exceeded: evict non-essential cached data and retry
      try {
        const nonEssentialPrefixes = [
          'ILOVESURPRISES_QUERY_CACHE',
          'ilovesurprises_reviews',
          'ilovesurprises_notifications',
          'ilovesurprises_product_overrides',
          'ilovesurprises_admin_collections',
          'ilovesurprises_admin_homepage_content',
        ];
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && nonEssentialPrefixes.some((p) => key.startsWith(p))) {
            localStorage.removeItem(key);
          }
        }
        if (user) {
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
        }
      } catch {
        userStorageUnavailable = true;
        // inMemoryUser preserves the active session seamlessly
      }
    }
  },

  /**
   * Retrieves user settings
   */
  getUserSettings(): UserSettings {
    if (typeof window === 'undefined') {
      return this.getDefaultSettings();
    }
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
      return this.getDefaultSettings();
    } catch {
      return this.getDefaultSettings();
    }
  },

  getDefaultSettings(): UserSettings {
    return {
      emailNotifications: true,
      smsNotifications: true,
      orderStatusUpdates: true,
      surpriseDropAlerts: true,
      marketingEmails: false,
      twoFactorEnabled: false,
      currency: 'USD ($)',
      language: 'English (US)',
    };
  },

  /**
   * Updates user settings
   */
  updateUserSettings(settings: Partial<UserSettings>): UserSettings {
    const current = this.getUserSettings();
    const updated = { ...current, ...settings };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('ilovesurprises_settings_updated'));
      } catch (err) {
        console.error('Failed to update user settings', err);
      }
    }
    return updated;
  },
};
