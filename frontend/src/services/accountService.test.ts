import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { accountService } from './accountService';

const ADDRESSES_STORAGE_KEY = 'ilovesurprises_addresses_v1';

describe('accountService saved addresses', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  const address = {
    fullName: 'Test Customer',
    phone: '5551234567',
    addressLine1: '123 Test Street',
    addressLine2: '',
    city: 'Austin',
    state: 'TX',
    zipCode: '78701',
    country: 'United States',
    label: 'Delivery Address',
  };

  it('continues when localStorage quota is exceeded and falls back to sessionStorage', () => {
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function setItem(this: Storage, key, value) {
      if (this === localStorage && key === ADDRESSES_STORAGE_KEY) {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }
      return originalSetItem.call(this, key, value);
    });

    expect(() => accountService.saveAddress(address)).not.toThrow();

    expect(localStorage.getItem(ADDRESSES_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(ADDRESSES_STORAGE_KEY)).toContain('123 Test Street');
    expect(accountService.getSavedAddresses()).toHaveLength(1);
  });
});
