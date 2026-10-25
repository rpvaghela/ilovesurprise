import React from 'react';
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  DollarSign,
  BarChart3,
  Settings,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  X,
  UserCheck,
  Gem,
  Package,
  Layers,
  Layout,
  LogOut,
} from 'lucide-react';
import type { AdminTab, AdminRole } from '../../types/admin';
import { ADMIN_ROLES_CONFIG } from '../../services/adminService';
import { accountService } from '../../services/accountService';

interface AdminSidebarProps {
  currentTab: AdminTab;
  currentRole: AdminRole;
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onSelectTab: (tab: AdminTab) => void;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  onSwitchRole: (role: AdminRole) => void;
  onReturnToStore: () => void;
  onLogout?: () => void;
  pendingCommissionsCount?: number;
  pendingRepsCount?: number;
  lowStockProductsCount?: number;
  processingOrdersCount?: number;
  pendingAppraisalsCount?: number;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  currentTab,
  currentRole,
  isCollapsed,
  isMobileOpen,
  onSelectTab,
  onToggleCollapse,
  onCloseMobile,
  onSwitchRole: _onSwitchRole,
  onReturnToStore,
  onLogout,
  pendingCommissionsCount = 0,
  pendingRepsCount = 0,
  lowStockProductsCount = 0,
  processingOrdersCount = 0,
  pendingAppraisalsCount = 0,
}) => {
  const currentRoleDef = ADMIN_ROLES_CONFIG[currentRole];
  const currentUser = accountService.getStoredUser();

  const NAV_ITEMS: {
    id: AdminTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    badgeColor?: string;
  }[] = [
      { id: 'overview', label: 'Executive Overview', icon: LayoutDashboard },
      {
        id: 'products',
        label: 'Products & Stock',
        icon: Package,
        badge: lowStockProductsCount > 0 ? `${lowStockProductsCount} Low` : undefined,
        badgeColor: 'bg-amber-100 text-amber-900 border border-amber-200',
      },
      { id: 'collections', label: 'Collections', icon: Layers },
      {
        id: 'orders',
        label: 'Orders & Shipping',
        icon: ShoppingBag,
        badge: processingOrdersCount > 0 ? `${processingOrdersCount} New` : undefined,
        badgeColor: 'bg-blue-100 text-blue-900 border border-blue-200',
      },
      { id: 'customers', label: 'Customer Registry', icon: UserCheck },
      {
        id: 'representatives',
        label: 'Representatives',
        icon: Users,
        badge: pendingRepsCount > 0 ? `${pendingRepsCount}` : undefined,
        badgeColor: 'bg-red-100 text-[#D30915] border border-red-200',
      },
      {
        id: 'appraisals',
        label: 'Jewelry Appraisals',
        icon: Gem,
        badge: pendingAppraisalsCount > 0 ? `${pendingAppraisalsCount}` : undefined,
        badgeColor: 'bg-indigo-100 text-indigo-900 border border-indigo-200',
      },
      {
        id: 'commissions',
        label: 'Commissions Ledger',
        icon: DollarSign,
        badge: pendingCommissionsCount > 0 ? `${pendingCommissionsCount}` : undefined,
        badgeColor: 'bg-amber-100 text-amber-900 border border-amber-200',
      },
      { id: 'content', label: 'Homepage Content', icon: Layout },
      { id: 'reports', label: 'Analytics & Reports', icon: BarChart3 },
      { id: 'permissions', label: 'Roles & Staff', icon: ShieldCheck },
      { id: 'settings', label: 'System Settings', icon: Settings },
    ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-[#eedbe6] text-[#141219] select-none">
      {/* 1. Header & Brand */}
      <div className="p-4 sm:p-5 flex items-center justify-between border-b border-[#f4e2ed]">
        <div className="flex items-center gap-2.5 overflow-hidden">
          {(!isCollapsed || isMobileOpen) ? (
            <div className="flex flex-col gap-1.5 min-w-0">
              <img
                src="/assets/ilovesurprises/logo/logo-16k.png"
                alt="ILoveSurprises"
                width={8192}
                height={2728}
                className="h-[44px] sm:h-[50px] w-auto max-w-[200px] object-contain drop-shadow-2xs"
                style={{
                  imageRendering: '-webkit-optimize-contrast',
                  WebkitBackfaceVisibility: 'hidden',
                  backfaceVisibility: 'hidden',
                  transform: 'translateZ(0)',
                }}
              />
              <span className="self-start text-[10px] font-bold tracking-wider uppercase text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/80 shadow-2xs">
                Admin Suite
              </span>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#D30915] to-[#F0444E] text-white flex items-center justify-center shrink-0 shadow-md">
              <img src="/favicon.svg" alt="ILoveSurprises" className="w-6 h-6 object-contain" />
            </div>
          )}
        </div>

        {/* Mobile close or desktop collapse */}
        {isMobileOpen ? (
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-2 rounded-lg hover:bg-[#fff1f2] hover:text-[#D30915] text-[#716d77] active:scale-90 transition-all cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg hover:bg-[#fff1f2] hover:text-[#D30915] text-[#716d77] active:scale-90 transition-all cursor-pointer"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>


      {/* 3. Navigation Links */}
      <nav className="flex-1 p-2.5 sm:p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          const isAllowed = currentRoleDef.allowedTabs.includes(item.id);

          return (
            <button
              key={item.id}
              id={`admin-nav-${item.id}`}
              data-tab={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                if (isMobileOpen) onCloseMobile();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold active:scale-[0.98] transition-all cursor-pointer relative ${isActive
                  ? 'bg-[#D30915] text-white shadow-[0_4px_16px_rgba(211, 9, 21,0.25)]'
                  : isAllowed
                    ? 'text-[#55505a] hover:bg-[#fff1f2] hover:text-[#D30915]'
                    : 'text-[#9c97a2] hover:bg-gray-50 opacity-75'
                }`}
              title={item.label}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : ''}`} />

              {(!isCollapsed || isMobileOpen) && (
                <>
                  <span className="truncate flex-1 text-left">{item.label}</span>
                  {!isAllowed && (
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight bg-gray-100 px-1 py-0.2 rounded">
                      Locked
                    </span>
                  )}
                  {item.badge && isAllowed && (
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white text-[#D30915]' : item.badgeColor
                        }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* 4. Active Operator & Account Footer */}
      <div className="p-3 border-t border-stone-200/80 bg-stone-50/60 space-y-2">
        {(!isCollapsed || isMobileOpen) ? (
          <>
            {/* Operator Session Card */}
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-stone-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#141219] to-[#2b2733] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                {currentRole === 'super_admin' ? (
                  <ShieldCheck className="w-4 h-4 text-rose-400" />
                ) : (
                  <UserCheck className="w-4 h-4 text-stone-200" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-xs text-stone-900 truncate">
                    {currentRoleDef?.name || 'Administrator'}
                  </span>
                  <span className="flex items-center gap-1 text-[9px] font-bold uppercase text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Online
                  </span>
                </div>
                <div className="text-[11px] text-stone-500 font-medium truncate mt-0.5">
                  {currentUser?.email || (currentRole === 'super_admin' ? 'Primary Executive' : 'Staff Operator')}
                </div>
              </div>
            </div>

            {/* Quick Action Controls */}
            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={onReturnToStore}
                className="h-8 px-2.5 rounded-lg border border-stone-200/90 bg-white hover:bg-stone-50 hover:border-stone-300 text-[11px] font-semibold text-stone-700 hover:text-stone-950 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-[0.98]"
                title="Return to Public Storefront"
              >
                <ExternalLink className="w-3.5 h-3.5 text-stone-500" />
                <span className="truncate">Storefront</span>
              </button>

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  id="admin-sidebar-logout-btn"
                  className="h-8 px-2.5 rounded-lg border border-stone-200/90 hover:border-rose-200 bg-white hover:bg-rose-50 text-[11px] font-semibold text-stone-700 hover:text-rose-600 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-[0.98]"
                  title="Sign Out of Admin Suite"
                >
                  <LogOut className="w-3.5 h-3.5 text-stone-500 group-hover:text-rose-600" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-9 h-9 rounded-lg bg-white border border-stone-200/90 flex items-center justify-center text-stone-700 shadow-2xs"
              title={`${currentRoleDef?.name || 'Administrator'} (${currentUser?.email || 'Active'})`}
            >
              <ShieldCheck className="w-4 h-4 text-[#D30915]" />
            </div>
            <button
              type="button"
              onClick={onReturnToStore}
              className="w-9 h-9 rounded-lg bg-white border border-stone-200/90 hover:border-stone-300 text-stone-600 hover:text-stone-900 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
              title="Return to Storefront"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="w-9 h-9 rounded-lg bg-white border border-stone-200/90 hover:border-rose-200 hover:bg-rose-50 text-stone-600 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block h-screen sticky top-0 shrink-0 transition-all duration-300 z-30 ${isCollapsed ? 'w-20' : 'w-64'
          }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-[280px] max-w-[85vw] h-full shadow-2xl z-10 animate-slide-right">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
