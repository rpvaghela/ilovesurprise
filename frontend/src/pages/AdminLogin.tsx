import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  ArrowLeft,
  KeyRound,
  X,
  TrendingUp,
  Gem,
  Users,
  Shield,
  Zap,
  Check,
  Award,
} from 'lucide-react';
import { authService } from '../services/auth';
import type { UserProfile } from '../types';

interface AdminLoginProps {
  onSuccess: (adminUser: UserProfile) => void;
  onNavigateToHome: () => void;
  onShowToast?: (message: string, options?: { title?: string; type?: 'success' | 'info' }) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({
  onSuccess,
  onNavigateToHome,
  onShowToast,
}) => {
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Status & Feedback
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forgot Password Modal State
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [forgotFeedback, setForgotFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Please enter your administrator email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your administrator password.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authService.adminLogin({
        identifier: cleanEmail,
        password,
        rememberMe,
      });

      if (!response.success || !response.user) {
        setErrorMessage(
          response.error || 'Authentication failed. Please verify your credentials and try again.'
        );
        setIsLoading(false);
        return;
      }

      if (!response.isAdmin) {
        setErrorMessage('Access denied. This account does not possess administrator privileges.');
        setIsLoading(false);
        return;
      }

      // Complete sign-in immediately
      if (onShowToast) {
        onShowToast(`Welcome back, ${response.user.name || 'Administrator'}!`, {
          title: 'Admin Console Authorized',
          type: 'success',
        });
      }

      onSuccess(response.user);
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'An unexpected connection error occurred. Please try again.'
      );
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotFeedback(null);

    const clean = forgotEmail.trim();
    if (!clean) {
      setForgotFeedback({
        type: 'error',
        message: 'Please provide your registered administrator email.',
      });
      return;
    }

    setIsForgotLoading(true);

    try {
      const res = await authService.adminForgotPassword(clean);
      if (res.success) {
        setForgotFeedback({
          type: 'success',
          message: res.message || 'Recovery instructions have been transmitted to your email.',
        });
      } else {
        setForgotFeedback({
          type: 'error',
          message: res.error || 'Unable to dispatch recovery link at this time.',
        });
      }
    } catch (err: any) {
      setForgotFeedback({
        type: 'error',
        message: err?.message || 'Failed to dispatch recovery link.',
      });
    } finally {
      setIsForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen lg:h-screen w-full bg-[#faf7f9] text-[#141219] flex flex-col lg:grid lg:grid-cols-12 selection:bg-[#D30915] selection:text-white lg:overflow-hidden">
      {/* ── LEFT SHOWCASE PANEL: Project Light Theme Brand Showcase (Visible on lg+) ── */}
      <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 relative flex-col justify-between p-6 xl:p-8 2xl:p-10 bg-gradient-to-br from-[#fff3f5] via-[#faf4f8] to-[#f7edf5] border-r border-[#eedbe6] h-full overflow-hidden">
        {/* Soft atmospheric brand glows (warm rose & royal plum tints, entirely light) */}
        <div className="absolute top-0 left-0 w-full h-80 bg-[radial-gradient(ellipse_70%_70%_at_20%_-10%,rgba(211,9,21,0.10),transparent_70%)] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-full h-80 bg-[radial-gradient(ellipse_60%_60%_at_80%_90%,rgba(84,33,127,0.07),transparent_70%)] pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(#54217f 1px, transparent 1px), linear-gradient(90deg, #54217f 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}
        />

        {/* Top Branding Section */}
        <div className="relative z-10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <img
              src="/assets/ilovesurprises/logo/logo-16k.png"
              alt="ILoveSurprises"
              width={8192}
              height={2048}
              className="h-8 xl:h-9 w-auto object-contain drop-shadow-xs"
            />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/90 border border-[#eedbe6] shadow-xs text-xs font-bold text-[#55505a] backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Commerce Cloud Node v2.6</span>
          </div>
        </div>

        {/* Center Hero & Value Proposition */}
        <div className="relative z-10 my-auto py-2 xl:py-4 max-w-xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#fff0f3] border border-[#fecdd3] text-[#D30915] text-[10px] font-black uppercase tracking-wider mb-2.5 shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-[#D30915]" />
            <span>Enterprise Control Center</span>
          </div>

          <h1 className="text-xl xl:text-2xl 2xl:text-3xl font-black text-[#141219] hero-title-font tracking-tight leading-snug mb-2">
            Command Your Surprise Commerce Empire With{' '}
            <span className="bg-gradient-to-r from-[#D30915] via-[#b90813] to-[#54217f] bg-clip-text text-transparent">
              Precision & Speed.
            </span>
          </h1>

          <p className="text-xs xl:text-sm text-[#716d77] font-medium leading-relaxed mb-4">
            Integrated operations terminal governing authentic cash and fine jewelry reveal products, automated 5-level MLM commission payouts, real-time appraisals, and nationwide fulfillment.
          </p>

          {/* Telemetry Metric Cards in Project Color Theme */}
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <div className="p-3 rounded-xl bg-white/95 border border-[#eedbe6] shadow-[0_4px_16px_rgba(84,33,127,0.04)] hover:border-[#D30915]/50 transition-all">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black text-[#716d77] uppercase tracking-wider">Gross Controlled</span>
                <div className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="w-3 h-3" />
                </div>
              </div>
              <div className="text-lg xl:text-xl font-black text-[#141219] tracking-tight">$1,248,500+</div>
              <span className="text-[10px] font-bold text-emerald-600 mt-0.5 block">+18.4% MoM Velocity</span>
            </div>

            <div className="p-3 rounded-xl bg-white/95 border border-[#eedbe6] shadow-[0_4px_16px_rgba(84,33,127,0.04)] hover:border-[#D30915]/50 transition-all">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black text-[#716d77] uppercase tracking-wider">Max Reveal Value</span>
                <div className="w-5 h-5 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Gem className="w-3 h-3" />
                </div>
              </div>
              <div className="text-lg xl:text-xl font-black text-[#141219] tracking-tight">$7,500.00</div>
              <span className="text-[10px] font-bold text-amber-700 mt-0.5 block">Solid Gold & Diamond Tier</span>
            </div>

            <div className="p-3 rounded-xl bg-white/95 border border-[#eedbe6] shadow-[0_4px_16px_rgba(84,33,127,0.04)] hover:border-[#D30915]/50 transition-all">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black text-[#716d77] uppercase tracking-wider">Network Reps</span>
                <div className="w-5 h-5 rounded-md bg-purple-50 text-[#54217f] flex items-center justify-center">
                  <Users className="w-3 h-3" />
                </div>
              </div>
              <div className="text-lg xl:text-xl font-black text-[#141219] tracking-tight">3,420+ Reps</div>
              <span className="text-[10px] font-bold text-[#54217f] mt-0.5 block">5-Level Downline Active</span>
            </div>

            <div className="p-3 rounded-xl bg-white/95 border border-[#eedbe6] shadow-[0_4px_16px_rgba(84,33,127,0.04)] hover:border-[#D30915]/50 transition-all">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black text-[#716d77] uppercase tracking-wider">Security Shield</span>
                <div className="w-5 h-5 rounded-md bg-red-50 text-[#D30915] flex items-center justify-center">
                  <Zap className="w-3 h-3" />
                </div>
              </div>
              <div className="text-lg xl:text-xl font-black text-[#141219] tracking-tight">Active & Protected</div>
              <span className="text-[10px] font-bold text-[#D30915] mt-0.5 block">Rate Limiting Enforced</span>
            </div>
          </div>

          {/* Security & Architecture Pills */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-bold text-[#55505a] pt-2.5 border-t border-[#eedbe6]">
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" /> Bank-Grade 256-Bit TLS
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" /> Granular RBAC Permissions
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" /> Multi-Tier Rate Limiting Shield
            </span>
          </div>
        </div>

        {/* Left Footer */}
        <div className="relative z-10 text-[11px] font-semibold text-[#716d77] flex items-center justify-between pt-3 border-t border-[#eedbe6] shrink-0">
          <span>© 2026 ILoveSurprises.com Inc. All rights reserved.</span>
          <span className="inline-flex items-center gap-1 text-[#54217f] font-bold">
            <Award className="w-3.5 h-3.5" /> Handcrafted in the USA
          </span>
        </div>
      </div>

      {/* ── RIGHT AUTHENTICATION PANEL: Clean Light Theme Form ── */}
      <div className="w-full lg:col-span-6 xl:col-span-5 bg-[#ffffff] flex flex-col justify-between p-5 sm:p-7 xl:p-8 relative z-20 h-full overflow-hidden">
        {/* Top Bar Navigation & Live Status */}
        <div className="flex items-center justify-between mb-2 shrink-0">
          <button
            type="button"
            onClick={onNavigateToHome}
            className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#716d77] hover:text-[#141219] transition-colors cursor-pointer group py-1.5 px-3 rounded-lg hover:bg-[#faf7f9] border border-transparent hover:border-[#eedbe6]"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1 text-[#D30915]" />
            <span>Return to Storefront</span>
          </button>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>System Operational</span>
          </div>
        </div>

        {/* Main Sign-In Card Container */}
        <div className="w-full max-w-sm xl:max-w-md mx-auto my-auto py-1">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            {/* Logo */}
            <div className="mb-3">
              <img
                src="/assets/ilovesurprises/logo/logo-16k.png"
                alt="ILoveSurprises"
                width={8192}
                height={2048}
                className="h-9 sm:h-10 w-auto object-contain drop-shadow-xs"
              />
            </div>

            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fff1f2] border border-[#fecdd3] text-[#D30915] text-[11px] font-bold uppercase tracking-wider mb-3">
              <Lock className="w-3.5 h-3.5" />
              <span>Executive Control Center</span>
            </div>

            {/* Title & Subtitle */}
            <h2 className="text-2xl sm:text-3xl font-black text-[#141219] hero-title-font tracking-tight m-0">
              Administrator Sign-In
            </h2>
            <p className="text-xs sm:text-sm text-[#716d77] font-medium mt-1.5 max-w-sm mx-auto leading-relaxed">
              Authenticate with your administrative credentials to manage commerce, payouts, and operations.
            </p>
          </div>

          {/* Global Error Banner */}
          {errorMessage && (
            <div
              id="admin-login-error"
              className="mb-4 p-3 rounded-xl bg-[#fff1f2] border border-[#fecdd3] text-[#D30915] flex items-start gap-2.5 text-xs leading-relaxed animate-in fade-in slide-in-from-top-2 duration-200 shadow-2xs"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-[#D30915] shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-black text-[#141219] m-0 text-xs">
                  {errorMessage.toLowerCase().includes('too many') || errorMessage.toLowerCase().includes('rate')
                    ? 'Security Rate Limit Triggered'
                    : 'Authentication Failed'}
                </p>
                <p className="text-[#716d77] mt-0.5 m-0 font-medium text-[11px]">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5" noValidate autoComplete="off">
            {/* Email Input */}
            <div>
              <label
                htmlFor="admin-email"
                className="block text-xs font-black text-[#141219] uppercase tracking-wider mb-1.5"
              >
                Administrator Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#716d77]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="off"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ilovesurprisedotcom@gmail.com"
                  disabled={isLoading}
                  className="w-full pl-10 pr-3.5 py-3 bg-[#faf7f9] border border-[#eedbe6] rounded-xl text-xs sm:text-sm font-semibold text-[#141219] placeholder-[#9c93a4] focus:bg-white focus:outline-none focus:border-[#D30915] focus:ring-4 focus:ring-[#D30915]/10 shadow-2xs transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="admin-password"
                  className="block text-xs font-black text-[#141219] uppercase tracking-wider"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotFeedback(null);
                    setIsForgotModalOpen(true);
                  }}
                  className="text-xs font-bold text-[#D30915] hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#716d77]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={isLoading}
                  className="w-full pl-10 pr-10 py-3 bg-[#faf7f9] border border-[#eedbe6] rounded-xl text-xs sm:text-sm font-semibold text-[#141219] placeholder-[#9c93a4] focus:bg-white focus:outline-none focus:border-[#D30915] focus:ring-4 focus:ring-[#D30915]/10 shadow-2xs transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#716d77] hover:text-[#141219] cursor-pointer transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                  className="w-3.5 h-3.5 rounded text-[#D30915] border-[#eedbe6] focus:ring-[#D30915]"
                />
                <span className="text-[11px] font-bold text-[#55505a]">Keep me authenticated for 30 days</span>
              </label>

            </div>

            {/* Submit Button in Project Crimson Gradient */}
            <div className="pt-1.5">
              <button
                id="admin-signin-submit-btn"
                type="submit"
                disabled={isLoading}
                className="relative overflow-hidden w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#D30915] via-[#e11d48] to-[#B60711] hover:from-[#b80712] hover:to-[#9f060f] text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-[0_8px_24px_rgba(211,9,21,0.25)] hover:shadow-[0_12px_32px_rgba(211,9,21,0.35)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group"
              >
                <span
                  className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none"
                  aria-hidden="true"
                />
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Authorizing Session...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4 transition-transform group-hover:rotate-12" />
                    <span>Sign In to Admin Suite</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Security & Trust Badges */}
          <div className="mt-3.5 pt-2.5 border-t border-[#f4e2ed] grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-[#faf7f9] border border-[#eedbe6]">
              <div className="h-6 w-6 rounded-md bg-red-100/70 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-3.5 h-3.5 text-[#D30915]" />
              </div>
              <div className="leading-tight">
                <span className="text-[10px] font-black text-[#141219] block">256-Bit TLS</span>
                <span className="text-[9px] text-[#716d77] font-semibold block">Encrypted</span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-[#faf7f9] border border-[#eedbe6]">
              <div className="h-6 w-6 rounded-md bg-red-100/70 flex items-center justify-center shrink-0">
                <Shield className="w-3.5 h-3.5 text-[#D30915]" />
              </div>
              <div className="leading-tight">
                <span className="text-[10px] font-black text-[#141219] block">Rate Limited</span>
                <span className="text-[9px] text-[#716d77] font-semibold block">DDoS Shield</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Footer */}
        <div className="text-center text-[11px] text-[#716d77] pt-2.5 border-t border-[#eedbe6] flex items-center justify-center gap-1.5 font-medium shrink-0">
          <Lock className="w-3 h-3 text-[#D30915]" />
          <span>Restricted to authorized ILoveSurprises executive staff.</span>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141219]/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-white border border-[#eedbe6] rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-7 relative z-10"
            role="dialog"
            aria-modal="true"
            aria-labelledby="forgot-modal-title"
          >
            <div className="flex items-center justify-between pb-3.5 border-b border-[#eedbe6]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-[#D30915] flex items-center justify-center">
                  <Lock className="w-4.5 h-4.5" />
                </div>
                <h3 id="forgot-modal-title" className="text-base sm:text-lg font-black text-[#141219]">
                  Reset Administrator Password
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(false)}
                className="text-[#716d77] hover:text-[#141219] p-1.5 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-[#716d77] my-3.5 leading-relaxed">
              Enter your registered administrator email address to dispatch an authenticated password recovery reset link.
            </p>

            {forgotFeedback && (
              <div
                className={`p-3.5 rounded-xl mb-4 text-xs font-bold flex items-start gap-2.5 ${
                  forgotFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-[#fff0f3] text-[#D30915] border border-[#fecdd3]'
                }`}
              >
                {forgotFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#D30915] mt-0.5" />
                )}
                <span>{forgotFeedback.message}</span>
              </div>
            )}

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="forgot-admin-email"
                  className="block text-xs font-black text-[#141219] uppercase tracking-wider mb-2"
                >
                  Admin Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#716d77]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="forgot-admin-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="ilovesurprisedotcom@gmail.com"
                    disabled={isForgotLoading}
                    required
                    className="w-full pl-10 pr-4 py-3 bg-[#faf7f9] border border-[#eedbe6] rounded-xl text-sm font-semibold text-[#141219] placeholder-[#9c93a4] focus:bg-white focus:outline-none focus:border-[#D30915] focus:ring-4 focus:ring-[#D30915]/10 transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-[#716d77] hover:text-[#141219] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isForgotLoading}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D30915] to-[#B60711] hover:from-[#b80712] hover:to-[#9f060f] text-white text-xs sm:text-sm font-black uppercase tracking-wider transition-all cursor-pointer shadow-md disabled:opacity-50 flex items-center gap-2"
                >
                  {isForgotLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Sending Link...</span>
                    </>
                  ) : (
                    <span>Send Reset Link</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLogin;
