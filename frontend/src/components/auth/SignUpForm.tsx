import React, { useState, useRef, useEffect } from 'react';
import { User, Mail, ArrowRight, AlertCircle, ShieldCheck, CheckCircle2, RefreshCw } from 'lucide-react';
import { PasswordInput } from './PasswordInput';
import { GoogleAuthButton } from './GoogleAuthButton';

import {
  authService,
  evaluatePasswordStrength,
  isValidEmail,
} from '../../services/auth';
import type { UserProfile } from '../../types';

interface SignUpFormProps {
  onSuccess: (user: UserProfile) => void;
  onSwitchToLogin: (prefillEmail?: string) => void;
}

export const SignUpForm: React.FC<SignUpFormProps> = ({
  onSuccess,
  onSwitchToLogin,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    general?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [submitCooldown, setSubmitCooldown] = useState(0);
  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [verificationSentEmail, setVerificationSentEmail] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);

  // Synchronous locks to prevent double-clicks or concurrent submissions before React re-render
  const isSubmittingRef = useRef(false);
  const isResendingRef = useRef(false);

  // Countdown timer for submit cooldown to prevent repeated signup attempts
  useEffect(() => {
    if (submitCooldown <= 0) return;
    const timer = setInterval(() => {
      setSubmitCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [submitCooldown]);

  // 60-second countdown timer for email verification resend cooldown
  useEffect(() => {
    if (!verificationSentEmail || resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [verificationSentEmail, resendCooldown]);

  const passwordStrength = evaluatePasswordStrength(password);

  const handleEmailChange = (newVal: string) => {
    setEmail(newVal);
    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
    if (isAlreadyRegistered) setIsAlreadyRegistered(false);
    if (isRateLimited) setIsRateLimited(false);
    if (errors.general) setErrors((prev) => ({ ...prev, general: undefined }));
    const remaining = authService.getSignupCooldown(newVal);
    setSubmitCooldown(remaining);
  };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!name.trim() || name.trim().length < 2) {
      newErrors.name = 'Full name must be at least 2 characters.';
    }

    if (!email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!isValidEmail(email)) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      newErrors.password = 'Password is required.';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password.';
    } else if (confirmPassword !== password) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Synchronous guard: completely blocks duplicate / rapid double clicks and submissions during cooldown
    if (isSubmittingRef.current || isLoading || submitCooldown > 0) return;
    if (!validate()) return;

    isSubmittingRef.current = true;
    setIsLoading(true);
    setIsAlreadyRegistered(false);
    setIsRateLimited(false);
    setErrors({});
    const cleanEmail = email.trim().toLowerCase();

    try {
      const res = await authService.register({
        name: name.trim(),
        email: cleanEmail,
        password,
        role: 'customer',
      });

      if (res.success && res.user) {
        onSuccess(res.user);
      } else if (res.success && res.requiresVerification) {
        setVerificationSentEmail(cleanEmail);
        setResendCooldown(60);
      } else {
        const remainingCd = authService.getSignupCooldown(cleanEmail);
        if (remainingCd > 0) {
          setSubmitCooldown(remainingCd);
        }
        if (res.isAlreadyRegistered) {
          setIsAlreadyRegistered(true);
        }
        if (res.isRateLimited) {
          setIsRateLimited(true);
        }
        setErrors({ general: res.error || 'Registration failed. Please try again.' });
      }
    } catch (err: any) {
      const remainingCd = authService.getSignupCooldown(cleanEmail);
      if (remainingCd > 0) {
        setSubmitCooldown(remainingCd);
      }
      setErrors({ general: err?.message || 'Connection error. Please check your internet connection and try again.' });
    } finally {
      isSubmittingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    // Synchronous guard + cooldown enforcement: prevents duplicate clicks
    if (!verificationSentEmail || isResendingRef.current || isResending || resendCooldown > 0) return;
    isResendingRef.current = true;
    setIsResending(true);
    setResendStatus(null);
    try {
      const res = await authService.resendVerification(verificationSentEmail);
      if (res.success) {
        setResendStatus('A new verification email has been sent. Please check your inbox!');
        setResendCooldown(60);
      } else {
        setResendStatus(res.error || 'Failed to resend. Please try again shortly.');
      }
    } catch (err: any) {
      setResendStatus(err?.message || 'Connection error. Please check your internet connection and try again.');
    } finally {
      isResendingRef.current = false;
      setIsResending(false);
    }
  };

  if (verificationSentEmail) {
    return (
      <div className="w-full text-center py-3 space-y-4 animate-in fade-in zoom-in-95 duration-300">
        <img
          src="/assets/ilovesurprises/logo/logo-16k.png"
          alt="I Love Surprises Logo"
          width={8192}
          height={2728}
          className="h-[42px] sm:h-[50px] w-auto max-w-[195px] sm:max-w-[230px] mx-auto object-contain mb-2"
        />

        <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
          <Mail className="w-7 h-7 stroke-[2.2]" />
        </div>

        <div>
          <span className="inline-block text-[11px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 mb-2">
            Verification Required
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-[#141219] tracking-tight m-0 font-display">
            Check Your Inbox
          </h2>
          <p className="text-xs text-[#55505a] mt-2 leading-relaxed max-w-xs mx-auto font-medium">
            We've sent a verification link to <strong className="text-[#141219]">{verificationSentEmail}</strong>.
            Please click the link in your email to verify your account before logging in.
          </p>
        </div>

        {resendStatus && (
          <div className="p-3 rounded-[13px] bg-[#fff1f2] border border-[#fecdd3] text-xs font-bold text-[#D30915] text-left flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{resendStatus}</span>
          </div>
        )}

        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            onClick={() => onSwitchToLogin(verificationSentEmail)}
            className="w-full h-[44px] rounded-[13px] bg-[#D30915] hover:bg-[#B60711] text-white text-xs sm:text-sm font-black uppercase tracking-wider shadow-[0_8px_20px_rgba(211,9,21,0.28)] hover:shadow-[0_12px_28px_rgba(211,9,21,0.38)] hover:-translate-y-0.5 active:scale-97 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Proceed to Login</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleResendVerification}
            disabled={isResending || resendCooldown > 0}
            className="w-full h-[40px] rounded-[13px] bg-white border border-[#e8dfe5] hover:border-[#D30915] text-[#716d77] hover:text-[#D30915] text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResending ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Resending Link...</span>
              </>
            ) : resendCooldown > 0 ? (
              <span>Resend Verification Email ({resendCooldown}s)</span>
            ) : (
              <span>Resend Verification Email</span>
            )}
          </button>
        </div>

        <div className="pt-2 text-[10px] text-[#8a858f] flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Unverified accounts cannot access order tracking or VIP discounts</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Centered Logo & Header */}
      <div className="text-center mb-4">
        <img
          src="/assets/ilovesurprises/logo/logo-16k.png"
          alt="I Love Surprises Logo"
          width={8192}
          height={2728}
          className="h-[42px] min-[360px]:h-[46px] min-[390px]:h-[50px] min-[420px]:h-[52px] sm:h-[57px] w-auto max-w-[170px] min-[360px]:max-w-[195px] min-[390px]:max-w-[215px] min-[420px]:max-w-[230px] sm:max-w-[265px] mx-auto object-contain mb-2.5"
          loading="eager"
          style={{
            imageRendering: '-webkit-optimize-contrast',
            WebkitBackfaceVisibility: 'hidden',
            backfaceVisibility: 'hidden',
            transform: 'translateZ(0)',
          }}
        />
        <h2 className="text-xl sm:text-2xl font-black text-[#141219] tracking-tight m-0 font-display">
          Create your account
        </h2>
        <p className="text-xs text-[#716d77] mt-1 m-0">
          Create a simple user account. Choose VIP or representative plans later.
        </p>
      </div>

      {/* General Error Banner */}
      {errors.general && (
        <div
          className={`mb-3.5 p-3 sm:p-3.5 rounded-[14px] text-xs font-semibold flex flex-col gap-2.5 animate-in fade-in duration-200 ${
            isAlreadyRegistered
              ? 'bg-amber-50 border border-amber-200 text-amber-900'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
          role="alert"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${isAlreadyRegistered ? 'text-amber-600' : 'text-red-500'}`} />
            <div className="flex-1 leading-relaxed">
              <span>{errors.general}</span>
            </div>
          </div>

          {(isAlreadyRegistered || isRateLimited || errors.general.toLowerCase().includes('log in') || errors.general.toLowerCase().includes('already registered')) && (
            <div className="pt-2 border-t border-black/5 flex items-center justify-between gap-2">
              <span className="text-[11px] text-[#55505a] font-medium">
                {isAlreadyRegistered ? 'Already have an account?' : 'Have an existing account?'}
              </span>
              <button
                type="button"
                onClick={() => onSwitchToLogin(email.trim().toLowerCase())}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[#D30915] hover:bg-[#B60711] text-white text-[11px] font-black uppercase tracking-wider shadow-xs hover:shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <span>Log In</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3 mb-3.5">
        <GoogleAuthButton
          onSuccess={onSuccess}
          onError={(message) => setErrors({ general: message })}
          disabled={isLoading || submitCooldown > 0}
          label="Continue with Google"
        />
        <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-wider text-[#8a858f]">
          <span className="h-px flex-1 bg-[#f2edf1]" />
          <span>or</span>
          <span className="h-px flex-1 bg-[#f2edf1]" />
        </div>
      </div>

      {/* Registration Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        {/* Full Name */}
        <div>
          <label htmlFor="signup-name" className="block text-[11px] sm:text-xs font-bold text-[#141219] mb-1">
            Full Name <span className="text-[#D30915]">*</span>
          </label>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8a858f] pointer-events-none">
              <User className="w-4 h-4" />
            </div>
            <input
              id="signup-name"
              type="text"
              name="name"
              required
              disabled={isLoading}
              placeholder="Your name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              className={`w-full h-[40px] sm:h-[42px] pl-10 pr-3 rounded-[12px] bg-[#fffafb] border text-xs sm:text-sm font-medium text-[#141219] placeholder:text-[#9c95a0] transition-all outline-none disabled:opacity-50 ${errors.name
                ? 'border-red-400 focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100'
                : 'border-[#ebdce5] hover:border-[#f1b8cb] focus:border-[#D30915] focus:bg-white focus:ring-2 focus:ring-[#D30915]/10'
                }`}
            />
          </div>
          {errors.name && (
            <p className="text-[11px] text-red-500 mt-1 font-medium flex items-center gap-1">
              <span>⚠️</span>
              <span>{errors.name}</span>
            </p>
          )}
        </div>

        {/* Email Address */}
        <div>
          <label htmlFor="signup-email" className="block text-[11px] sm:text-xs font-bold text-[#141219] mb-1">
            Email Address <span className="text-[#D30915]">*</span>
          </label>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8a858f] pointer-events-none">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="signup-email"
              type="email"
              name="email"
              autoComplete="email"
              required
              disabled={isLoading}
              placeholder="example@gmail.com"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              className={`w-full h-[40px] sm:h-[42px] pl-10 pr-3 rounded-[12px] bg-[#fffafb] border text-xs sm:text-sm font-medium text-[#141219] placeholder:text-[#9c95a0] transition-all outline-none disabled:opacity-50 ${errors.email
                ? 'border-red-400 focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100'
                : 'border-[#ebdce5] hover:border-[#f1b8cb] focus:border-[#D30915] focus:bg-white focus:ring-2 focus:ring-[#D30915]/10'
                }`}
            />
          </div>
          {errors.email && (
            <p className="text-[11px] text-red-500 mt-1 font-medium flex items-center gap-1">
              <span>⚠️</span>
              <span>{errors.email}</span>
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <PasswordInput
            id="signup-password"
            name="password"
            label="Password"
            required
            disabled={isLoading}
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            error={errors.password}
          />

          {/* Password Strength Indicator */}
          {password.length > 0 && (
            <div className="mt-1.5 px-0.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-[#716d77] mb-1">
                <span>Password strength</span>
                <span style={{ color: passwordStrength.color }}>{passwordStrength.label}</span>
              </div>
              <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-300 rounded-full"
                  style={{
                    width: `${passwordStrength.percentage}%`,
                    backgroundColor: passwordStrength.color,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <PasswordInput
          id="signup-confirm-password"
          name="confirmPassword"
          label="Confirm Password"
          required
          disabled={isLoading}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
          }}
          error={errors.confirmPassword}
        />

        {/* Submit CTA */}
        <button
          type="submit"
          disabled={isLoading || submitCooldown > 0}
          className="w-full h-[44px] sm:h-[46px] rounded-[14px] bg-gradient-to-r from-[#D30915] to-[#B60711] hover:from-[#B60711] hover:to-[#96050e] text-white text-xs sm:text-sm font-black uppercase tracking-wider shadow-[0_8px_22px_rgba(211,9,21,0.28)] hover:shadow-[0_12px_28px_rgba(211,9,21,0.38)] hover:-translate-y-0.5 active:translate-y-0 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 mt-3.5"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Creating Account...</span>
            </div>
          ) : submitCooldown > 0 ? (
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Please wait ({submitCooldown}s)</span>
            </div>
          ) : (
            <>
              <span>CREATE ACCOUNT</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Switch to Login */}
      <div className="mt-4 pt-3.5 border-t border-[#f2edf1] text-center">
        <p className="text-xs text-[#716d77] m-0">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => onSwitchToLogin(email.trim().toLowerCase())}
            className="text-xs font-black text-[#D30915] hover:text-[#B60711] hover:underline focus:outline-none cursor-pointer ml-1 active:scale-95 transition-all"
          >
            Login
          </button>
        </p>
      </div>

      {/* Security Trust Note */}
      <div className="mt-3 text-center text-[10px] text-[#8a858f] flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>Your data is protected under 256-Bit SSL Encryption</span>
      </div>
    </div>
  );
};
