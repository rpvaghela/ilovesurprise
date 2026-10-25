import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  Users,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  X,
  Check,
  Ban,
  Copy,
  Camera,
  Upload,
  Trash2,
} from 'lucide-react';
import type { RepresentativeAdminRecord, RepStatus } from '../../types/admin';
import { qualificationService } from '../../services/qualificationService';
import { attributionService } from '../../services/attributionService';
import { adminService } from '../../services/adminService';

interface AdminRepresentativesProps {
  representatives: RepresentativeAdminRecord[];
  onUpdateStatus: (id: string, status: RepStatus) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDelete?: (id: string) => void;
  onShowToast: (message: string, options?: { title?: string; type?: 'success' | 'info' }) => void;
}

const RepAvatar: React.FC<{
  name: string;
  avatar?: string;
  size?: string;
  rounded?: string;
}> = ({ name, avatar, size = 'w-9 h-9', rounded = 'rounded-full' }) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [avatar]);

  const initials = useMemo(() => {
    const parts = (name || '').trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return ((name || '').slice(0, 2) || 'RP').toUpperCase();
  }, [name]);

  const bgGradient = useMemo(() => {
    const gradients = [
      'from-[#D30915] to-[#f43f5e]',
      'from-[#7c3aed] to-[#a855f7]',
      'from-[#059669] to-[#10b981]',
      'from-[#2563eb] to-[#38bdf8]',
      'from-[#d97706] to-[#f59e0b]',
      'from-[#db2777] to-[#ec4899]',
    ];
    let hash = 0;
    const str = name || 'Rep';
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
  }, [name]);

  if (!avatar || hasError) {
    return (
      <div
        className={`${size} ${rounded} bg-gradient-to-tr ${bgGradient} text-white font-black text-xs flex items-center justify-center shadow-xs border border-white/60 shrink-0 select-none tracking-wider`}
        title={name}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={avatar}
      alt={name}
      onError={() => setHasError(true)}
      className={`${size} ${rounded} object-cover border border-[#eedbe6] shrink-0`}
    />
  );
};

export const AdminRepresentatives: React.FC<AdminRepresentativesProps> = ({
  representatives,
  onUpdateStatus,
  onApprove,
  onReject,
  onDelete,
  onShowToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RepStatus>('all');
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [selectedRep, setSelectedRep] = useState<RepresentativeAdminRecord | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    repId: string;
    action: 'approve' | 'reject' | 'suspend' | 'activate' | 'delete';
    repName: string;
  } | null>(null);

  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [uploadTargetRep, setUploadTargetRep] = useState<{ id: string; name: string } | null>(null);

  const triggerUploadForRep = (rep: { id: string; name: string }) => {
    setUploadTargetRep(rep);
    if (avatarFileInputRef.current) {
      avatarFileInputRef.current.value = '';
      avatarFileInputRef.current.click();
    }
  };

  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const target = uploadTargetRep || (selectedRep ? { id: selectedRep.id, name: selectedRep.name } : null);
    if (!file || !target) return;

    if (!file.type.startsWith('image/')) {
      onShowToast('Please select a valid image file (JPG, PNG, WebP).', { type: 'info' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onShowToast('Image size exceeds 5MB limit. Please choose a smaller photo.', { type: 'info' });
      return;
    }

    setIsUploadingAvatar(true);
    const repToUpdate = target;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const dataUrl = event.target?.result as string;
        const newAvatarUrl = await adminService.updateRepresentativeAvatar(repToUpdate.id, dataUrl);
        const resolvedUrl = newAvatarUrl || dataUrl;

        setSelectedRep((prev) => (prev && prev.id === repToUpdate.id ? { ...prev, avatar: resolvedUrl } : prev));

        const repInList = representatives.find((r) => r.id === repToUpdate.id);
        if (repInList) {
          repInList.avatar = resolvedUrl;
        }

        onShowToast(`Photo for ${repToUpdate.name} updated successfully!`, {
          title: 'Photo Updated',
          type: 'success',
        });
      } catch (err: any) {
        onShowToast(err?.message || 'Failed to update representative photo', { type: 'info' });
      } finally {
        setIsUploadingAvatar(false);
        setUploadTargetRep(null);
        if (avatarFileInputRef.current) {
          avatarFileInputRef.current.value = '';
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Filter reps
  const filteredReps = useMemo(() => {
    return representatives.filter((rep) => {
      const matchSearch =
        rep.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rep.repUsername.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rep.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rep.sponsorUsername.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus = statusFilter === 'all' || rep.status === statusFilter;
      const matchApproval = approvalFilter === 'all' || rep.approvalStatus === approvalFilter;

      return matchSearch && matchStatus && matchApproval;
    });
  }, [representatives, searchQuery, statusFilter, approvalFilter]);

  const handleOpenConfirm = (
    repId: string,
    action: 'approve' | 'reject' | 'suspend' | 'activate' | 'delete',
    repName: string
  ) => {
    setConfirmAction({ repId, action, repName });
    setIsConfirmModalOpen(true);
  };

  const handleExecuteConfirm = () => {
    if (!confirmAction) return;

    if (confirmAction.action === 'approve') {
      onApprove(confirmAction.repId);
      onShowToast(`Representative @${confirmAction.repName} approved!`, {
        title: 'Representative Approved',
        type: 'success',
      });
    } else if (confirmAction.action === 'reject') {
      onReject(confirmAction.repId);
      onShowToast(`Representative application for @${confirmAction.repName} rejected.`, {
        title: 'Application Rejected',
        type: 'info',
      });
    } else if (confirmAction.action === 'suspend') {
      onUpdateStatus(confirmAction.repId, 'suspended');
      onShowToast(`Representative @${confirmAction.repName} has been suspended.`, {
        title: 'Account Suspended',
        type: 'info',
      });
    } else if (confirmAction.action === 'activate') {
      onUpdateStatus(confirmAction.repId, 'active');
      onShowToast(`Representative @${confirmAction.repName} set to Active.`, {
        title: 'Account Activated',
        type: 'success',
      });
    } else if (confirmAction.action === 'delete') {
      if (onDelete) {
        onDelete(confirmAction.repId);
      }
    }

    setIsConfirmModalOpen(false);
    setConfirmAction(null);
  };

  const getStatusBadge = (status: RepStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Active</span>
          </span>
        );
      case 'past_due':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
            <AlertTriangle className="w-3 h-3" />
            <span>Past Due</span>
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
            <XCircle className="w-3 h-3" />
            <span>Suspended</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hidden Global Avatar File Input */}
      <input
        ref={avatarFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarFileUpload}
      />

      {/* 1. Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-[#eedbe6] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#D30915]" />
            <h2 className="text-xl font-black text-[#141219] hero-title-font m-0">
              Representatives
            </h2>
            <span className="text-xs font-bold text-[#D30915] bg-[#fff1f2] px-2 py-0.5 rounded-full">
              {representatives.length} Registered
            </span>
          </div>
          <p className="text-xs text-[#716d77] m-0 mt-0.5">
            Manage representative accounts, sponsor lineages, approvals, and VIP membership status in one place.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs font-medium text-[#716d77]">
            Showing <strong className="text-[#141219]">{filteredReps.length}</strong> of {representatives.length}
          </div>
        </div>
      </div>

      {/* Synchronized Representatives Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => {
            setStatusFilter('all');
            setApprovalFilter('all');
            setSearchQuery('');
          }}
          className="p-3.5 rounded-2xl bg-white border border-[#eedbe6] shadow-xs hover:border-[#D30915] transition-all cursor-pointer group"
        >
          <span className="text-[11px] font-bold text-[#716d77]">Total Registered</span>
          <div className="text-xl font-black text-[#141219] mt-0.5">{representatives.length}</div>
          <div className="text-[10px] text-[#716d77] font-medium mt-0.5">Consultant Network</div>
        </div>

        <div
          onClick={() => {
            setApprovalFilter('approved');
            setStatusFilter('active');
          }}
          className="p-3.5 rounded-2xl bg-white border border-[#eedbe6] shadow-xs hover:border-emerald-500 transition-all cursor-pointer group"
        >
          <span className="text-[11px] font-bold text-[#716d77]">Active & Qualified</span>
          <div className="text-xl font-black text-emerald-700 mt-0.5">
            {representatives.filter((r) => r.approvalStatus === 'approved' && r.status === 'active').length}
          </div>
          <div className="text-[10px] text-emerald-600 font-bold mt-0.5">Active Store Links</div>
        </div>

        <div
          onClick={() => setApprovalFilter('pending')}
          className="p-3.5 rounded-2xl bg-white border border-[#eedbe6] shadow-xs hover:border-amber-500 transition-all cursor-pointer group"
        >
          <span className="text-[11px] font-bold text-[#716d77]">Pending Onboarding</span>
          <div className="text-xl font-black text-amber-600 mt-0.5">
            {representatives.filter((r) => r.approvalStatus === 'pending').length}
          </div>
          <div className="text-[10px] text-amber-700 font-medium mt-0.5">Awaiting Review</div>
        </div>

        <div
          onClick={() => setStatusFilter('past_due')}
          className="p-3.5 rounded-2xl bg-white border border-[#eedbe6] shadow-xs hover:border-rose-500 transition-all cursor-pointer group"
        >
          <span className="text-[11px] font-bold text-[#716d77]">Past Due / Suspended</span>
          <div className="text-xl font-black text-rose-600 mt-0.5">
            {representatives.filter((r) => r.status === 'past_due' || r.status === 'suspended').length}
          </div>
          <div className="text-[10px] text-rose-700 font-medium mt-0.5">Needs Attention</div>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-[#eedbe6] shadow-xs">
        {/* Search */}
        <div className="relative lg:col-span-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, @username, email, or sponsor..."
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#faf7f9] border border-[#eedbe6] text-xs text-[#141219] focus:outline-none focus:border-[#D30915]"
          />
          <Search className="w-4 h-4 text-[#8a858f] absolute left-3 top-1/2 -translate-y-1/2" />
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | RepStatus)}
            className="w-full h-10 px-3 rounded-xl bg-[#faf7f9] border border-[#eedbe6] text-xs text-[#141219] font-medium focus:outline-none focus:border-[#D30915] cursor-pointer"
          >
            <option value="all">All Statuses (Active / Past Due / Suspended)</option>
            <option value="active">Active Only</option>
            <option value="past_due">Past Due Only</option>
            <option value="suspended">Suspended Only</option>
          </select>
        </div>

        {/* Approval Filter */}
        <div>
          <select
            value={approvalFilter}
            onChange={(e) => setApprovalFilter(e.target.value as 'all' | 'approved' | 'pending' | 'rejected')}
            className="w-full h-10 px-3 rounded-xl bg-[#faf7f9] border border-[#eedbe6] text-xs text-[#141219] font-medium focus:outline-none focus:border-[#D30915] cursor-pointer"
          >
            <option value="all">All Approval States</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending Application</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* 3. Representatives Desktop Table (Hidden < 768px) */}
      <div className="hidden md:block bg-white rounded-2xl sm:rounded-3xl border border-[#eedbe6] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#141219] min-w-[860px]">
            <thead className="bg-[#fdf9fb] border-b border-[#eedbe6] text-[11px] font-extrabold uppercase text-[#716d77] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Representative</th>
                <th className="py-3.5 px-3">Sponsor Info</th>
                <th className="py-3.5 px-3">Rank & Team</th>
                <th className="py-3.5 px-3">Monthly Qualification ($125)</th>
                <th className="py-3.5 px-3">Membership Plan</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {filteredReps.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#716d77]">
                    <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="font-bold text-sm text-[#141219] m-0">No representatives found</p>
                    <p className="text-xs m-0">Try adjusting your search query or status filter.</p>
                  </td>
                </tr>
              ) : (
                filteredReps.map((rep) => (
                  <tr key={rep.id} className="hover:bg-[#fffbfd] transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          onClick={() => triggerUploadForRep(rep)}
                          className="relative group shrink-0 cursor-pointer"
                          title="Click to upload representative photo"
                        >
                          <RepAvatar name={rep.name} avatar={rep.avatar} size="w-10 h-10" />
                          <div className="absolute inset-0 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity shadow-xs">
                            <Camera className="w-4 h-4" />
                          </div>
                          {isUploadingAvatar && uploadTargetRep?.id === rep.id && (
                            <div className="absolute inset-0 bg-black/70 text-white rounded-full flex items-center justify-center">
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-[#141219] truncate">{rep.name}</div>
                          <div className="text-[11px] text-[#D30915] font-bold">@{rep.repUsername}</div>
                          <div className="text-[10px] text-[#8a858f]">{rep.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="text-xs font-bold text-[#141219]">{rep.sponsorName}</div>
                      <div className="text-[11px] text-[#716d77]">@{rep.sponsorUsername}</div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-bold text-xs text-[#54217f]">{rep.currentRank}</div>
                      <div className="text-[11px] text-[#716d77]">{rep.teamSize} Direct Downlines</div>
                    </td>

                    <td className="py-3 px-3">
                      {(() => {
                        const q = qualificationService.getCachedQualification(rep.repUsername);
                        return (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                  q.isQualified
                                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                                }`}
                              >
                                {q.isQualified ? '✓ Qualified' : 'Not Qualified'}
                              </span>
                            </div>
                            <div className="text-[11px] font-bold text-[#141219]">
                              Retail: ${q.qualifyingRetailSales.toFixed(2)} / ${q.qualificationThreshold.toFixed(2)}
                            </div>
                            <div className="text-[9px] text-[#716d77]">
                              Personal: ${q.personalPurchasesExcluded.toFixed(2)} (20% off) • $20 fees: $0 comm
                            </div>
                            <div className="text-[9px] text-[#716d77]">
                              Month: {q.calendarMonth} • {q.isQualified ? 'Downlines Active' : 'Downlines Ineligible'}
                            </div>
                          </div>
                        );
                      })()}
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-bold text-xs text-[#141219] truncate max-w-[170px]">
                        {rep.membershipPlan}
                      </div>
                      <div className="text-[10px] text-emerald-600 font-bold capitalize">
                        Status: {rep.membershipStatus}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="space-y-1">
                        <div>{getStatusBadge(rep.status)}</div>
                        {rep.approvalStatus === 'pending' && (
                          <span className="block text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            Pending Approval
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => triggerUploadForRep(rep)}
                          className="p-1.5 rounded-lg bg-gray-50 hover:bg-[#fff1f2] text-[#55505a] hover:text-[#D30915] transition-colors cursor-pointer"
                          title="Upload Representative Photo"
                        >
                          <Camera className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedRep(rep)}
                          className="p-1.5 rounded-lg bg-gray-50 hover:bg-[#fff1f2] text-[#55505a] hover:text-[#D30915] transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {rep.approvalStatus === 'pending' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenConfirm(rep.id, 'approve', rep.repUsername)}
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                              title="Approve"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenConfirm(rep.id, 'reject', rep.repUsername)}
                              className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                              title="Reject"
                            >
                              Reject
                            </button>
                          </>
                        ) : rep.status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => handleOpenConfirm(rep.id, 'suspend', rep.repUsername)}
                            className="px-2 py-1 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-700 text-[11px] font-bold transition-all cursor-pointer"
                            title="Suspend"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenConfirm(rep.id, 'activate', rep.repUsername)}
                            className="px-2 py-1 rounded-lg border border-emerald-200 hover:bg-emerald-50 text-emerald-700 text-[11px] font-bold transition-all cursor-pointer"
                            title="Set Active"
                          >
                            Activate
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenConfirm(rep.id, 'delete', rep.repUsername)}
                          className="p-1.5 rounded-lg bg-gray-50 hover:bg-rose-50 text-[#8a858f] hover:text-rose-600 transition-colors cursor-pointer"
                          title="Delete Representative"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Mobile Responsive Cards View (Shown < 768px) */}
      <div className="md:hidden space-y-3">
        {filteredReps.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#eedbe6] p-8 text-center text-[#716d77]">
            <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="font-bold text-sm text-[#141219] m-0">No representatives found</p>
            <p className="text-xs m-0">Try changing your search terms.</p>
          </div>
        ) : (
          filteredReps.map((rep) => (
            <div
              key={rep.id}
              className="bg-white rounded-2xl border border-[#eedbe6] p-4 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div
                    onClick={() => triggerUploadForRep(rep)}
                    className="relative group shrink-0 cursor-pointer"
                    title="Click to upload representative photo"
                  >
                    <RepAvatar name={rep.name} avatar={rep.avatar} size="w-11 h-11" />
                    <div className="absolute inset-0 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity shadow-xs">
                      <Camera className="w-4 h-4" />
                    </div>
                    {isUploadingAvatar && uploadTargetRep?.id === rep.id && (
                      <div className="absolute inset-0 bg-black/70 text-white rounded-full flex items-center justify-center">
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-[#141219] m-0">{rep.name}</h4>
                    <span className="text-xs font-bold text-[#D30915]">@{rep.repUsername}</span>
                    <div className="text-[11px] text-[#716d77]">{rep.email}</div>
                  </div>
                </div>
                <div>{getStatusBadge(rep.status)}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-[#fdf8fa] rounded-xl p-2.5 text-xs">
                <div>
                  <span className="text-[10px] text-[#716d77] block font-medium">Sponsor:</span>
                  <span className="font-bold text-[#141219]">{rep.sponsorName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#716d77] block font-medium">Rank & Team:</span>
                  <span className="font-bold text-[#54217f]">{rep.currentRank} ({rep.teamSize})</span>
                </div>
                <div className="col-span-2 pt-1 border-t border-gray-100">
                  <span className="text-[10px] text-[#716d77] block font-medium">Membership:</span>
                  <span className="font-bold text-[#141219]">{rep.membershipPlan}</span>
                </div>
              </div>

              {/* Mobile Actions */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => triggerUploadForRep(rep)}
                  className="p-2 rounded-xl border border-[#eedbe6] bg-white hover:bg-[#fff1f2] text-[#55505a] hover:text-[#D30915] text-xs font-bold flex items-center justify-center cursor-pointer transition-colors"
                  title="Upload / Change Photo"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedRep(rep)}
                  className="flex-1 py-2 px-3 rounded-xl border border-[#eedbe6] bg-white text-xs font-bold text-[#141219] flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-[#D30915]" />
                  <span>Profile</span>
                </button>

                {rep.approvalStatus === 'pending' ? (
                  <button
                    type="button"
                    onClick={() => handleOpenConfirm(rep.id, 'approve', rep.repUsername)}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>
                ) : rep.status === 'active' ? (
                  <button
                    type="button"
                    onClick={() => handleOpenConfirm(rep.id, 'suspend', rep.repUsername)}
                    className="py-2 px-3 rounded-xl border border-rose-200 text-rose-700 bg-rose-50 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Suspend</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenConfirm(rep.id, 'activate', rep.repUsername)}
                    className="py-2 px-3 rounded-xl border border-emerald-200 text-emerald-700 bg-emerald-50 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Activate</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleOpenConfirm(rep.id, 'delete', rep.repUsername)}
                  className="p-2 rounded-xl border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 text-xs font-bold flex items-center justify-center cursor-pointer transition-colors"
                  title="Delete Representative"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 5. Representative Details Modal / Drawer */}
      {selectedRep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#eedbe6] max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#D30915]" />
                <h3 className="font-black text-base text-[#141219] hero-title-font m-0">
                  Representative Dossier
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRep(null)}
                className="p-1 rounded-lg hover:bg-gray-100 text-[#716d77] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Header */}
            <div className="flex items-center gap-4 bg-[#fdf9fb] p-4 rounded-2xl border border-[#f3e3ee]">
              <div className="relative group shrink-0">
                <RepAvatar
                  name={selectedRep.name}
                  avatar={selectedRep.avatar}
                  size="w-20 h-20"
                  rounded="rounded-2xl"
                />
                <button
                  type="button"
                  disabled={isUploadingAvatar}
                  onClick={() => triggerUploadForRep({ id: selectedRep.id, name: selectedRep.name })}
                  className="absolute inset-0 bg-black/60 text-white rounded-2xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity cursor-pointer text-[10px] font-bold"
                  title="Upload / Change Photo"
                >
                  <Camera className="w-5 h-5 mb-0.5" />
                  <span>Change</span>
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h4 className="font-black text-lg text-[#141219] m-0 truncate">{selectedRep.name}</h4>
                  <button
                    type="button"
                    disabled={isUploadingAvatar}
                    onClick={() => triggerUploadForRep({ id: selectedRep.id, name: selectedRep.name })}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border border-[#eedbe6] hover:border-[#D30915] text-[#D30915] text-xs font-bold transition-all shadow-2xs hover:bg-[#fff5f6] cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploadingAvatar ? 'Uploading...' : 'Upload Photo'}</span>
                  </button>
                </div>
                <div className="text-xs font-bold text-[#D30915]">@{selectedRep.repUsername}</div>
                <div className="mt-1 flex items-center gap-2">
                  {getStatusBadge(selectedRep.status)}
                  <span className="text-[10px] font-bold text-[#54217f] bg-purple-50 px-2 py-0.5 rounded-full">
                    {selectedRep.currentRank}
                  </span>
                </div>
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-gray-50 p-3 rounded-xl space-y-0.5">
                <span className="text-[10px] text-[#716d77] font-medium block">Personal Sales (Month):</span>
                <span className="font-black text-[#141219] text-base">
                  ${selectedRep.personalSalesMonth.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl space-y-0.5">
                <span className="text-[10px] text-[#716d77] font-medium block">Team Volume (Month):</span>
                <span className="font-black text-[#54217f] text-base">
                  ${selectedRep.teamSalesMonth.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl space-y-0.5">
                <span className="text-[10px] text-[#716d77] font-medium block">Lifetime Sales:</span>
                <span className="font-black text-[#141219] text-base">
                  ${selectedRep.lifetimeSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl space-y-0.5">
                <span className="text-[10px] text-[#716d77] font-medium block">Total Commissions Earned:</span>
                <span className="font-black text-emerald-600 text-base">
                  ${selectedRep.totalCommissionsEarned.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Downline & Sponsor Details */}
            <div className="bg-[#fff9fb] p-3.5 rounded-xl border border-[#f2dfec] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#716d77]">Direct Enroller / Sponsor:</span>
                <span className="font-bold text-[#141219]">{selectedRep.sponsorName} (@{selectedRep.sponsorUsername})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#716d77]">Registered Email:</span>
                <span className="font-bold text-[#141219]">{selectedRep.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#716d77]">Mobile Phone:</span>
                <span className="font-bold text-[#141219]">{selectedRep.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#716d77]">Membership Plan:</span>
                <span className="font-bold text-[#D30915]">{selectedRep.membershipPlan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#716d77]">Enrolled Date:</span>
                <span className="font-bold text-[#141219]">{selectedRep.joinDate}</span>
              </div>
            </div>

            {/* Referral Link & Customer Attribution Card */}
            {(() => {
              const referralLink = typeof window !== 'undefined'
                ? `${window.location.origin}/?rep=${selectedRep.repUsername}`
                : `https://ilovesurprises.com/?rep=${selectedRep.repUsername}`;
              const attributions = attributionService.getStoredAttributions();
              const attributedCustomers = Object.values(attributions).filter(
                (a) => a.repUsername.toLowerCase() === selectedRep.repUsername.toLowerCase()
              );

              return (
                <div className="bg-[#fff9fb] p-3.5 rounded-xl border border-[#f2dfec] space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-black uppercase tracking-wider text-[10px] text-[#716d77]">
                      Affiliate Referral Link &amp; Attribution
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      {attributedCustomers.length} Lifetime Customer{attributedCustomers.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={referralLink}
                      className="flex-1 h-8 px-2.5 rounded-lg bg-white border border-[#eedbe6] text-[11px] font-mono text-[#D30915] select-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(referralLink);
                        onShowToast(`Referral link for @${selectedRep.repUsername} copied!`, {
                          title: 'Link Copied',
                          type: 'success',
                        });
                      }}
                      className="h-8 px-2.5 rounded-lg bg-[#faf7f9] border border-[#eedbe6] hover:bg-[#fff0f3] text-xs font-bold text-[#141219] flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#D30915]" />
                      <span>Copy</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Monthly Qualification Details Card */}
            {(() => {
              const q = qualificationService.getCachedQualification(selectedRep.repUsername);
              return (
                <div className="bg-[#faf6f9] p-3.5 rounded-xl border border-[#eedbe6] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-black uppercase tracking-wider text-[10px] text-[#716d77]">
                      Monthly Qualification (Team Overrides)
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        q.isQualified
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}
                    >
                      {q.isQualified ? '✓ Qualified' : 'Not Qualified'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#716d77]">Calendar Month:</span>
                    <span className="font-bold text-[#141219]">{q.calendarMonth}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#716d77]">Qualifying Retail Sales:</span>
                    <span className={`font-black ${q.isQualified ? 'text-emerald-700' : 'text-[#D30915]'}`}>
                      ${q.qualifyingRetailSales.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#716d77]">Rep Personal Purchases:</span>
                    <span className="font-bold text-[#55505a]">
                      ${q.personalPurchasesExcluded.toFixed(2)} (20% Rep discount, excluded)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#716d77]">$20 Rep Signup / Monthly Fee:</span>
                    <span className="font-bold text-[#55505a]">
                      $0 Commission / Excluded from volume
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#716d77]">Policy Threshold:</span>
                    <span className="font-bold text-[#141219]">${q.qualificationThreshold.toFixed(2)} (Fixed Policy)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#716d77]">Downline Commissions:</span>
                    <span className={`font-bold ${q.isQualified ? 'text-emerald-700' : 'text-amber-800'}`}>
                      {q.isQualified ? 'Eligible for Level 1–5 Overrides' : 'Ineligible (<$125 retail sales)'}
                    </span>
                  </div>
                  <div className="pt-1 text-[10px] text-[#8a858f] italic border-t border-[#eedbe6]/60 space-y-0.5">
                    <div>* Personal purchases receive 20% Rep discount but do not count toward $125 qualification.</div>
                    <div>* Rep signup/monthly fees do not generate commission income.</div>
                  </div>
                </div>
              );
            })()}

            {selectedRep.approvalStatus === 'pending' ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const repToApprove = selectedRep;
                    setSelectedRep(null);
                    handleOpenConfirm(repToApprove.id, 'approve', repToApprove.repUsername);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Approve & Activate Storefront URL</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const repToReject = selectedRep;
                    setSelectedRep(null);
                    handleOpenConfirm(repToReject.id, 'reject', repToReject.repUsername);
                  }}
                  className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white transition-all cursor-pointer shadow-xs"
                >
                  Reject
                </button>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => {
                const repToDelete = selectedRep;
                setSelectedRep(null);
                handleOpenConfirm(repToDelete.id, 'delete', repToDelete.repUsername);
              }}
              className="w-full py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Representative</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedRep(null)}
              className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-[#141219] transition-all cursor-pointer"
            >
              Close Dossier
            </button>
          </div>
        </div>
      )}

      {/* 6. Approval / Suspension / Deletion Confirmation Modal */}
      {isConfirmModalOpen && confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#eedbe6] max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center ${
              confirmAction.action === 'approve' || confirmAction.action === 'activate'
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-rose-50 text-rose-600'
            }`}>
              {confirmAction.action === 'approve' || confirmAction.action === 'activate' ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : confirmAction.action === 'delete' ? (
                <Trash2 className="w-6 h-6" />
              ) : (
                <AlertTriangle className="w-6 h-6" />
              )}
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-[#141219] hero-title-font m-0 capitalize">
                {confirmAction.action === 'approve'
                  ? 'Confirm Approval'
                  : confirmAction.action === 'delete'
                  ? 'Delete Representative'
                  : `Confirm ${confirmAction.action}`}
              </h3>
              <p className="text-xs text-[#716d77] m-0">
                {confirmAction.action === 'approve'
                  ? `Approve @${confirmAction.repName}? This will activate their replicated storefront URL and enable their representative login credentials.`
                  : confirmAction.action === 'delete'
                  ? `Are you sure you want to permanently delete representative @${confirmAction.repName}? Their replicated website will be deactivated, downlines reassigned to corporate, and their role reset.`
                  : `Are you sure you want to ${confirmAction.action} representative @${confirmAction.repName}?`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="py-2.5 px-4 rounded-xl border border-[#eedbe6] text-xs font-bold text-[#716d77] hover:bg-gray-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteConfirm}
                className={`py-2.5 px-4 rounded-xl text-white text-xs font-bold transition-all shadow-xs cursor-pointer ${
                  confirmAction.action === 'approve' || confirmAction.action === 'activate'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {confirmAction.action === 'delete' ? 'Delete' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
