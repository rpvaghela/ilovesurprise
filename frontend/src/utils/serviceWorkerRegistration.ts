/**
 * Service Worker Registration Utility
 * Handles safe registration, lifecycle updates, and unregistration.
 */

export interface ServiceWorkerConfig {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
}

export function registerServiceWorker(_config?: ServiceWorkerConfig): void {
  // Unregister service worker to prevent stale caching issues on active e-commerce storefront
  unregisterServiceWorker();
}

export function unregisterServiceWorker(): void {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      })
      .catch((error) => {
        console.warn('Service worker unregister error:', error);
      });

    if ('caches' in window) {
      caches.keys().then((keys) => {
        for (const key of keys) {
          caches.delete(key);
        }
      }).catch(() => {});
    }
  }
}
