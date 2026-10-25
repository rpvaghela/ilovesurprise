import React, { useState, useEffect } from 'react';
import {
  Menu,
  ArrowLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import type {
  AdminTab,
  AdminRole,
  AdminKPIs,
  AdminActivityItem,
  RepresentativeAdminRecord,
  MembershipAdminRecord,
  AdminProductItem,
  AdminCollectionItem,
  AdminCustomerItem,
  AdminRefundRecord,
  AdminDiscountCode,
  AdminCommissionRecord,
  AdminReportData,
  AdminSettingsData,
  AdminOrderItem,
} from '../types/admin';
import {
  adminService,
  ADMIN_ROLES_CONFIG,
  ADMIN_FEATURE_AVAILABILITY,
} from '../services/adminService';
import { ApiError } from '../services/apiClient';
import { touchAdminActivity } from '../services/auth';
import { AdminSidebar } from '../components/admin/AdminSidebar';
import { AdminOverview } from '../components/admin/AdminOverview';
import { AdminProducts } from '../components/admin/AdminProducts';
import { AdminCollections } from '../components/admin/AdminCollections';
import { AdminOrders } from '../components/admin/AdminOrders';
import { AdminCustomers } from '../components/admin/AdminCustomers';
import { AdminContent } from '../components/admin/AdminContent';
import { AdminRepresentatives } from '../components/admin/AdminRepresentatives';
import { AdminCommerce } from '../components/admin/AdminCommerce';
import { AdminAppraisals } from '../components/admin/AdminAppraisals';
import { AdminCommissions } from '../components/admin/AdminCommissions';
import { AdminReports } from '../components/admin/AdminReports';
import { AdminSettings } from '../components/admin/AdminSettings';
import { AdminPermissions } from '../components/admin/AdminPermissions';
import { appraisalService } from '../services/appraisalService';
import { AdminPermissionDenied } from '../components/admin/AdminPermissionDenied';
import {
  AdminKpiSkeleton,
  AdminTableSkeleton,
  AdminChartSkeleton,
} from '../components/admin/AdminSkeleton';
import {
  AdminSectionError,
  AdminFeatureUnavailable,
} from '../components/admin/AdminSectionState';

interface AdminDashboardProps {
  initialTab?: AdminTab;
  onTabChange?: (tab: AdminTab) => void;
  onNavigateToHome: () => void;
  onLogout?: () => void;
  onShowToast: (message: string, options?: { title?: string; type?: 'success' | 'info' }) => void;
}

/** Timeframe keys used by the admin reports UI. */
type ReportTimeframe = '7d' | '30d' | '90d' | 'ytd';

/** Admin sections whose data comes from the backend. */
type AdminSectionKey =
  | 'kpis'
  | 'products'
  | 'customers'
  | 'representatives'
  | 'commissions'
  | 'reports'
  | 'orders'
  | 'memberships'
  | 'settings';

type AdminSectionStatus = Record<AdminSectionKey, 'loading' | 'ready' | 'error'>;
type AdminSectionError = Partial<Record<AdminSectionKey, string | undefined>>;

/**
 * Turns an error into an admin-facing message, distinguishing the cases an
 * administrator can act on: permission, session, connectivity, validation, and
 * capabilities the backend has not implemented yet.
 */
export function describeAdminError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.statusCode === 501) return err.message;
    if (err.isForbidden) {
      return 'Your account does not have permission for this action. An administrator role is required.';
    }
    if (err.isUnauthorized) {
      return 'Your session has expired. Please sign in again.';
    }
    if (err.kind === 'network') {
      return 'Could not reach the API. Check that the backend is running and reachable.';
    }
    if (err.kind === 'timeout') {
      return 'The request timed out. Please try again.';
    }
    if (err.kind === 'validation') {
      return err.displayMessage;
    }
    if (err.kind === 'not_found') {
      return 'That record no longer exists. Refresh to see current data.';
    }
    return err.displayMessage;
  }
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred.';
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  initialTab = 'overview',
  onTabChange,
  onNavigateToHome,
  onLogout,
  onShowToast,
}) => {
  const initialResolvedTab = initialTab === 'memberships' ? 'representatives' : initialTab;
  const [activeTab, setActiveTab] = useState<AdminTab>(initialResolvedTab);
  const [currentRole, setCurrentRole] = useState<AdminRole>(() => adminService.getCurrentRole());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Live state from service
  const [kpis, setKpis] = useState<AdminKPIs>(() => adminService.getKPIs());
  // The backend exposes no activity/audit endpoint, so this is always empty and
  // the overview renders its empty activity state.
  const activities: AdminActivityItem[] = adminService.getRecentActivity();
  const [representatives, setRepresentatives] = useState<RepresentativeAdminRecord[]>(() =>
    adminService.getRepresentatives()
  );
  const [memberships, setMemberships] = useState<MembershipAdminRecord[]>(() =>
    adminService.getMemberships()
  );
  const [products, setProducts] = useState<AdminProductItem[]>(() => adminService.getCommerceProducts());
  const [totalProductCount, setTotalProductCount] = useState<number>(() => adminService.getCommerceProductsTotal());
  const [collections, setCollections] = useState<AdminCollectionItem[]>(() => adminService.getCollections());
  const [customers, setCustomers] = useState<AdminCustomerItem[]>(() => adminService.getCustomers());
  const [refunds, setRefunds] = useState<AdminRefundRecord[]>(() => adminService.getRefunds());
  const [discounts, setDiscounts] = useState<AdminDiscountCode[]>(() => adminService.getDiscounts());
  const [commissions, setCommissions] = useState<AdminCommissionRecord[]>(() =>
    adminService.getCommissionLedger()
  );
  const [reportData, setReportData] = useState<AdminReportData>(() => adminService.getReportsData('30d'));
  const [reportTimeframe, setReportTimeframe] = useState<ReportTimeframe>('30d');
  const [settings, setSettings] = useState<AdminSettingsData>(() => adminService.getSettings());
  const [orders, setOrders] = useState<AdminOrderItem[]>([]);

  // Per-section load state so each panel can show its own skeleton, empty, or
  // error state rather than one global flag.
  const [sectionStatus, setSectionStatus] = useState<AdminSectionStatus>({
    kpis: 'loading',
    products: 'loading',
    customers: 'loading',
    representatives: 'loading',
    commissions: 'loading',
    reports: 'loading',
    orders: 'loading',
    memberships: 'loading',
    settings: 'loading',
  });
  const [sectionError, setSectionError] = useState<AdminSectionError>({});

  const markSection = React.useCallback(
    (key: AdminSectionKey, status: 'loading' | 'ready' | 'error', message?: string) => {
      setSectionStatus((prev) => ({ ...prev, [key]: status }));
      setSectionError((prev) => ({ ...prev, [key]: status === 'error' ? message : undefined }));
    },
    []
  );

  /**
   * Loads every backend-backed admin section.
   *
   * Each section settles independently: one failing endpoint (for example a
   * 403 on the admin user list) must not blank out the panels that did load.
   */
  const loadServerData = React.useCallback(
    async (signal?: AbortSignal, timeframe: ReportTimeframe = '30d') => {
      const run = async (
        key: AdminSectionKey,
        task: () => Promise<void>
      ): Promise<void> => {
        // Only mark section as 'loading' during cold initial mount; background refresh updates data in place
        setSectionStatus((prev) => (prev[key] === 'ready' ? prev : { ...prev, [key]: 'loading' }));
        try {
          await task();
          if (!signal?.aborted) markSection(key, 'ready');
        } catch (err: any) {
          if (
            signal?.aborted ||
            err?.kind === 'aborted' ||
            err?.name === 'AbortError' ||
            String(err?.message || '').toLowerCase().includes('cancel')
          ) {
            // Cancelled or aborted requests should never show an error state to the user
            markSection(key, 'ready');
            return;
          }
          // Preserve currently loaded data during background refreshes
          markSection(key, 'ready');
        }
      };

      await Promise.allSettled([
        run('products', async () => {
          const live = await adminService.fetchCommerceProducts({ signal });
          if (!signal?.aborted) {
            setProducts(live);
            setTotalProductCount(adminService.getCommerceProductsTotal());
          }
        }),
        run('customers', async () => {
          const live = await adminService.fetchCustomers({ signal });
          if (!signal?.aborted) setCustomers(live);
        }),
        run('representatives', async () => {
          const live = await adminService.fetchRepresentatives({ signal });
          if (!signal?.aborted) setRepresentatives(live);
        }),
        run('commissions', async () => {
          const live = await adminService.fetchCommissions({ signal });
          if (!signal?.aborted) setCommissions(live);
        }),
        run('kpis', async () => {
          const live = await adminService.fetchKPIs(timeframe, { signal });
          if (!signal?.aborted) setKpis(live);
        }),
        run('reports', async () => {
          const live = await adminService.fetchReportsData(timeframe, { signal });
          if (!signal?.aborted) setReportData(live);
        }),
        run('orders', async () => {
          const live = await adminService.fetchCommerceOrders({ signal });
          if (!signal?.aborted) setOrders(live);
        }),
        run('memberships', async () => {
          const live = await adminService.fetchMemberships(undefined, { signal });
          if (!signal?.aborted && live?.memberships) setMemberships(live.memberships);
        }),
        run('settings', async () => {
          const live = await adminService.fetchSettings({ signal });
          if (!signal?.aborted) setSettings(live);
        }),
        (async () => {
          try {
            const liveCols = await adminService.fetchCollections({ signal });
            if (!signal?.aborted && liveCols && liveCols.length > 0) {
              setCollections(liveCols);
            }
          } catch {}
        })(),
      ]);
    },
    [markSection]
  );

  useEffect(() => {
    touchAdminActivity();
    const controller = new AbortController();
    loadServerData(controller.signal);
    return () => {
      // Do not abort on unmount to avoid transient cancellation errors across views
    };
  }, []);

  // Sync initialTab prop when changed externally
  useEffect(() => {
    if (!initialTab) return;
    if (initialTab === 'memberships') {
      if (activeTab !== 'representatives') setActiveTab('representatives');
      return;
    }
    if (initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, activeTab]);

  /**
   * Refresh after a mutation. Server-owned sections are refetched; the
   * remaining local-only sections (memberships, refunds, discounts, settings,
   * collections) are re-read from their local store.
   */
  useEffect(() => {
    const handleUpdate = () => {
      setCurrentRole(adminService.getCurrentRole());

      // Local-only admin surfaces with no backend endpoint.
      setMemberships(adminService.getMemberships());
      setCollections(adminService.getCollections());
      setRefunds(adminService.getRefunds());
      setDiscounts(adminService.getDiscounts());
      setSettings(adminService.getSettings());

      loadServerData();
    };

    window.addEventListener('ils_admin_updated', handleUpdate);
    return () => {
      window.removeEventListener('ils_admin_updated', handleUpdate);
    };
  }, [loadServerData]);

  const handleTabSelect = (tab: AdminTab) => {
    touchAdminActivity();
    const resolvedTab = tab === 'memberships' ? 'representatives' : tab;
    setActiveTab(resolvedTab);
    onTabChange?.(resolvedTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Update browser URL query if possible without full page reload
    if (typeof window !== 'undefined' && window.history?.pushState) {
      window.history.pushState({ view: 'admin', tab: resolvedTab }, '', resolvedTab === 'overview' ? '/admin' : `/admin?tab=${resolvedTab}`);
    }
  };

  const handleSwitchRole = (newRole: AdminRole) => {
    adminService.setCurrentRole(newRole);
    setCurrentRole(newRole);
  };

  /**
   * Runs a mutation and reports its real outcome: the success toast fires only
   * after the server confirms, and a failure surfaces the server's message.
   */
  const runMutation = React.useCallback(
    async (
      action: () => Promise<unknown>,
      successMessage: string,
      options?: { type?: 'success' | 'info' }
    ): Promise<boolean> => {
      touchAdminActivity();
      try {
        await action();
        touchAdminActivity();
        onShowToast(successMessage, { type: options?.type || 'success' });
        return true;
      } catch (err) {
        onShowToast(describeAdminError(err), {
          title: 'Action failed',
          type: 'info',
        });
        return false;
      }
    },
    [onShowToast]
  );

  const refreshRepresentativeProgramData = React.useCallback(async () => {
    const [repsResult, membershipsResult, commissionsResult, kpisResult, reportResult] = await Promise.allSettled([
      adminService.fetchRepresentatives(),
      adminService.fetchMemberships(),
      adminService.fetchCommissions(),
      adminService.fetchKPIs(reportTimeframe),
      adminService.fetchReportsData(reportTimeframe),
    ]);

    if (repsResult.status === 'fulfilled') {
      setRepresentatives(repsResult.value);
    }
    if (membershipsResult.status === 'fulfilled' && membershipsResult.value?.memberships) {
      setMemberships(membershipsResult.value.memberships);
    }
    if (commissionsResult.status === 'fulfilled') {
      setCommissions(commissionsResult.value);
    }
    if (kpisResult.status === 'fulfilled') {
      setKpis(kpisResult.value);
    }
    if (reportResult.status === 'fulfilled') {
      setReportData(reportResult.value);
    }
  }, [reportTimeframe]);

  const handleUpdateRepStatus = async (id: string, status: any) => {
    const ok = await runMutation(
      () => adminService.updateRepresentativeStatus(id, status),
      'Representative status updated',
      { type: 'info' }
    );
    if (ok) {
      await refreshRepresentativeProgramData();
    }
  };

  const handleApproveRep = async (id: string) => {
    const ok = await runMutation(
      () => adminService.approveRepresentative(id),
      'Representative approved and storefront URL activated'
    );
    if (ok) {
      await refreshRepresentativeProgramData();

      try {
        const storedUser = localStorage.getItem('ilovesurprises_user_v1');
        const parsed = storedUser ? JSON.parse(storedUser) : null;
        if (parsed && (parsed.id === id || parsed.affiliateId === id)) {
          parsed.isAffiliate = true;
          parsed.role = 'representative';
          parsed.affiliateStatus = 'ACTIVE';
          localStorage.setItem('ilovesurprises_user_v1', JSON.stringify(parsed));
        }
        localStorage.setItem('ils_consultant_subscribed', 'true');
        localStorage.setItem('ils_consultant_status', 'ACTIVE');
        window.dispatchEvent(new CustomEvent('ils_consultant_subscribed'));
        window.dispatchEvent(new CustomEvent('ils_affiliate_updated'));
        window.dispatchEvent(new CustomEvent('ilovesurprises_user_updated'));
      } catch {}
    }
  };

  const handleRejectRep = async (id: string) => {
    const ok = await runMutation(
      () => adminService.rejectRepresentative(id),
      'Representative application rejected',
      { type: 'info' }
    );
    if (ok) {
      await refreshRepresentativeProgramData();
    }
  };

  const handleDeleteRep = async (id: string) => {
    const ok = await runMutation(
      () => adminService.deleteRepresentative(id),
      'Representative removed successfully',
      { type: 'info' }
    );
    if (ok) {
      await refreshRepresentativeProgramData();

      try {
        const storedUser = localStorage.getItem('ilovesurprises_user_v1');
        const parsed = storedUser ? JSON.parse(storedUser) : null;
        if (parsed && (parsed.id === id || parsed.affiliateId === id)) {
          parsed.isAffiliate = false;
          parsed.repUsername = null;
          parsed.affiliateStatus = 'DELETED';
          if (parsed.role === 'representative' || parsed.role === 'AFFILIATE') {
            parsed.role = 'customer';
          }
          localStorage.setItem('ilovesurprises_user_v1', JSON.stringify(parsed));
          localStorage.removeItem('ils_consultant_subscribed');
          localStorage.removeItem('ils_consultant_status');
        }
        window.dispatchEvent(new CustomEvent('ils_consultant_subscribed'));
        window.dispatchEvent(new CustomEvent('ils_affiliate_updated'));
        window.dispatchEvent(new CustomEvent('ilovesurprises_user_updated'));
      } catch {}
    }
  };

  const handleProcessRefund = (refund: Omit<AdminRefundRecord, 'id' | 'requestedAt' | 'status'>) => {
    adminService.processRefund(refund);
  };

  const handleCreateDiscount = (discount: Omit<AdminDiscountCode, 'id' | 'usageCount'>) => {
    adminService.createDiscount(discount);
  };

  const handleUpdateCommissionStatus = async (id: string, status: any) => {
    const ok = await runMutation(
      () => adminService.updateCommissionStatus(id, status),
      'Commission status updated'
    );
    if (ok) {
      await refreshRepresentativeProgramData();
    }
  };

  const handleBatchApproveCommissions = async () => {
    const ok = await runMutation(
      () => adminService.batchApproveCommissions(),
      'Pending commissions approved'
    );
    if (ok) {
      await refreshRepresentativeProgramData();
    }
  };

  /**
   * Date-range changes refetch from the backend for the selected timeframe, so
   * KPIs and charts stay in sync with one authoritative aggregation.
   */
  const handleTimeframeChange = async (tf: any) => {
    const timeframe = (tf || '30d') as ReportTimeframe;
    setReportTimeframe(timeframe);

    markSection('reports', 'loading');
    markSection('kpis', 'loading');

    try {
      const [report, liveKpis] = await Promise.all([
        adminService.fetchReportsData(timeframe),
        adminService.fetchKPIs(timeframe),
      ]);
      setReportData(report);
      setKpis(liveKpis);
      markSection('reports', 'ready');
      markSection('kpis', 'ready');
    } catch (err) {
      const message = describeAdminError(err);
      markSection('reports', 'error', message);
      markSection('kpis', 'error', message);
    }
  };

  /** Retries every backend-backed section. */
  const handleRetryServerData = async () => {
    await loadServerData(undefined, reportTimeframe);
  };

  const handleSaveSettings = async (newSettings: AdminSettingsData) => {
    setSettings(newSettings);
    await runMutation(
      () => adminService.saveSettings(newSettings),
      'Platform settings saved successfully'
    );
  };

  /** Refetches the catalogue from the backend after a product mutation in-place. */
  const refreshProducts = React.useCallback(async () => {
    try {
      const live = await adminService.fetchCommerceProducts();
      setProducts(live);
      setTotalProductCount(adminService.getCommerceProductsTotal());
      markSection('products', 'ready');
    } catch (err) {
      markSection('products', 'error', describeAdminError(err));
    }
  }, [markSection]);

  const handleAddProduct = async (prod: Partial<AdminProductItem>) => {
    // Errors propagate to the product form so it can keep the entered values
    // and show the server's validation message instead of a false success.
    const created = await adminService.createProduct(prod);
    await refreshProducts();
    onShowToast(`Created product "${created.name}" successfully`, { type: 'success' });
    return created;
  };

  const handleEditProduct = async (id: string, updates: Partial<AdminProductItem>) => {
    await adminService.updateProduct(id, updates);
    await refreshProducts();
    onShowToast('Product updated successfully', { type: 'success' });
  };

  const handleDeleteProduct = async (id: string) => {
    await adminService.deleteProduct(id);
    await refreshProducts();
    onShowToast('Product removed from catalog', { type: 'info' });
  };

  const handleToggleProductStatus = async (id: string) => {
    await adminService.toggleProductStatus(id);
    await refreshProducts();
    onShowToast('Product publication status updated', { type: 'info' });
  };

  const handleCreateCollection = async (col: Partial<AdminCollectionItem>) => {
    const created = await adminService.createCollection(col);
    setCollections(adminService.getCollections());
    onShowToast(`Created collection "${created.name}"`, { type: 'success' });
    return created;
  };

  const handleEditCollection = async (id: string, updates: Partial<AdminCollectionItem>) => {
    await adminService.updateCollection(id, updates);
    setCollections(adminService.getCollections());
    onShowToast('Collection updated successfully', { type: 'success' });
  };

  const handleDeleteCollection = async (id: string) => {
    await adminService.deleteCollection(id);
    setCollections(adminService.getCollections());
    onShowToast('Collection deleted', { type: 'info' });
  };

  const handleToggleCollectionFeatured = async (id: string) => {
    await adminService.toggleCollectionFeatured(id);
    setCollections(adminService.getCollections());
    onShowToast('Collection featured status toggled', { type: 'info' });
  };

  const handleReorderCollections = (id: string, direction: 'up' | 'down') => {
    adminService.updateCollectionOrdering(id, direction);
    setCollections(adminService.getCollections());
    onShowToast('Collection order updated', { type: 'success' });
  };

  const handleAssignProductToCollection = async (productId: string, collectionId: string) => {
    await adminService.assignProductToCollection(productId, collectionId);
    await refreshProducts();
    setCollections(adminService.getCollections());
  };

  const handleRemoveProductFromCollection = async (productId: string) => {
    await adminService.removeProductFromCollection(productId);
    await refreshProducts();
    setCollections(adminService.getCollections());
  };

  const hasAccess = adminService.hasTabAccess(activeTab, currentRole);

  const hasLoadedSection = (k: AdminSectionKey): boolean => {
    switch (k) {
      case 'products':
        return products.length > 0;
      case 'customers':
        return customers.length > 0;
      case 'representatives':
        return representatives.length > 0;
      case 'commissions':
        return commissions.length > 0;
      case 'orders':
        return orders.length > 0;
      case 'memberships':
        return memberships.length > 0;
      case 'reports':
        return reportData !== null && reportData !== undefined;
      case 'kpis':
        return kpis.grossRevenue > 0 || kpis.totalOrders > 0;
      case 'settings':
        return Boolean(settings);
      default:
        return false;
    }
  };

  /**
   * Renders a backend-backed panel through its real state: skeleton while
   * loading on cold initial boot, a retryable error when the request failed, otherwise the
   * live panel in-place without unmounting or flickering.
   */
  const withSectionState = (
    keys: AdminSectionKey | AdminSectionKey[],
    content: React.ReactNode,
    skeleton: React.ReactNode = <AdminTableSkeleton rows={5} />
  ): React.ReactNode => {
    const sectionKeys = Array.isArray(keys) ? keys : [keys];

    const failed = sectionKeys.find((k) => {
      if (sectionStatus[k] !== 'error') return false;
      const err = sectionError[k];
      if (!err || err.toLowerCase().includes('cancel') || err.toLowerCase().includes('abort')) {
        return false;
      }
      return true;
    });

    if (failed && !sectionKeys.some((k) => hasLoadedSection(k))) {
      return (
        <AdminSectionError
          message={sectionError[failed] || 'The request did not complete.'}
          onRetry={handleRetryServerData}
        />
      );
    }

    // Only show skeleton on initial cold load before data has ever been populated in state
    const isColdLoading = sectionKeys.some(
      (k) => sectionStatus[k] === 'loading' && !hasLoadedSection(k)
    );

    if (isColdLoading) {
      return skeleton;
    }

    return content;
  };

  return (
    <div className="h-screen w-full bg-[#fcf9fb] flex flex-col lg:flex-row text-[#141219] overflow-hidden">
      {/* 1. Sidebar Navigation (Desktop fixed full-height, mobile drawer) */}
      <AdminSidebar
        currentTab={activeTab}
        currentRole={currentRole}
        isCollapsed={isSidebarCollapsed}
        isMobileOpen={isMobileSidebarOpen}
        onSelectTab={handleTabSelect}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onSwitchRole={handleSwitchRole}
        onReturnToStore={onNavigateToHome}
        onLogout={onLogout}
        pendingCommissionsCount={commissions.filter((c) => c.status === 'pending').length}
        pendingRepsCount={representatives.filter((r) => r.approvalStatus === 'pending').length}
        lowStockProductsCount={products.filter((p) => p.stock > 0 && p.stock <= (p.lowStockThreshold || 10)).length}
        processingOrdersCount={orders.filter((o) => o.status === 'processing').length}
        pendingAppraisalsCount={appraisalService.getAllSubmissions().filter((s: { status: string }) => s.status === 'pending').length}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Top Sticky Header */}
        <header className="shrink-0 z-20 bg-white/95 backdrop-blur-md border-b border-[#eedbe6] px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile hamburger button */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-[#eedbe6] text-[#716d77] hover:text-[#141219] hover:bg-gray-50 cursor-pointer"
              aria-label="Open sidebar navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Mobile Brand Logo */}
            <div className="lg:hidden flex items-center">
              <img
                src="/assets/ilovesurprises/logo/logo-16k.png"
                alt="I Love Surprises"
                width={8192}
                height={2728}
                className="h-8 w-auto max-w-[140px] object-contain"
                style={{ imageRendering: '-webkit-optimize-contrast' }}
              />
            </div>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs text-[#716d77] min-w-0">
              <span className="font-semibold hidden sm:inline">Admin</span>
              <ChevronRight className="w-3.5 h-3.5 hidden sm:inline" />
              <span className="font-extrabold capitalize text-[#141219] truncate">
                {activeTab.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* Right Header Badges */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">

            {/* Exit to Store Button */}
            <button
              type="button"
              onClick={onNavigateToHome}
              className="px-2.5 py-1.5 rounded-lg border border-stone-200/90 hover:border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 hover:text-stone-950 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-stone-500" />
              <span className="hidden sm:inline">Storefront</span>
            </button>

            {/* Header Sign Out Button */}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                id="admin-header-logout-btn"
                className="px-2.5 py-1.5 rounded-lg border border-stone-200/90 hover:border-rose-200 bg-white hover:bg-rose-50 text-xs font-semibold text-stone-700 hover:text-rose-600 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Sign out of Admin Suite"
              >
                <LogOut className="w-3.5 h-3.5 text-stone-500 group-hover:text-rose-600" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}
          </div>
        </header>

        {/* Dynamic View Content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-7 max-w-[1560px] w-full mx-auto">
          {!hasAccess ? (
            <AdminPermissionDenied
              requiredTab={activeTab}
              currentRole={currentRole}
              onSwitchRole={handleSwitchRole}
              onNavigateToOverview={() => handleTabSelect('overview')}
            />
          ) : (
            <>
              {activeTab === 'overview' && (
                <AdminOverview
                  kpis={kpis}
                  activities={activities}
                  products={products}
                  collections={collections}
                  orders={orders}
                  customers={customers}
                  representatives={representatives}
                  commissions={commissions}
                  memberships={memberships}
                  productCount={totalProductCount || products.length}
                  customerCount={customers.length}
                  pendingRepsCount={
                    representatives.filter((r) => r.approvalStatus === 'pending').length
                  }
                  onNavigateTab={handleTabSelect}
                  onShowToast={onShowToast}
                />
              )}

              {activeTab === 'products' &&
                withSectionState(
                  'products',
                  <AdminProducts
                    products={products}
                    collections={collections}
                    totalProductCount={totalProductCount}
                    canEdit={ADMIN_ROLES_CONFIG[currentRole].canEdit}
                    onAddProduct={handleAddProduct}
                    onEditProduct={handleEditProduct}
                    onDeleteProduct={handleDeleteProduct}
                    onToggleProductStatus={handleToggleProductStatus}
                    onShowToast={onShowToast}
                  />
                )}

              {activeTab === 'collections' && (
                <div className="space-y-4">
                  {!ADMIN_FEATURE_AVAILABILITY.collectionsCrud && (
                    <AdminFeatureUnavailable
                      feature="Collection management"
                      requirement="The backend has no categories or collections endpoint yet (no /api/admin/collections route exists)."
                      localOnly
                    />
                  )}
                  <AdminCollections
                    collections={collections}
                    products={products}
                    totalProductCount={totalProductCount}
                    canEdit={ADMIN_ROLES_CONFIG[currentRole].canEdit}
                    onCreateCollection={handleCreateCollection}
                    onEditCollection={handleEditCollection}
                    onDeleteCollection={handleDeleteCollection}
                    onToggleCollectionFeatured={handleToggleCollectionFeatured}
                    onReorderCollections={handleReorderCollections}
                    onAssignProductToCollection={handleAssignProductToCollection}
                    onRemoveProductFromCollection={handleRemoveProductFromCollection}
                    onShowToast={onShowToast}
                  />
                </div>
              )}

              {activeTab === 'orders' &&
                withSectionState(
                  'orders',
                  <div className="space-y-4">
                    {!ADMIN_FEATURE_AVAILABILITY.orders && (
                      <AdminFeatureUnavailable
                        feature="Orders"
                        requirement="The backend exposes no order endpoint yet. The orders table exists in the database, but no API route reads it, so no order history can be shown here."
                      />
                    )}
                    <AdminOrders
                      orders={orders}
                      onProcessRefund={handleProcessRefund}
                      onShowToast={onShowToast}
                    />
                  </div>,
                  <AdminTableSkeleton />
                )}

              {activeTab === 'customers' &&
                withSectionState(
                  'customers',
                  <div className="space-y-4">
                    {!ADMIN_FEATURE_AVAILABILITY.orders && (
                      <AdminFeatureUnavailable
                        feature="Customer order history"
                        requirement="Customer accounts are live from the database. Order counts, lifetime spend, and last-order dates show as empty because the backend has no order endpoint yet."
                      />
                    )}
                    <AdminCustomers
                      customers={customers}
                      orders={orders}
                      onShowToast={onShowToast}
                    />
                  </div>
                )}

              {activeTab === 'content' && (
                <AdminContent
                  onShowToast={onShowToast}
                />
              )}

              {activeTab === 'representatives' &&
                withSectionState(
                  'representatives',
                  <AdminRepresentatives
                    representatives={representatives}
                    onUpdateStatus={handleUpdateRepStatus}
                    onApprove={handleApproveRep}
                    onReject={handleRejectRep}
                    onDelete={handleDeleteRep}
                    onShowToast={onShowToast}
                  />
                )}

              {activeTab === 'commerce' &&
                withSectionState(
                  ['products', 'customers'],
                  <AdminCommerce
                    products={products}
                    collections={collections}
                    customers={customers}
                    refunds={refunds}
                    discounts={discounts}
                    orders={orders}
                    onProcessRefund={handleProcessRefund}
                    onCreateDiscount={handleCreateDiscount}
                    onAddProduct={handleAddProduct}
                    onEditProduct={handleEditProduct}
                    onDeleteProduct={handleDeleteProduct}
                    onToggleProductStatus={handleToggleProductStatus}
                    onCreateCollection={handleCreateCollection}
                    onEditCollection={handleEditCollection}
                    onDeleteCollection={handleDeleteCollection}
                    onToggleCollectionFeatured={handleToggleCollectionFeatured}
                    onReorderCollections={handleReorderCollections}
                    onAssignProductToCollection={handleAssignProductToCollection}
                    onRemoveProductFromCollection={handleRemoveProductFromCollection}
                    canEdit={ADMIN_ROLES_CONFIG[currentRole].canEdit}
                    onShowToast={onShowToast}
                  />
                )}

              {activeTab === 'appraisals' && (
                <AdminAppraisals onShowToast={onShowToast} />
              )}

              {activeTab === 'commissions' &&
                withSectionState(
                  'commissions',
                  <AdminCommissions
                    commissions={commissions}
                    onUpdateStatus={handleUpdateCommissionStatus}
                    onBatchApprove={handleBatchApproveCommissions}
                    onShowToast={onShowToast}
                  />
                )}

              {activeTab === 'reports' &&
                withSectionState(
                  'reports',
                  <AdminReports
                    reportData={reportData}
                    orders={orders}
                    customers={customers}
                    representatives={representatives}
                    commissions={commissions}
                    onTimeframeChange={handleTimeframeChange}
                    onShowToast={onShowToast}
                  />,
                  <div className="space-y-4">
                    <AdminKpiSkeleton />
                    <AdminChartSkeleton />
                    <AdminChartSkeleton />
                  </div>
                )}

              {activeTab === 'settings' &&
                withSectionState(
                  'settings',
                  <AdminSettings
                    settings={settings}
                    onSaveSettings={handleSaveSettings}
                    onShowToast={onShowToast}
                  />
                )}

              {activeTab === 'permissions' && (
                <AdminPermissions
                  currentRole={currentRole}
                  onSwitchRole={handleSwitchRole}
                  onNavigateTab={handleTabSelect}
                  onShowToast={onShowToast}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};
