import React, { useState } from 'react';
import {
  User,
  Mail,
  Phone,
  Shield,
  Edit2,
  Check,
  Star,
  Lock,
  Camera,
  RefreshCw,
  KeyRound,
  X,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { UserProfile } from '../../types';
import { isRepresentativeUser } from '../../utils/roleUtils';
import { accountService } from '../../services/accountService';
import { customerAuthService } from '../../services/customerAuthService';
import { isValidEmail, isValidMobile } from '../../services/auth';

interface ProfileSectionProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
  onShowToast: (message: string, options?: { title?: string; type?: 'success' | 'info' }) => void;
}

const DEFAULT_PROFILE_AVATAR = '/assets/ilovesurprises/Profile/profile%20image.webp';
const AVATAR_PRESETS = [
  DEFAULT_PROFILE_AVATAR,
];

export const ProfileSection: React.FC<ProfileSectionProps> = ({
  user,
  onUpdateUser,
  onShowToast,
}) => {
  const getCleanAvatar = (avatarUrl?: string) => {
    const isGoogleOrRemote =
      avatarUrl &&
      (avatarUrl.includes('googleusercontent.com') ||
        (avatarUrl.startsWith('https://') && !avatarUrl.includes('unsplash.com')));
    if (!avatarUrl || avatarUrl.includes('unsplash.com') || (!isGoogleOrRemote && avatarUrl.startsWith('http'))) {
      return DEFAULT_PROFILE_AVATAR;
    }
    return avatarUrl;
  };

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [mobile, setMobile] = useState(user.mobile || '');
  const [selectedAvatar, setSelectedAvatar] = useState(getCleanAvatar(user.avatar));
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Password Change & Reset States
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [isResetSent, setIsResetSent] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!name.trim() || name.trim().length < 2) {
      newErrors.name = 'Full name must be at least 2 characters';
    }
    if (!email.trim() || !isValidEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (mobile.trim() && !isValidMobile(mobile)) {
      newErrors.mobile = 'Please enter a valid 10-digit mobile number';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    try {
      const updatedUser = await accountService.updateProfile({
        name: name.trim(),
        avatar: selectedAvatar,
        mobile: mobile.trim() || undefined,
      });

      if (updatedUser) {
        onUpdateUser(updatedUser);
      } else {
        const fallback: UserProfile = {
          ...user,
          name: name.trim(),
          mobile: mobile.trim() || undefined,
          avatar: selectedAvatar,
        };
        accountService.updateStoredUser(fallback);
        onUpdateUser(fallback);
      }

      setIsEditing(false);
      setShowAvatarPicker(false);
      setErrors({});
      onShowToast('Profile information successfully saved to your account!', {
        title: 'Profile Updated',
        type: 'success',
      });
    } catch (err: any) {
      console.warn('Profile backend update error, fallback to local storage:', err);
      const fallback: UserProfile = {
        ...user,
        name: name.trim(),
        mobile: mobile.trim() || undefined,
        avatar: selectedAvatar,
      };
      accountService.updateStoredUser(fallback);
      onUpdateUser(fallback);
      setIsEditing(false);
      setShowAvatarPicker(false);
      onShowToast(err?.message || 'Profile saved successfully!', {
        title: 'Profile Updated',
        type: 'success',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (!currentPassword) {
      setPasswordError('Please enter your current password');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    try {
      await accountService.changePassword(currentPassword, newPassword);
      setIsPasswordModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onShowToast('Your password has been changed successfully.', {
        title: 'Password Updated',
        type: 'success',
      });
    } catch (err: any) {
      setPasswordError(err?.displayMessage || err?.message || 'Incorrect current password or failed to change password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (isSendingReset || isResetSent) return;
    setIsSendingReset(true);
    setPasswordError('');
    try {
      const res = await customerAuthService.forgotPassword(user.email);
      if (res.success) {
        setIsResetSent(true);
        onShowToast(`Password reset link sent to ${user.email}`, {
          title: 'Security Link Sent',
          type: 'info',
        });
        setTimeout(() => setIsResetSent(false), 8000);
      } else {
        setPasswordError(res.error || 'Failed to send reset email. Please try again.');
      }
    } catch (err: any) {
      setPasswordError(err?.message || 'Unable to send password reset email.');
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Main Profile Information Card */}
      <div className="bg-white rounded-[24px] p-6 sm:p-8 border border-[#eedbe6] shadow-[0_8px_24px_rgba(50,31,63,0.04)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#f5eaf1] mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-[#141219] m-0 font-display">
                Personal Profile & Account
              </h2>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#D30915] bg-[#fff1f2] px-2.5 py-0.5 rounded-full border border-[#fecdd3]">
                {isRepresentativeUser(user) ? '★ 20% Rep' : '💎 VIP Member'}
              </span>
            </div>
            <p className="text-xs text-[#716d77] m-0 mt-0.5">
              Manage your personal credentials, contact info, and security preferences
            </p>
          </div>

          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="h-[38px] px-4 rounded-[12px] bg-[#fff1f2] hover:bg-[#D30915] text-[#D30915] hover:text-white border border-[#fecdd3] text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs self-start sm:self-auto"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-5">
            {/* Avatar Selection */}
            <div>
              <label className="block text-xs font-bold text-[#141219] mb-2">
                Profile Avatar
              </label>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="relative">
                  <img
                    src={selectedAvatar}
                    alt={name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-[#D30915] shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#D30915] text-white flex items-center justify-center text-xs shadow-xs hover:scale-110 transition-transform cursor-pointer border border-white"
                    title="Change Avatar"
                  >
                    <Camera className="w-3 h-3" />
                  </button>
                </div>

                {showAvatarPicker && (
                  <div className="flex items-center gap-2 p-2 rounded-[14px] bg-[#fff8fb] border border-[#fecdd3]">
                    {AVATAR_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedAvatar(preset)}
                        className={`w-10 h-10 rounded-full overflow-hidden border-2 transition-transform hover:scale-105 cursor-pointer ${
                          selectedAvatar === preset ? 'border-[#D30915] ring-2 ring-[#D30915]/20' : 'border-white opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={preset} alt="Preset" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Name Input */}
            <div>
              <label className="block text-xs font-bold text-[#141219] mb-1">
                Full Name <span className="text-[#D30915]">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#8a858f] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                  }}
                  placeholder="Your name"
                  className="w-full h-[44px] pl-10 pr-3.5 rounded-[13px] bg-[#fffafb] border border-[#e8dfe5] focus:border-[#D30915] text-xs sm:text-sm text-[#141219] outline-none font-medium"
                />
              </div>
              {errors.name && <p className="text-[11px] text-red-600 mt-1">{errors.name}</p>}
            </div>

            {/* Email & Mobile Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#141219] mb-1">
                  Email Address <span className="text-[#D30915]">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#8a858f] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    disabled
                    title="Email cannot be changed directly for security reasons"
                    className="w-full h-[44px] pl-10 pr-3.5 rounded-[13px] bg-[#f7f5f6] border border-[#e8dfe5] text-xs sm:text-sm text-[#716d77] cursor-not-allowed outline-none font-medium"
                  />
                </div>
                <span className="text-[10px] text-[#8a858f] mt-1 block">Registered primary account email</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#141219] mb-1">
                  Mobile Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#8a858f] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => {
                      setMobile(e.target.value);
                      if (errors.mobile) setErrors((prev) => ({ ...prev, mobile: '' }));
                    }}
                    placeholder="(555) 000-0000"
                    className="w-full h-[44px] pl-10 pr-3.5 rounded-[13px] bg-[#fffafb] border border-[#e8dfe5] focus:border-[#D30915] text-xs sm:text-sm text-[#141219] outline-none font-medium"
                  />
                </div>
                {errors.mobile && <p className="text-[11px] text-red-600 mt-1">{errors.mobile}</p>}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#f5eaf1]">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setIsEditing(false);
                  setName(user.name);
                  setEmail(user.email);
                  setMobile(user.mobile || '');
                  setSelectedAvatar(getCleanAvatar(user.avatar));
                  setErrors({});
                }}
                className="h-[40px] px-5 rounded-[12px] border border-[#e8dfe5] text-xs font-bold text-[#716d77] hover:text-[#141219] cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="h-[40px] px-6 rounded-[12px] bg-[#D30915] hover:bg-[#B60711] text-white font-black text-xs uppercase tracking-wider shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-[18px] bg-[#fffafc] border border-[#eedbe6] flex items-center gap-3">
                <div className="w-10 h-10 rounded-[12px] bg-[#fff1f2] text-[#D30915] flex items-center justify-center shrink-0 border border-[#fecdd3]">
                  <User className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-black uppercase text-[#716d77] block">
                    Full Legal Name
                  </span>
                  <strong className="text-sm font-black text-[#141219] truncate block">
                    {user.name}
                  </strong>
                </div>
              </div>

              <div className="p-4 rounded-[18px] bg-[#fffafc] border border-[#eedbe6] flex items-center gap-3">
                <div className="w-10 h-10 rounded-[12px] bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                  <Shield className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-black uppercase text-[#716d77] block">
                    Account Status & Role
                  </span>
                  <strong className="text-sm font-black text-[#D30915] capitalize">
                    {isRepresentativeUser(user) ? 'Official 20% Rep Partner' : 'VIP Loyalty Member'}
                  </strong>
                </div>
              </div>

              <div className="p-4 rounded-[18px] bg-[#fffafc] border border-[#eedbe6] flex items-center gap-3">
                <div className="w-10 h-10 rounded-[12px] bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-black uppercase text-[#716d77] block">
                    Registered Email
                  </span>
                  <strong className="text-sm font-black text-[#141219] truncate block">
                    {user.email}
                  </strong>
                </div>
              </div>

              <div className="p-4 rounded-[18px] bg-[#fffafc] border border-[#eedbe6] flex items-center gap-3">
                <div className="w-10 h-10 rounded-[12px] bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-200">
                  <Phone className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-black uppercase text-[#716d77] block">
                    Mobile Phone
                  </span>
                  <strong className="text-sm font-black text-[#141219]">
                    {user.mobile || 'Not provided'}
                  </strong>
                </div>
              </div>
            </div>

            {/* VIP Member Perks Ribbon */}
            <div className="p-4 rounded-[18px] bg-gradient-to-r from-[#fff1f2] via-[#fff8fb] to-[#fbf5ff] border border-[#fecdd3] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#D30915] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Star className="w-5 h-5 fill-white" />
                </div>
                <div>
                  <strong className="text-xs font-black text-[#141219] block">
                    100% Win Guarantee Verified Member
                  </strong>
                  <span className="text-[11px] text-[#716d77]">
                    Earn 5% cashback on all surprise unboxings & free shipping on $50+
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-black text-emerald-700 bg-white px-3 py-1 rounded-full border border-[#fecdd3]">
                  Level 1 VIP
                </span>
              </div>
            </div>

            {/* Password & Security Card */}
            <div className="p-4 rounded-[18px] bg-white border border-[#eedbe6] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-xs font-black text-[#141219] block">
                    Password & Security
                  </strong>
                  <span className="text-[11px] text-[#716d77]">
                    Encrypted with bank-grade 256-bit security
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setIsPasswordModalOpen(true);
                    setPasswordError('');
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="h-[34px] px-4 rounded-[10px] bg-[#fff1f2] hover:bg-[#D30915] text-[#D30915] hover:text-white border border-[#fecdd3] text-xs font-black transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Change Password</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendResetEmail}
                  disabled={isSendingReset || isResetSent}
                  className="h-[34px] px-3.5 rounded-[10px] bg-white hover:bg-stone-50 text-[#716d77] hover:text-[#141219] border border-[#e8dfe5] text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  title="Send password reset link to your email"
                >
                  {isResetSent ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                      <span className="text-emerald-700">Link Sent!</span>
                    </>
                  ) : isSendingReset ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reset via Email</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-[24px] p-6 border border-[#eedbe6] shadow-2xl relative animate-modal-pop">
            <button
              type="button"
              onClick={() => setIsPasswordModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-stone-100 text-[#716d77] hover:text-[#141219] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-[12px] bg-[#fff1f2] text-[#D30915] flex items-center justify-center border border-[#fecdd3]">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#141219] m-0 font-display">
                  Change Password
                </h3>
                <p className="text-xs text-[#716d77] m-0">
                  Update your account credentials securely
                </p>
              </div>
            </div>

            {passwordError && (
              <div className="p-3 mb-4 rounded-[12px] bg-red-50 border border-red-200 text-xs font-bold text-red-700">
                {passwordError}
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#141219] mb-1">
                  Current Password <span className="text-[#D30915]">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full h-[42px] px-3.5 pr-10 rounded-[12px] bg-[#fffafb] border border-[#e8dfe5] focus:border-[#D30915] text-xs font-medium text-[#141219] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a858f] hover:text-[#141219]"
                  >
                    {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#141219] mb-1">
                  New Password <span className="text-[#D30915]">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full h-[42px] px-3.5 pr-10 rounded-[12px] bg-[#fffafb] border border-[#e8dfe5] focus:border-[#D30915] text-xs font-medium text-[#141219] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a858f] hover:text-[#141219]"
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#141219] mb-1">
                  Confirm New Password <span className="text-[#D30915]">*</span>
                </label>
                <input
                  type={showNewPw ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full h-[42px] px-3.5 rounded-[12px] bg-[#fffafb] border border-[#e8dfe5] focus:border-[#D30915] text-xs font-medium text-[#141219] outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#f5eaf1]">
                <button
                  type="button"
                  onClick={handleSendResetEmail}
                  disabled={isSendingReset}
                  className="text-[11px] font-bold text-[#D30915] hover:underline cursor-pointer"
                >
                  Forgot Current Password?
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="h-[38px] px-4 rounded-[11px] border border-[#e8dfe5] text-xs font-bold text-[#716d77] hover:text-[#141219] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="h-[38px] px-5 rounded-[11px] bg-[#D30915] hover:bg-[#B60711] text-white font-black text-xs uppercase tracking-wider cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isChangingPassword ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <span>Update Password</span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
