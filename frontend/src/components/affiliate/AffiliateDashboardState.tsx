import React from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft, Loader2, Clock, CheckCircle2, Sparkles } from 'lucide-react';
import { ApiError } from '../../services/apiClient';

/**
 * Loading, error, pending-approval, and not-enrolled states for the representative dashboard.
 *
 * Earnings, balances, and downline data are server-calculated, so until the
 * backend responds there is nothing truthful to display. These states replace
 * what would otherwise be placeholder figures.
 */

export type AffiliateLoadState = 'loading' | 'ready' | 'pending_approval' | 'not_enrolled' | 'error';

/** Turns a failure into an actionable message for a representative. */
export function describeAffiliateError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.isUnauthorized) {
      return 'Your session has expired. Please sign in again to view your earnings.';
    }
    if (err.isForbidden) {
      return 'Your account does not have access to the representative dashboard.';
    }
    if (err.kind === 'network') {
      return 'We could not reach the server to load your earnings. Check your connection and try again.';
    }
    if (err.kind === 'timeout') {
      return 'Loading your earnings took too long. Please try again.';
    }
    return err.displayMessage;
  }
  if (err instanceof Error) return err.message;
  return 'Your representative dashboard could not be loaded.';
}

interface AffiliateDashboardStateProps {
  state: AffiliateLoadState;
  message?: string | null;
  username?: string | null;
  onRetry: () => void | Promise<void>;
  onNavigateToHome?: () => void;
  onOpenRegistration?: () => void;
}

export const AffiliateDashboardState: React.FC<AffiliateDashboardStateProps> = ({
  state,
  message,
  username,
  onRetry,
  onNavigateToHome,
  onOpenRegistration,
}) => {
  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleRetry = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleOpenRegistrationClick = () => {
    if (onOpenRegistration) {
      onOpenRegistration();
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ils_open_subscription_modal'));
    }
  };

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-[#fcf9fb] px-4 py-8 sm:px-6 lg:px-8">
        <div className="max-w-[1460px] mx-auto space-y-4 animate-pulse">
          {/* Header block */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#eedbe6] p-5 sm:p-6 shadow-xs space-y-3">
            <div className="w-56 h-6 bg-gray-200 rounded-md" />
            <div className="w-80 max-w-full h-4 bg-gray-100 rounded-md" />
          </div>

          {/* Balance cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-[#eedbe6] p-4 sm:p-5 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="w-24 h-3.5 bg-gray-200 rounded-md" />
                  <div className="w-8 h-8 bg-gray-200 rounded-xl" />
                </div>
                <div className="w-28 h-7 bg-gray-300 rounded-lg" />
                <div className="w-20 h-3 bg-gray-100 rounded-md" />
              </div>
            ))}
          </div>

          {/* Chart + table */}
          <div className="bg-white rounded-2xl border border-[#eedbe6] p-5 shadow-xs">
            <div className="w-40 h-5 bg-gray-200 rounded-md mb-4" />
            <div className="w-full h-48 bg-gray-100 rounded-xl" />
          </div>

          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#716d77] pt-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading your verified earnings…</span>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'pending_approval') {
    return (
      <div className="min-h-screen bg-[#fcf9fb] flex items-center justify-center p-4 sm:p-8">
        <div className="max-w-md w-full bg-white rounded-3xl border border-amber-200 p-6 sm:p-8 shadow-xl text-center space-y-5 relative overflow-hidden animate-in fade-in zoom-in-95">
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-black uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>Approval Pending Review</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-[#141219] hero-title-font">
              Your Representative Approval is Pending
            </h3>
            <p className="text-xs sm:text-sm text-[#716d77] leading-relaxed">
              Thank you for applying to become an official Surprise Representative{username ? ` (@${username})` : ''}! Your application has been received and is currently under review by our administration team.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80 text-left text-xs space-y-2 text-amber-950">
            <div className="font-extrabold flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-amber-900">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
              <span>What happens next?</span>
            </div>
            <ul className="space-y-1 text-[11px] text-[#5c4a32] list-disc list-inside">
              <li>Our team reviews your consultant registration details.</li>
              <li>You will receive approval notification and onboarding access.</li>
              <li>Your custom storefront link and 20% direct commissions will unlock automatically.</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              className="px-4 py-2.5 rounded-xl border border-amber-300 hover:border-amber-400 bg-amber-50/80 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>Check Status Again</span>
            </button>

            {onNavigateToHome && (
              <button
                type="button"
                onClick={onNavigateToHome}
                className="px-4 py-2.5 rounded-xl bg-[#D30915] hover:bg-[#b00711] text-white text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Store</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (state === 'not_enrolled') {
    return (
      <div className="min-h-screen bg-[#fcf9fb] flex items-center justify-center p-4 sm:p-8">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#eedbe6] p-6 sm:p-8 shadow-xl text-center space-y-5 relative overflow-hidden animate-in fade-in zoom-in-95">
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-[#D30915]/10 rounded-full blur-2xl pointer-events-none" />

          <div className="w-16 h-16 rounded-2xl bg-[#fff1f2] border border-[#f4e0ec] text-[#D30915] flex items-center justify-center mx-auto shadow-inner">
            <Sparkles className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fff0f3] text-[#D30915] text-[10px] font-black uppercase tracking-wider">
              <span>Official Consultant Program</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-[#141219] hero-title-font">
              Register as a Representative
            </h3>
            <p className="text-xs sm:text-sm text-[#716d77] leading-relaxed">
              Your account is not currently active as an approved representative. Become a surprise consultant to earn 20% direct commissions on every candle and reveal sale!
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-left text-xs">
            <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 space-y-0.5">
              <span className="font-bold text-[#141219] block text-xs">20% Direct Commission</span>
              <span className="text-[10px] text-[#716d77] block">Earn on every candle sold</span>
            </div>
            <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 space-y-0.5">
              <span className="font-bold text-[#141219] block text-xs">Custom Storefront Link</span>
              <span className="text-[10px] text-[#716d77] block">Share easily anywhere</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={handleOpenRegistrationClick}
              className="w-full py-3 px-4 rounded-xl bg-[#D30915] hover:bg-[#b00711] text-white text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Sparkles className="w-4 h-4" />
              <span>Register to Become a Representative</span>
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="flex-1 py-2.5 rounded-xl border border-[#eedbe6] hover:border-[#D30915] bg-white text-xs font-bold text-[#141219] hover:text-[#D30915] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                <span>Check Again</span>
              </button>

              {onNavigateToHome && (
                <button
                  type="button"
                  onClick={onNavigateToHome}
                  className="flex-1 py-2.5 rounded-xl border border-[#eedbe6] hover:bg-gray-50 text-xs font-bold text-[#716d77] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Store</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcf9fb] flex items-center justify-center p-4 sm:p-8">
      <div
        role="alert"
        className="max-w-md w-full bg-white rounded-3xl border border-rose-200 p-6 sm:p-8 shadow-xl text-center space-y-5 animate-in fade-in zoom-in-95"
      >
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h3 className="text-xl sm:text-2xl font-black text-[#141219] hero-title-font">
            Could not load your earnings
          </h3>
          <p className="text-xs sm:text-sm text-[#716d77] leading-relaxed">
            {message || 'Your representative dashboard could not be loaded.'}
          </p>
          <p className="text-[11px] text-[#9a949f] leading-relaxed">
            Nothing is shown rather than estimated figures, so your commission
            totals are never misreported.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              className="flex-1 py-2.5 rounded-xl bg-[#D30915] hover:bg-[#b00711] text-white text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isRetrying ? 'Retrying…' : 'Try again'}</span>
            </button>

            {onNavigateToHome && (
              <button
                type="button"
                onClick={onNavigateToHome}
                className="flex-1 py-2.5 rounded-xl border border-[#eedbe6] hover:border-[#D30915] bg-white text-xs font-bold text-[#141219] hover:text-[#D30915] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to store</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleOpenRegistrationClick}
            className="w-full py-2.5 rounded-xl border border-dashed border-[#D30915]/60 hover:border-[#D30915] bg-[#fff9fa] text-[#D30915] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Register as a Representative</span>
          </button>
        </div>
      </div>
    </div>
  );
};
