import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Check,
  X,
  Lock,
  UserCheck,
  UserPlus,
  Trash2,
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  Edit2,
} from 'lucide-react';
import type { AdminRole, AdminTab, AdminStaffUser } from '../../types/admin';
import { adminService, ADMIN_ROLES_CONFIG } from '../../services/adminService';

interface AdminPermissionsProps {
  currentRole: AdminRole;
  onSwitchRole?: (role: AdminRole) => void;
  onNavigateTab: (tab: AdminTab) => void;
  onShowToast: (message: string, options?: { title?: string; type?: 'success' | 'info' }) => void;
}

export const AdminPermissions: React.FC<AdminPermissionsProps> = ({
  currentRole,
  onSwitchRole: _onSwitchRole,
  onNavigateTab,
  onShowToast,
}) => {
  const ALL_ROLES: AdminRole[] = ['super_admin', 'store_manager', 'affiliate_manager', 'support_rep'];
  const [roleConfigs, setRoleConfigs] = useState(() => adminService.getRoleDefinitions());
  const [staffList, setStaffList] = useState<AdminStaffUser[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);

  // Add Staff Member Modal State
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [newStaffRole, setNewStaffRole] = useState<AdminRole>('store_manager');
  const [isSubmittingStaff, setIsSubmittingStaff] = useState(false);
  const [addStaffError, setAddStaffError] = useState<string | null>(null);

  // Edit Staff Member Modal State
  const [editingStaff, setEditingStaff] = useState<AdminStaffUser | null>(null);
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffEmail, setEditStaffEmail] = useState('');
  const [editStaffRole, setEditStaffRole] = useState<AdminRole>('store_manager');
  const [editStaffStatus, setEditStaffStatus] = useState<'active' | 'invited' | 'suspended'>('active');
  const [editStaffPassword, setEditStaffPassword] = useState('');
  const [showEditStaffPassword, setShowEditStaffPassword] = useState(false);
  const [isSubmittingEditStaff, setIsSubmittingEditStaff] = useState(false);
  const [editStaffError, setEditStaffError] = useState<string | null>(null);

  const isProtectedStaffAccount = (staff: Pick<AdminStaffUser, 'id' | 'email' | 'role'>) =>
    staff.id === 'staff-primary-admin' ||
    staff.email.toLowerCase() === 'ilovesurprisedotcom@gmail.com';

  useEffect(() => {
    adminService.getStaffAdmins().then((users) => {
      setStaffList(users);
      setIsLoadingStaff(false);
    });
  }, []);

  const handleOpenEditStaff = (staff: AdminStaffUser) => {
    if (currentRole !== 'super_admin') {
      onShowToast('Only Super Admin can edit staff accounts', { type: 'info' });
      return;
    }
    setEditingStaff(staff);
    setEditStaffName(staff.name);
    setEditStaffEmail(staff.email);
    setEditStaffRole(staff.role);
    setEditStaffStatus(staff.status || 'active');
    setEditStaffPassword('');
    setShowEditStaffPassword(false);
    setEditStaffError(null);
  };

  const handleEditStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setEditStaffError(null);

    const cleanName = editStaffName.trim();
    const cleanEmail = editStaffEmail.trim().toLowerCase();
    const cleanPassword = editStaffPassword.trim();

    if (!cleanName) {
      setEditStaffError('Please enter the full name of the staff member.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setEditStaffError('Please enter a valid administrative email address.');
      return;
    }
    if (cleanPassword && cleanPassword.length < 6) {
      setEditStaffError('If changing the login password, it must be at least 6 characters.');
      return;
    }

    setIsSubmittingEditStaff(true);
    try {
      await adminService.updateStaffMember(editingStaff.id, {
        name: cleanName,
        email: cleanEmail,
        role: editStaffRole,
        status: editStaffStatus,
        password: cleanPassword || undefined,
      });

      const refreshed = await adminService.getStaffAdmins();
      setStaffList(refreshed);
      setEditingStaff(null);

      onShowToast(
        `Staff member "${cleanName}" was successfully updated.`,
        { type: 'success', title: 'Staff Account Updated' }
      );
    } catch (err: any) {
      setEditStaffError(err?.message || 'Failed to update staff member.');
    } finally {
      setIsSubmittingEditStaff(false);
    }
  };

  const handleUpdateStaffRole = async (staffId: string, newRole: AdminRole, staffName: string) => {
    if (currentRole !== 'super_admin') {
      onShowToast('Only Super Admin can assign administrative roles', { type: 'info' });
      return;
    }
    await adminService.updateStaffRole(staffId, newRole);
    const refreshed = await adminService.getStaffAdmins();
    setStaffList(refreshed);
    onShowToast(`Assigned ${ADMIN_ROLES_CONFIG[newRole].name} to ${staffName}`, {
      type: 'success',
    });
  };

  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddStaffError(null);

    const cleanName = newStaffName.trim();
    const cleanEmail = newStaffEmail.trim().toLowerCase();
    const cleanPassword = newStaffPassword.trim();

    if (!cleanName) {
      setAddStaffError('Please enter the full name of the staff member.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setAddStaffError('Please enter a valid administrative email address.');
      return;
    }
    if (!cleanPassword || cleanPassword.length < 6) {
      setAddStaffError('Please enter a login password of at least 6 characters.');
      return;
    }

    setIsSubmittingStaff(true);
    try {
      const created = await adminService.addStaffMember({
        name: cleanName,
        email: cleanEmail,
        password: cleanPassword,
        role: newStaffRole,
        status: 'active',
      });

      const refreshed = await adminService.getStaffAdmins();
      setStaffList(refreshed);

      setIsAddStaffModalOpen(false);
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPassword('');
      setShowStaffPassword(false);
      setNewStaffRole('store_manager');

      onShowToast(
        `Staff member "${created.name}" created! Login credentials are now active for ${created.email}.`,
        { type: 'success', title: 'Staff Member Added' }
      );
    } catch (err: any) {
      setAddStaffError(err?.message || 'Failed to add staff member.');
    } finally {
      setIsSubmittingStaff(false);
    }
  };

  const handleRemoveStaff = async (staff: AdminStaffUser) => {
    if (currentRole !== 'super_admin') {
      onShowToast('Only Super Admin can remove staff members', { type: 'info' });
      return;
    }
    if (isProtectedStaffAccount(staff)) {
      onShowToast('Primary administrator account is protected and cannot be deleted.', { type: 'info' });
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to remove staff member "${staff.name}" (${staff.email})?`
    );
    if (!confirmed) return;

    try {
      await adminService.removeStaffMember(staff.id);
      const refreshed = await adminService.getStaffAdmins();
      setStaffList(refreshed);
      onShowToast(`Removed staff member "${staff.name}".`, { type: 'success' });
    } catch (err: any) {
      onShowToast(err?.message || 'Failed to remove staff member.', { type: 'info' });
    }
  };

  const PERMISSION_GROUPS: {
    tab: AdminTab;
    label: string;
    description: string;
  }[] = [
    { tab: 'overview', label: 'Executive Overview', description: 'Platform sales velocity, MRR, 7 KPI cards, live activity feeds' },
    { tab: 'products', label: 'Product Catalog', description: 'Catalog items, inventory thresholds, multi-variants, photo gallery' },
    { tab: 'collections', label: 'Collections Management', description: 'Storefront showcases, content writeups, product mapping' },
    { tab: 'orders', label: 'Orders & Fulfillment', description: 'Customer checkouts, carrier tracking, order manifests, refunds' },
    { tab: 'customers', label: 'Customer Registry', description: 'Customer profiles, order history, lifetime spend, referrer links' },
    { tab: 'representatives', label: 'Representatives', description: 'Representative approvals, membership billing status, downline audit, and account suspension' },
    { tab: 'appraisals', label: 'Jewelry Appraisals', description: 'Appraisal requests, certificate lookup, valuation audits' },
    { tab: 'commissions', label: 'Commissions Ledger', description: '35% multi-tier distribution ledger, payouts, clawbacks' },
    { tab: 'content', label: 'Homepage Content', description: 'Cash Candles, Trending, Zodiac showcase cards, announcements' },
    { tab: 'reports', label: 'Analytics & Reports', description: 'Detailed sales reports, traffic conversion, MRR, CSV exports' },
    { tab: 'settings', label: 'System Configuration', description: 'Attribution windows, restricted usernames, starter kits, gateways' },
    { tab: 'permissions', label: 'Roles & Access Control', description: 'Role assignment, security privileges, role matrix' },
  ];

  const handleTogglePermission = (role: AdminRole, tab: AdminTab, label: string) => {
    if (currentRole !== 'super_admin') {
      onShowToast('Only Super Admin can modify role permissions', { type: 'info' });
      return;
    }
    if (role === 'super_admin') {
      onShowToast('Super Admin permissions are immutable and mandatory', { type: 'info' });
      return;
    }
    if (tab === 'settings' || tab === 'permissions') {
      onShowToast(`Security Policy: "${label}" is strictly restricted to Super Admin only.`, {
        type: 'info',
        title: 'Restricted Action',
      });
      return;
    }

    const currentAllowed = roleConfigs[role].allowedTabs;
    const isCurrentlyAllowed = currentAllowed.includes(tab);
    const updatedTabs = isCurrentlyAllowed
      ? currentAllowed.filter((t) => t !== tab)
      : [...currentAllowed, tab];

    const updated = adminService.updateRolePermissions(role, updatedTabs);
    setRoleConfigs(updated);
    onShowToast(
      `${isCurrentlyAllowed ? 'Revoked' : 'Granted'} "${label}" for ${roleConfigs[role].name}`,
      { type: 'success', title: 'Permission Updated' }
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 1. Header & Current Role Banner */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-[#eedbe6] shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#D30915]" />
              <h2 className="text-xl font-black text-[#141219] hero-title-font m-0">
                Administrative Roles & RBAC Matrix
              </h2>
            </div>
            <p className="text-xs text-[#716d77] m-0 mt-0.5">
              Granular role-based access control and operational privilege assignments.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#faf7f9] border border-[#eedbe6]">
              <span className="text-xs text-[#716d77] font-medium">Logged In:</span>
              <span className="text-xs font-black text-[#D30915]">
                {ADMIN_ROLES_CONFIG[currentRole].name}
              </span>
            </div>
          </div>
        </div>

        {/* Role Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {ALL_ROLES.map((roleKey) => {
            const r = ADMIN_ROLES_CONFIG[roleKey];
            const isSelected = currentRole === roleKey;

            return (
              <div
                key={roleKey}
                className={`p-4 rounded-2xl border transition-all space-y-2 relative overflow-hidden ${
                  isSelected
                    ? 'border-[#D30915] bg-[#fffbfd] shadow-sm ring-2 ring-[#D30915]/10'
                    : 'border-[#eedbe6] bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-[#141219]">{r.name}</span>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-[#D30915] animate-pulse" />
                  )}
                </div>
                <p className="text-[11px] text-[#716d77] m-0 leading-relaxed">{r.description}</p>

                <div className="pt-2 flex items-center justify-between text-xs border-t border-gray-100">
                  <span className="text-[10px] font-bold text-[#D30915] uppercase">{r.badge}</span>
                  {isSelected && (
                    <span className="px-2 py-0.5 rounded-md bg-[#fff1f2] text-[#D30915] text-[10px] font-black uppercase">
                      Current Role ✓
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Administrative Staff Accounts */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#eedbe6] shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#eedbe6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-[#D30915]" />
              <h3 className="text-base font-black text-[#141219] hero-title-font m-0">
                Administrative Staff & Role Assignments
              </h3>
            </div>
            <p className="text-xs text-[#716d77] m-0 mt-0.5">
              Verified administrative personnel connected to store operations. Add staff members and manage roles.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-[#D30915] bg-[#fff1f2] px-2.5 py-1 rounded-full">
              {staffList.length} Operators
            </span>

            <button
              id="admin-add-staff-btn"
              type="button"
              disabled={currentRole !== 'super_admin'}
              onClick={() => {
                if (currentRole !== 'super_admin') {
                  onShowToast('Only Super Admin can add staff members', { type: 'info' });
                  return;
                }
                setAddStaffError(null);
                setIsAddStaffModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#D30915] hover:bg-[#b80712] text-white text-xs font-bold uppercase tracking-wider transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Staff Member</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-left text-xs text-[#141219]">
            <thead className="bg-[#fdf9fb] border-b border-[#eedbe6] text-[10px] font-extrabold uppercase text-[#716d77] tracking-wider">
              <tr>
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-3">Email Address</th>
                <th className="py-3 px-3">Assigned Role</th>
                <th className="py-3 px-3">Role Capabilities</th>
                <th className="py-3 px-4 text-right">Modify Assignment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f5eaf1] font-medium">
              {isLoadingStaff ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-xs text-[#716d77]">
                    Loading staff members from administrative directory...
                  </td>
                </tr>
              ) : staffList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-xs text-[#716d77]">
                    No staff records found. Click "Add Staff Member" above to create one.
                  </td>
                </tr>
              ) : (
                staffList.map((staff) => {
                  const config = ADMIN_ROLES_CONFIG[staff.role] || ADMIN_ROLES_CONFIG.store_manager;
                  const isFounder = isProtectedStaffAccount(staff);

                  return (
                    <tr key={staff.id} className="hover:bg-[#fffbfd] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#fff1f2] border border-[#eedbe6] text-[#D30915] flex items-center justify-center font-bold text-xs shrink-0">
                            {staff.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-[#141219]">{staff.name}</div>
                            {isFounder ? (
                              <span className="inline-block text-[9px] font-black uppercase text-[#D30915] bg-[#fff1f2] px-1.5 py-0.2 rounded">
                                Founder & Primary
                              </span>
                            ) : staff.status === 'invited' ? (
                              <span className="inline-block text-[9px] font-bold uppercase text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded">
                                Invited
                              </span>
                            ) : (
                              <span className="inline-block text-[9px] font-bold uppercase text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                                Active Operator
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-mono text-xs text-[#141219]">{staff.email}</div>
                        <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-semibold mt-0.5">
                          <KeyRound className="w-3 h-3 text-emerald-600" />
                          <span>Login Credentials Active</span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#faf7f9] border border-[#eedbe6] text-[#141219]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#D30915]" />
                          <span>{config.name}</span>
                        </span>
                      </td>

                      <td className="py-3 px-3 text-[#716d77] text-[11px] max-w-xs">
                        {config.description}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isFounder ? (
                            <>
                              <span className="text-[11px] font-bold text-[#716d77] italic">Immutable Super Admin</span>
                              {currentRole === 'super_admin' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditStaff(staff)}
                                  title="Edit administrator details"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#eedbe6] bg-white hover:bg-[#fff1f2] hover:border-[#fecdd3] text-[#141219] hover:text-[#D30915] text-xs font-bold transition-all shadow-2xs cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-[#D30915]" />
                                  <span>Edit</span>
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              <select
                                disabled={currentRole !== 'super_admin'}
                                value={staff.role}
                                onChange={(e) => handleUpdateStaffRole(staff.id, e.target.value as AdminRole, staff.name)}
                                className="h-8 px-2.5 rounded-lg bg-[#faf7f9] border border-[#eedbe6] text-xs font-bold text-[#141219] disabled:opacity-40"
                              >
                                <option value="super_admin">Super Administrator</option>
                                <option value="store_manager">Store Manager</option>
                                <option value="affiliate_manager">Affiliate Director</option>
                                <option value="support_rep">Customer Support</option>
                              </select>

                              {currentRole === 'super_admin' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditStaff(staff)}
                                  title="Edit staff details and credentials"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#eedbe6] bg-white hover:bg-[#fff1f2] hover:border-[#fecdd3] text-[#141219] hover:text-[#D30915] text-xs font-bold transition-all shadow-2xs cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-[#D30915]" />
                                  <span>Edit</span>
                                </button>
                              )}

                              {currentRole === 'super_admin' && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveStaff(staff)}
                                  title="Remove staff account"
                                  className="p-1.5 rounded-lg border border-transparent hover:border-rose-200 hover:bg-rose-50 text-[#716d77] hover:text-rose-600 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Member Modal */}
      {isAddStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141219]/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-white border border-[#eedbe6] rounded-2xl sm:rounded-3xl shadow-2xl p-6 relative z-10"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-staff-modal-title"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#eedbe6]">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#D30915]" />
                <h3 id="add-staff-modal-title" className="text-base sm:text-lg font-black text-[#141219]">
                  Add Staff Member
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddStaffModalOpen(false)}
                className="text-[#716d77] hover:text-[#141219] p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addStaffError && (
              <div
                className="p-3 rounded-xl my-3 text-xs font-bold bg-[#fff0f3] text-[#D30915] border border-[#fecdd3] flex items-start gap-2"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{addStaffError}</span>
              </div>
            )}

            <form onSubmit={handleAddStaffSubmit} className="space-y-4 mt-3">
              <div>
                <label className="block text-xs font-bold text-[#141219] uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  className="w-full h-10 px-3 bg-[#faf7f9] border border-[#eedbe6] rounded-xl text-xs font-semibold text-[#141219] placeholder-[#9c93a4] focus:bg-white focus:outline-none focus:border-[#D30915]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#141219] uppercase tracking-wider mb-1">
                  Email Address (Login ID)
                </label>
                <input
                  type="email"
                  required
                  placeholder="alex.morgan@ilovesurprises.com"
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  className="w-full h-10 px-3 bg-[#faf7f9] border border-[#eedbe6] rounded-xl text-xs font-semibold text-[#141219] placeholder-[#9c93a4] focus:bg-white focus:outline-none focus:border-[#D30915]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-[#141219] uppercase tracking-wider">
                    Staff Login Password
                  </label>
                  <span className="text-[10px] font-semibold text-[#716d77]">
                    Min. 6 characters
                  </span>
                </div>
                <div className="relative">
                  <input
                    type={showStaffPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter login password for staff member"
                    value={newStaffPassword}
                    onChange={(e) => setNewStaffPassword(e.target.value)}
                    className="w-full h-10 pl-3 pr-10 bg-[#faf7f9] border border-[#eedbe6] rounded-xl text-xs font-semibold text-[#141219] placeholder-[#9c93a4] focus:bg-white focus:outline-none focus:border-[#D30915]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffPassword(!showStaffPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#716d77] hover:text-[#141219] transition-colors p-1 cursor-pointer"
                    aria-label={showStaffPassword ? 'Hide password' : 'Show password'}
                  >
                    {showStaffPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-[#716d77] mt-1 m-0">
                  Sets the credentials enabling this staff member to sign in to the Administrative Control Center with their email and password.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#141219] uppercase tracking-wider mb-1">
                  Assigned Administrative Role
                </label>
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value as AdminRole)}
                  className="w-full h-10 px-3 bg-[#faf7f9] border border-[#eedbe6] rounded-xl text-xs font-bold text-[#141219] focus:outline-none focus:border-[#D30915]"
                >
                  <option value="store_manager">Store Operations Manager</option>
                  <option value="affiliate_manager">Affiliate & Rep Director</option>
                  <option value="support_rep">Customer Support Specialist</option>
                  <option value="super_admin">Super Administrator</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#f4e2ed]">
                <button
                  type="button"
                  onClick={() => setIsAddStaffModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-[#716d77] hover:text-[#141219] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStaff}
                  className="px-5 py-2.5 rounded-xl bg-[#D30915] hover:bg-[#b80712] text-white text-xs sm:text-sm font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmittingStaff ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Adding Staff...</span>
                    </>
                  ) : (
                    <span>Add Staff Member</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Member Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141219]/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-white border border-[#eedbe6] rounded-2xl sm:rounded-3xl shadow-2xl p-6 relative z-10"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-staff-modal-title"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#eedbe6]">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-[#D30915]" />
                <h3 id="edit-staff-modal-title" className="text-base sm:text-lg font-black text-[#141219]">
                  Edit Staff Member
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="text-[#716d77] hover:text-[#141219] p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editStaffError && (
              <div
                className="p-3 rounded-xl my-3 text-xs font-bold bg-[#fff0f3] text-[#D30915] border border-[#fecdd3] flex items-start gap-2"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{editStaffError}</span>
              </div>
            )}

            <form onSubmit={handleEditStaffSubmit} className="space-y-4 mt-3">
              <div>
                <label className="block text-xs font-bold text-[#141219] uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={editStaffName}
                  onChange={(e) => setEditStaffName(e.target.value)}
                  className="w-full h-10 px-3 bg-[#faf7f9] border border-[#eedbe6] rounded-xl text-xs font-semibold text-[#141219] placeholder-[#9c93a4] focus:bg-white focus:outline-none focus:border-[#D30915]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-[#141219] uppercase tracking-wider">
                    Email Address (Login ID)
                  </label>
                  {isProtectedStaffAccount(editingStaff) && (
                    <span className="text-[10px] font-bold text-[#D30915] bg-[#fff1f2] px-1.5 py-0.2 rounded">
                      Primary Admin (Protected)
                    </span>
                  )}
                </div>
                <input
                  type="email"
                  required
                  disabled={isProtectedStaffAccount(editingStaff)}
                  placeholder="alex.morgan@ilovesurprises.com"
                  value={editStaffEmail}
                  onChange={(e) => setEditStaffEmail(e.target.value)}
                  className="w-full h-10 px-3 bg-[#faf7f9] border border-[#eedbe6] rounded-xl text-xs font-semibold text-[#141219] placeholder-[#9c93a4] focus:bg-white focus:outline-none focus:border-[#D30915] disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-[#141219] uppercase tracking-wider">
                    Update Login Password
                  </label>
                  <span className="text-[10px] font-semibold text-[#716d77]">
                    Optional (Leave blank to keep unchanged)
                  </span>
                </div>
                <div className="relative">
                  <input
                    type={showEditStaffPassword ? 'text' : 'password'}
                    placeholder="Enter new password (min. 6 chars)"
                    value={editStaffPassword}
                    onChange={(e) => setEditStaffPassword(e.target.value)}
                    className="w-full h-10 pl-3 pr-10 bg-[#faf7f9] border border-[#eedbe6] rounded-xl text-xs font-semibold text-[#141219] placeholder-[#9c93a4] focus:bg-white focus:outline-none focus:border-[#D30915]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditStaffPassword(!showEditStaffPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#716d77] hover:text-[#141219] transition-colors p-1 cursor-pointer"
                    aria-label={showEditStaffPassword ? 'Hide password' : 'Show password'}
                  >
                    {showEditStaffPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#141219] uppercase tracking-wider mb-1">
                  Assigned Administrative Role
                </label>
                <select
                  disabled={isProtectedStaffAccount(editingStaff)}
                  value={editStaffRole}
                  onChange={(e) => setEditStaffRole(e.target.value as AdminRole)}
                  className="w-full h-10 px-3 bg-[#faf7f9] border border-[#eedbe6] rounded-xl text-xs font-bold text-[#141219] focus:outline-none focus:border-[#D30915] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="super_admin">Super Administrator</option>
                  <option value="store_manager">Store Operations Manager</option>
                  <option value="affiliate_manager">Affiliate & Rep Director</option>
                  <option value="support_rep">Customer Support Specialist</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#141219] uppercase tracking-wider mb-1">
                  Account Status
                </label>
                <select
                  disabled={isProtectedStaffAccount(editingStaff)}
                  value={editStaffStatus}
                  onChange={(e) => setEditStaffStatus(e.target.value as 'active' | 'invited' | 'suspended')}
                  className="w-full h-10 px-3 bg-[#faf7f9] border border-[#eedbe6] rounded-xl text-xs font-bold text-[#141219] focus:outline-none focus:border-[#D30915] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="active">Active Operator</option>
                  <option value="invited">Invited / Pending</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#f4e2ed]">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-[#716d77] hover:text-[#141219] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEditStaff}
                  className="px-5 py-2.5 rounded-xl bg-[#D30915] hover:bg-[#b80712] text-white text-xs sm:text-sm font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmittingEditStaff ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. RBAC Permissions Matrix Table */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#eedbe6] shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#eedbe6] flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-[#141219] hero-title-font m-0">
              Module Access Matrix
            </h3>
            <p className="text-xs text-[#716d77] m-0">
              {currentRole === 'super_admin'
                ? 'Super Admin Mode: Click any staff permission below to toggle live privileges. System settings and permissions matrix are strictly locked to Super Admin.'
                : 'Visual map of allowed sections per administrative profile.'}
            </p>
          </div>
          <span className="text-xs text-[#716d77] font-medium hidden sm:inline">
            Click any module to navigate directly
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-left text-xs text-[#141219]">
            <thead className="bg-[#fdf9fb] border-b border-[#eedbe6] text-[11px] font-extrabold uppercase text-[#716d77] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Admin Module</th>
                <th className="py-3.5 px-3 text-center">Super Admin</th>
                <th className="py-3.5 px-3 text-center">Store Manager</th>
                <th className="py-3.5 px-3 text-center">Affiliate Director</th>
                <th className="py-3.5 px-3 text-center">Support Rep</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {PERMISSION_GROUPS.map((group) => (
                <tr key={group.tab} className="hover:bg-[#fffbfd] transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-sm text-[#141219] flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onNavigateTab(group.tab)}
                        className="hover:text-[#D30915] transition-colors text-left font-bold cursor-pointer"
                      >
                        {group.label}
                      </button>
                    </div>
                    <div className="text-[11px] text-[#716d77]">{group.description}</div>
                  </td>

                  {/* Super Admin */}
                  <td className="py-3.5 px-3 text-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-600">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </span>
                  </td>

                  {/* Other Roles: store_manager, affiliate_manager, support_rep */}
                  {(['store_manager', 'affiliate_manager', 'support_rep'] as AdminRole[]).map((rKey) => {
                    const isRestricted = group.tab === 'settings' || group.tab === 'permissions';
                    const isAllowed = roleConfigs[rKey].allowedTabs.includes(group.tab);

                    if (isRestricted) {
                      return (
                        <td key={rKey} className="py-3.5 px-3 text-center">
                          <span
                            title="Restricted: Critical system operations reserved for Super Admin"
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-stone-100 text-stone-400"
                          >
                            <Lock className="w-3.5 h-3.5 text-stone-400" />
                          </span>
                        </td>
                      );
                    }

                    return (
                      <td key={rKey} className="py-3.5 px-3 text-center">
                        <button
                          type="button"
                          disabled={currentRole !== 'super_admin'}
                          onClick={() => handleTogglePermission(rKey, group.tab, group.label)}
                          title={
                            currentRole === 'super_admin'
                              ? `Click to ${isAllowed ? 'Revoke' : 'Grant'} access for ${roleConfigs[rKey].name}`
                              : undefined
                          }
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full transition-transform ${
                            currentRole === 'super_admin' ? 'hover:scale-110 cursor-pointer' : 'cursor-default'
                          } ${
                            isAllowed
                              ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                        >
                          {isAllowed ? <Check className="w-4 h-4 stroke-[3]" /> : <X className="w-4 h-4" />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
