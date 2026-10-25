import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Check,
  ShieldCheck,
  CreditCard,
  Lock,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  Store,
  Package,
  CheckCircle2,
  Zap,
  Truck,
  DollarSign,
  Gift,
  HelpCircle,
  Award,
  Copy,
  Upload,
  Camera,
  Trash2,
  Eye,
  EyeOff,
  KeyRound,
  Clock,
} from 'lucide-react';
import type { UserProfile } from '../../types';
import { isRepresentativeUser } from '../../types';
import { accountService } from '../../services/accountService';
import { affiliateService } from '../../services/affiliateService';
import { customerAuthService } from '../../services/customerAuthService';
import { ApiError } from '../../services/apiClient';

export interface RepresentativeSubscriptionModalProps {
  isOpen: boolean;
  user?: UserProfile | null;
  onClose: () => void;
  onSuccess?: () => void;
  onShowToast?: (message: string, options?: { title?: string; type?: 'success' | 'info' | 'cart' }) => void;
}

export type PlanOptionId = 'monthly' | 'six_month' | 'twelve_month';
export type StarterKitId = 'kit-standard' | 'kit-pro';
export type EnrollmentStep = 'configure' | 'payment' | 'success';

interface PlanConfig {
  id: PlanOptionId;
  name: string;
  price: number;
  monthlyEquivalent: number;
  discountBadge?: string;
  billingFrequency: string;
  description: string;
  perks: string[];
  popular?: boolean;
}

const MEMBERSHIP_PLANS: PlanConfig[] = [
  {
    id: 'monthly',
    name: 'Monthly License',
    price: 19.99,
    monthlyEquivalent: 19.99,
    billingFrequency: 'Billed monthly ($19.99/mo)',
    description: 'Standard auto-renewing consultant license & replicated storefront.',
    perks: [
      'Replicated storefront URL',
      'Live analytics portal',
      'Standard support',
    ],
  },
  {
    id: 'six_month',
    name: '6-Month Prepaid',
    price: 107.95,
    monthlyEquivalent: 17.99,
    discountBadge: 'Save 10%',
    billingFrequency: 'Billed $107.95 every 6 months',
    description: 'Save $12 upfront. Lock in your rate for 6 months of active storefront status.',
    perks: [
      'Save $12 upfront (10% off)',
      '5-Level team overrides',
      'Digital promo pack',
    ],
  },
  {
    id: 'twelve_month',
    name: '12-Month Annual VIP',
    price: 203.90,
    monthlyEquivalent: 16.99,
    discountBadge: 'Save 15% • Best Value',
    billingFrequency: 'Billed $203.90 annually',
    description: 'Save $36 upfront. Highest savings, priority support & official VIP badge.',
    perks: [
      'Save $36 upfront (15% off)',
      'Official VIP Consultant Badge',
      'Priority 24/7 dedicated line',
    ],
    popular: true,
  },
];

const STARTER_KITS = [
  {
    id: 'kit-standard' as StarterKitId,
    name: 'Essential Launch Starter Kit',
    price: 49.0,
    retailValue: 120.0,
    savingsBadge: 'Save 59%',
    badge: 'Popular Entry Kit',
    description: 'Includes reveal candle, surprise ring candle, 2 bath bombs, and digital launch guides.',
    items: [
      { name: 'Cash Candle (1x)', desc: 'Real cash inside ($2-$2,500)' },
      { name: 'Surprise Ring Candle (1x)', desc: 'Jewelry reveal appraised $10-$5,000' },
      { name: 'Bath Bomb Cash (2x)', desc: 'Fizzy cash reveal bath treats' },
      { name: 'Quickstart Digital Guide', desc: 'Step-by-step launch roadmap' },
    ],
  },
  {
    id: 'kit-pro' as StarterKitId,
    name: 'Pro Ambassador Starter Kit',
    price: 99.0,
    retailValue: 250.0,
    savingsBadge: 'Save 60% • Best for Parties',
    badge: 'Recommended for High Earners',
    description: 'Contains 4 Best-Selling Cash Candles, 2 Bath Bombs, 2 Wax Melts, scent strips & catalogs.',
    items: [
      { name: 'Cash Candles (2x)', desc: '2 best-selling cash reveal candles' },
      { name: 'Diamond Ring Candles (2x)', desc: '2 ring surprise candles' },
      { name: 'Aroma Samplers (50x)', desc: 'Scratch & sniff customer scent strips' },
      { name: 'Branded Swag & Apron', desc: 'Consultant apron & launch catalogs' },
    ],
    highlighted: true,
  },
];

const RESTRICTED_USERNAMES = [
  'admin',
  'administrator',
  'ilovesurprises',
  'official',
  'support',
  'help',
  'ceo',
  'founder',
  'billing',
  'root',
  'payouts',
  'security',
  'mod',
  'staff',
];

export const RepresentativeSubscriptionModal: React.FC<RepresentativeSubscriptionModalProps> = ({
  isOpen,
  user,
  onClose,
  onSuccess,
  onShowToast,
}) => {
  const [step, setStep] = useState<EnrollmentStep>('configure');
  const [selectedPlan, setSelectedPlan] = useState<PlanOptionId>('twelve_month');
  const [selectedKit, setSelectedKit] = useState<StarterKitId>('kit-standard');
  const [fullName, setFullName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [username, setUsername] = useState(
    user?.name ? user.name.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'my_surprise_store'
  );
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Payment Form States
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'apple_pay' | 'paypal'>('card');
  // Card number, expiry, and CVC are not held in application state: there is
  // no payment integration to send them to, and the full PAN and CVC must
  // never pass through this app. Only the billing contact name is kept.
  const [cardholderName, setCardholderName] = useState(fullName || '');
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null);
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Profile Photo Upload States (Section 3 Requirement)
  const [avatarUrl, setAvatarUrl] = useState<string>(
    user?.avatar || '/assets/ilovesurprises/Profile/profile%20image.webp'
  );
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isPhotoCustom, setIsPhotoCustom] = useState<boolean>(Boolean(user?.avatar));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Image size exceeds 5MB limit. Please choose a smaller photo.');
      return;
    }

    setPhotoError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setAvatarUrl(event.target.result as string);
        setIsPhotoCustom(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setAvatarUrl('/assets/ilovesurprises/Profile/profile%20image.webp');
    setIsPhotoCustom(false);
    setPhotoError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Guard: if user is already an active representative, immediately suppress enrollment modal
  useEffect(() => {
    if (isOpen && isRepresentativeUser(user)) {
      onShowToast?.('You are already an active representative! Directing to your consultant portal.', {
        title: 'Representative Active',
        type: 'info',
      });
      onSuccess?.();
      onClose();
    }
  }, [isOpen, user, onClose, onSuccess, onShowToast]);

  // Reset step when modal opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setStep('configure');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Sync user details if user prop changes
  useEffect(() => {
    if (user?.name) {
      const timer = setTimeout(() => {
        setFullName((prev) => prev || user.name);
        setCardholderName((prev) => prev || user.name);
        setEmail((prev) => prev || user.email);
        setUsername((prev) =>
          prev === 'my_surprise_store' ? user.name.toLowerCase().replace(/[^a-z0-9]/g, '_') : prev
        );
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user]);

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Username validation per PDF requirements
  const handleUsernameChange = (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(clean);

    if (RESTRICTED_USERNAMES.includes(clean)) {
      setUsernameError(`"${clean}" is a reserved system word. Please choose another.`);
    } else if (clean.length < 3) {
      setUsernameError('Username must be at least 3 characters.');
    } else {
      setUsernameError(null);
    }
  };

  if (!isOpen) return null;

  const currentPlan = MEMBERSHIP_PLANS.find((p) => p.id === selectedPlan)!;
  const currentKit = STARTER_KITS.find((k) => k.id === selectedKit)!;
  const grandTotal = currentPlan.price + currentKit.price;
  const estimatedPackageValue = currentKit.retailValue + 120 + 50 + 14.99;

  // Step 1: Proceed from Configuration to Payment Page
  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();

    if (usernameError || !username.trim()) {
      onShowToast?.('Please resolve the username warning before continuing.', {
        title: 'Validation Error',
        type: 'info',
      });
      return;
    }

    if (!fullName.trim() || !email.trim()) {
      onShowToast?.('Please enter your full name and email address.', {
        title: 'Required Fields',
        type: 'info',
      });
      return;
    }

    const storedUser = accountService.getStoredUser();
    if (!storedUser && (!password || password.length < 6)) {
      setPasswordError('Please provide a password of at least 6 characters for your representative account login.');
      onShowToast?.('Please provide a password of at least 6 characters for your representative account login credentials.', {
        title: 'Password Required',
        type: 'info',
      });
      return;
    }
    setPasswordError(null);

    setCardholderName(fullName);
    setStep('payment');
  };

  /**
   * Step 2: Submit representative application for Admin approval.
   *
   * The applicant's credentials (Email ID + Password) are registered.
   * Then `POST /api/affiliates/register` creates the profile with status 'PENDING'
   * and isActive = false. The storefront URL remains inactive until an Administrator
   * approves the application in the Admin panel.
   */
  const handleCompleteSubscriptionPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const cleanUsername = username.toLowerCase().trim();

    setIsSubmitting(true);
    setEnrollmentError(null);

    try {
      // 1. Ensure user has an account using their Email ID and Password
      const storedUser = accountService.getStoredUser();
      if (!storedUser && password) {
        const regRes = await customerAuthService.registerWithEmailPassword({
          name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password: password,
          role: 'customer',
        });
        if (!regRes.success) {
          // If already registered, attempt sign-in
          const loginRes = await customerAuthService.loginWithEmailPassword({
            identifier: email.trim().toLowerCase(),
            password: password,
          });
          if (!loginRes.success) {
            throw new Error(
              regRes.error ||
                loginRes.error ||
                'Authentication failed. Please verify your email and password.'
            );
          }
        }
      }

      // 2. Submit affiliate application in PENDING status for Admin review
      await affiliateService.registerAffiliate({
        username: cleanUsername,
        avatar: isPhotoCustom ? avatarUrl : undefined,
      });

      // Refresh current user data
      const refreshed = await customerAuthService.getCurrentUser();
      if (refreshed) {
        accountService.updateStoredUser({
          ...refreshed,
          repUsername: cleanUsername,
        });
        window.dispatchEvent(new CustomEvent('ilovesurprises_user_updated'));
      }

      window.dispatchEvent(
        new CustomEvent('ils_consultant_subscribed', {
          detail: { username: cleanUsername, fullName },
        })
      );
      window.dispatchEvent(new CustomEvent('ils_affiliate_updated'));

      onShowToast?.(
        `Application submitted for Admin review, ${fullName}! Your storefront URL will be created and activated once approved.`,
        { title: 'Application Submitted', type: 'success' }
      );

      setStep('success');
    } catch (err: any) {
      const message =
        err instanceof ApiError
          ? err.statusCode === 401
            ? 'Please enter your password or sign in to submit your application.'
            : err.statusCode === 409
              ? 'That username handle is already taken. Please choose another.'
              : err.displayMessage
          : err?.message || 'Your representative application could not be submitted.';

      setEnrollmentError(message);
      onShowToast?.(message, { title: 'Submission failed', type: 'info' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyStoreUrl = () => {
    const url = `https://ilovesurprises.com/${username.toLowerCase().trim()}`;
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    onShowToast?.('Storefront URL copied to clipboard!', { type: 'success' });
  };

  if (!isOpen || isRepresentativeUser(user)) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/60 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className={`relative w-full ${step === 'success' ? 'max-w-lg sm:max-w-xl' : 'max-w-5xl lg:max-w-6xl xl:max-w-7xl'} my-auto bg-white rounded-[24px] shadow-[0_24px_70px_rgba(0,0,0,0.32)] border border-stone-200 overflow-hidden flex flex-col max-h-[92vh] transition-all duration-300`}>
        
        {/* Simple, Clean & Elegant Header (Only shown during configuration and payment) */}
        {step !== 'success' && (
          <div className="bg-gradient-to-r from-[#B60711] via-[#D30915] to-[#B60711] text-white px-6 py-5 sm:px-8 sm:py-6 relative shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 sm:top-5 right-4 sm:right-6 w-9 h-9 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition-all cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/20 text-[11px] font-black uppercase tracking-wider text-white">
                  Official Consultant Enrollment
                </span>
                <span className="text-[11px] font-bold text-white/85">
                  Earn 20% Personal + Up to 35% Across 5 Levels
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white m-0">
                {step === 'payment'
                  ? 'Complete Subscription & Payment'
                  : 'Start Your Surprise Business Today'}
              </h2>

              <p className="text-xs sm:text-sm text-white/90 mt-1 m-0 leading-normal">
                {step === 'payment'
                  ? 'Enter your payment details and starter kit delivery address to activate your official custom storefront.'
                  : 'Choose your membership billing term and starter kit to activate your custom storefront and start earning recurring commissions.'}
              </p>
            </div>
          </div>
        )}

        {/* STEP 1: CONFIGURE PLAN, KIT & PROFILE */}
        {step === 'configure' && (
          <form onSubmit={handleProceedToPayment} className="overflow-y-auto flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 p-5 sm:p-7 lg:p-8 items-stretch">
              
              {/* LEFT COLUMN: Configuration Steps */}
              <div className="lg:col-span-7 xl:col-span-7 space-y-6 flex flex-col justify-between">
                
                {/* Consultant Advantage Highlights Bar */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3 p-3 sm:p-3.5 rounded-2xl bg-gradient-to-b from-rose-50/70 to-[#fff5f6] border border-rose-200/70 text-center">
                  <div className="flex flex-col items-center justify-center p-1">
                    <div className="w-8 h-8 rounded-full bg-white text-[#D30915] shadow-xs flex items-center justify-center mb-1.5 border border-rose-100">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <span className="text-xs sm:text-[13px] font-black text-stone-900 leading-tight">20% Direct Sales</span>
                    <span className="text-[10px] sm:text-[11px] text-stone-500 font-medium mt-0.5 whitespace-nowrap">Instant profit per order</span>
                  </div>

                  <div className="flex flex-col items-center justify-center p-1 border-x border-rose-200/70">
                    <div className="w-8 h-8 rounded-full bg-white text-purple-700 shadow-xs flex items-center justify-center mb-1.5 border border-purple-100">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <span className="text-xs sm:text-[13px] font-black text-stone-900 leading-tight">5-Tier Overrides</span>
                    <span className="text-[10px] sm:text-[11px] text-stone-500 font-medium mt-0.5 whitespace-nowrap">Up to 35% total payout</span>
                  </div>

                  <div className="flex flex-col items-center justify-center p-1">
                    <div className="w-8 h-8 rounded-full bg-white text-emerald-600 shadow-xs flex items-center justify-center mb-1.5 border border-emerald-100">
                      <Zap className="w-4 h-4" />
                    </div>
                    <span className="text-xs sm:text-[13px] font-black text-stone-900 leading-tight">100% Drop-Shipped</span>
                    <span className="text-[10px] sm:text-[11px] text-stone-500 font-medium mt-0.5 whitespace-nowrap">Zero inventory needed</span>
                  </div>
                </div>

                {/* STEP 1: CHOOSE MEMBERSHIP PLAN */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#D30915] text-white text-xs flex items-center justify-center font-black shrink-0">
                        1
                      </span>
                      <h3 className="text-sm sm:text-base font-black text-stone-900 tracking-tight m-0">
                        Choose Membership Billing Plan
                      </h3>
                    </div>
                    <span className="text-[11px] text-stone-500 font-medium">
                      Automatic recurring renewal
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
                    {MEMBERSHIP_PLANS.map((plan) => {
                      const isSelected = selectedPlan === plan.id;
                      return (
                        <div
                          key={plan.id}
                          onClick={() => setSelectedPlan(plan.id)}
                          className={`relative rounded-2xl p-4 border-2 transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'border-[#D30915] bg-[#fffafb] ring-2 ring-[#D30915]/15 shadow-sm'
                              : 'border-stone-200 hover:border-rose-300 bg-white hover:bg-stone-50/50'
                          }`}
                        >
                          <div className="flex flex-col flex-1">
                            {/* Uniform Badge Header Row */}
                            <div className="flex items-center justify-between gap-1.5 mb-2 h-6">
                              {plan.discountBadge ? (
                                <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-black tracking-wider uppercase shadow-xs ${
                                  plan.popular ? 'bg-[#D30915] text-white' : 'bg-rose-100 text-[#D30915] border border-rose-200'
                                }`}>
                                  {plan.discountBadge}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[9.5px] font-bold tracking-wider uppercase">
                                  Standard Tier
                                </span>
                              )}

                              <div
                                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                                  isSelected ? 'border-[#D30915] bg-[#D30915]' : 'border-stone-300'
                                }`}
                              >
                                {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                              </div>
                            </div>

                            {/* Plan Name */}
                            <h4 className="text-sm font-black text-stone-900 leading-tight m-0">
                              {plan.name}
                            </h4>

                            {/* Monthly Price */}
                            <div className="flex items-baseline gap-1 my-2">
                              <span className="text-2xl font-black text-[#D30915] tracking-tight">
                                ${plan.monthlyEquivalent.toFixed(2)}
                              </span>
                              <span className="text-xs text-stone-500 font-bold">/mo</span>
                            </div>

                            {/* Plan Description with uniform min-height */}
                            <p className="text-[11px] text-stone-600 leading-snug font-medium min-h-[34px] mb-3 m-0">
                              {plan.description}
                            </p>

                            {/* Perks list: clean, straight, un-truncated with emerald check icons */}
                            <div className="space-y-1.5 pt-2.5 border-t border-stone-100 flex-1">
                              {plan.perks.map((perk) => (
                                <div key={perk} className="flex items-start gap-1.5 text-[11px] text-stone-700 font-medium leading-tight">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                  <span>{perk}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Footer: Billed terms and total */}
                          <div className="pt-2.5 mt-3 border-t border-stone-100 flex items-center justify-between text-[11px]">
                            <span className="text-stone-500 font-medium">{plan.billingFrequency}</span>
                            <span className="text-stone-900 font-black shrink-0 text-xs">${plan.price.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-stone-500 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Flexibility guarantee: Pause, switch billing terms, or cancel anytime with 1 click in your portal.</span>
                  </div>
                </div>

                {/* STEP 2: SELECT REQUIRED STARTER KIT */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#D30915] text-white text-xs flex items-center justify-center font-black shrink-0">
                        2
                      </span>
                      <h3 className="text-sm sm:text-base font-black text-stone-900 tracking-tight m-0">
                        Select Your Required Starter Kit
                      </h3>
                    </div>
                    <span className="text-[11px] text-[#D30915] font-black uppercase tracking-wider">
                      Mandatory for Activation
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3.5">
                    {STARTER_KITS.map((kit) => {
                      const isSelected = selectedKit === kit.id;
                      return (
                        <div
                          key={kit.id}
                          onClick={() => setSelectedKit(kit.id)}
                          className={`relative rounded-2xl p-4 sm:p-5 border-2 transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'border-[#D30915] bg-[#fffafb] ring-2 ring-[#D30915]/15 shadow-sm'
                              : 'border-stone-200 hover:border-rose-300 bg-white hover:bg-stone-50/50'
                          }`}
                        >
                          <div className="space-y-3">
                            {/* Top Header Row: Badges, Name, Price & Radio Indicator all straight */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1 flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="inline-block text-[9.5px] font-black uppercase tracking-wider text-[#D30915] bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-md whitespace-nowrap">
                                    {kit.badge}
                                  </span>
                                  <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 whitespace-nowrap">
                                    {kit.savingsBadge}
                                  </span>
                                </div>
                                <h4 className="text-sm sm:text-base font-black text-stone-900 m-0 leading-tight">
                                  {kit.name}
                                </h4>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <div className="text-right flex items-baseline gap-1.5">
                                  <span className="text-lg sm:text-xl font-black text-[#D30915]">
                                    ${kit.price.toFixed(2)}
                                  </span>
                                  <span className="text-xs text-stone-400 line-through font-semibold">
                                    ${kit.retailValue.toFixed(2)}
                                  </span>
                                </div>

                                <div
                                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                    isSelected ? 'border-[#D30915] bg-[#D30915]' : 'border-stone-300'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                                </div>
                              </div>
                            </div>

                            <p className="text-xs text-stone-600 leading-normal m-0 font-medium">
                              {kit.description}
                            </p>

                            {/* Included Items: Clean Single Straight Lines */}
                            <div className="pt-2.5 border-t border-stone-100 space-y-1.5">
                              <div className="flex items-center justify-between text-[10.5px] font-bold pb-0.5">
                                <span className="uppercase text-stone-400 tracking-wider">
                                  Included in box:
                                </span>
                                <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                                  <Truck className="w-3 h-3" />
                                  Priority Tracked
                                </span>
                              </div>

                              <div className="space-y-1.5">
                                {kit.items.map((it) => (
                                  <div
                                    key={it.name}
                                    className="flex items-center gap-2 py-1.5 px-3 rounded-xl bg-stone-50/90 border border-stone-200/70 hover:bg-stone-100/70 transition-colors text-[11.5px] sm:text-xs"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span className="font-bold text-stone-900 whitespace-nowrap shrink-0">
                                      {it.name}
                                    </span>
                                    <span className="text-stone-400 font-normal shrink-0">—</span>
                                    <span className="text-stone-600 font-medium truncate sm:whitespace-nowrap">
                                      {it.desc}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* STEP 3: CONSULTANT PROFILE & STOREFRONT URL */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#D30915] text-white text-xs flex items-center justify-center font-black shrink-0">
                        3
                      </span>
                      <h3 className="text-sm sm:text-base font-black text-stone-900 tracking-tight m-0">
                        Personal Storefront & Profile Details
                      </h3>
                    </div>
                    <span className="text-[11px] text-stone-500 font-medium flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Phone strictly private
                    </span>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl bg-stone-50/80 border border-stone-200 space-y-4">
                    {/* SECTION 3 REQUIREMENT: PROFILE PHOTO UPLOAD WITH PREVIEW */}
                    <div className="p-3.5 rounded-xl bg-white border border-stone-200/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5 m-0">
                          <Camera className="w-3.5 h-3.5 text-[#D30915]" />
                          <span>Representative Profile Photo *</span>
                        </label>
                        <span className="text-[10px] text-stone-400">JPG, PNG, WebP (Max 5MB)</span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="relative shrink-0">
                          <img
                            src={avatarUrl}
                            alt="Representative Preview"
                            className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#D30915]/30 shadow-xs border border-stone-200"
                          />
                          <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" />
                        </div>

                        <div className="flex-1 min-w-0 space-y-1.5">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/jpg"
                            onChange={handlePhotoUpload}
                            className="hidden"
                            id="rep-photo-file-input"
                          />

                          <div className="flex flex-wrap items-center gap-2">
                            <label
                              htmlFor="rep-photo-file-input"
                              className="px-3 py-1.5 rounded-xl bg-[#fff1f2] hover:bg-[#D30915] text-[#D30915] hover:text-white border border-[#fecdd3] text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 active:scale-95 shadow-2xs"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>{isPhotoCustom ? 'Change Photo' : 'Upload Photo'}</span>
                            </label>

                            {isPhotoCustom && (
                              <button
                                type="button"
                                onClick={handleRemovePhoto}
                                className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-rose-50 text-stone-600 hover:text-rose-700 text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Remove</span>
                              </button>
                            )}
                          </div>

                          <p className="text-[10.5px] text-stone-500 m-0">
                            Your photo will be displayed prominently on your personal storefront banner.
                          </p>
                        </div>
                      </div>

                      {photoError && (
                        <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                          {photoError}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="text-xs font-bold text-stone-700 block mb-1">
                          Your Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Your name"
                          className="w-full h-10 px-3.5 rounded-xl bg-white border border-stone-300 text-xs sm:text-sm text-stone-900 font-medium focus:outline-none focus:border-[#D30915] focus:ring-2 focus:ring-[#D30915]/15 transition-all"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-stone-700 block mb-1">
                          Email Address (Login ID) *
                        </label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="example@gmail.com"
                          className="w-full h-10 px-3.5 rounded-xl bg-white border border-stone-300 text-xs sm:text-sm text-stone-900 font-medium focus:outline-none focus:border-[#D30915] focus:ring-2 focus:ring-[#D30915]/15 transition-all"
                        />
                        <span className="text-[10px] text-stone-500 mt-1 block">
                          This email ID will be used to log in to your Representative account.
                        </span>
                      </div>
                    </div>

                    {/* Section: Representative Login Password */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5 m-0">
                          <KeyRound className="w-3.5 h-3.5 text-[#D30915]" />
                          <span>Representative Login Password *</span>
                        </label>
                        <span className="text-[10.5px] text-stone-400">Min 6 characters</span>
                      </div>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required={!user}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (passwordError) setPasswordError(null);
                          }}
                          placeholder={user ? 'Enter new password (or keep existing)' : 'Create representative login password'}
                          className="w-full h-10 pl-3.5 pr-10 rounded-xl bg-white border border-stone-300 text-xs sm:text-sm text-stone-900 font-medium focus:outline-none focus:border-[#D30915] focus:ring-2 focus:ring-[#D30915]/15 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition-colors p-1"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {passwordError ? (
                        <p className="text-[11px] font-bold text-red-600 mt-1">{passwordError}</p>
                      ) : (
                        <span className="text-[10px] text-stone-500 mt-1 block">
                          Your Email ID and this Password will be your login credentials once approved by the Admin.
                        </span>
                      )}
                    </div>

                    {/* Storefront URL Builder */}
                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        Choose Your Replicated Storefront URL *
                      </label>
                      <div className="flex items-center rounded-xl bg-white border border-stone-300 focus-within:border-[#D30915] focus-within:ring-2 focus-within:ring-[#D30915]/15 overflow-hidden transition-all">
                        <span className="px-3.5 text-xs font-mono font-bold text-stone-500 bg-stone-100 border-r border-stone-200 select-none py-2.5 flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-stone-400" />
                          ilovesurprises.com/
                        </span>
                        <input
                          type="text"
                          required
                          value={username}
                          onChange={(e) => handleUsernameChange(e.target.value)}
                          placeholder="my_surprise_store"
                          className="flex-1 h-10 px-3.5 text-xs sm:text-sm font-mono font-bold text-[#D30915] focus:outline-none bg-transparent"
                        />
                      </div>

                      {usernameError ? (
                        <p className="text-[11px] font-bold text-red-600 mt-1.5 flex items-center gap-1">
                          <span>⚠️</span> {usernameError}
                        </p>
                      ) : (
                        <div className="mt-2 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-2">
                          <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="text-[11px] text-amber-900 leading-tight">
                            <span className="font-bold">Requested Storefront URL: </span>
                            <span className="font-mono font-bold text-amber-800">
                              ilovesurprises.com/{username || 'yourname'}
                            </span>
                            <span className="block text-[10px] text-amber-700 mt-0.5">
                              This custom storefront URL will be created and activated immediately once your application is approved by the Administrator.
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Order Summary & Proceed Button */}
              <div className="lg:col-span-5 xl:col-span-5 flex flex-col justify-between h-full space-y-4">
                <div className="rounded-2xl bg-[#faf9fa] border border-stone-200 p-5 sm:p-6 shadow-sm flex flex-col justify-between flex-1 space-y-4">
                  
                  {/* Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                    <h4 className="text-xs font-black uppercase tracking-wider text-stone-800 m-0 flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-[#D30915]" />
                      Order & Enrollment Summary
                    </h4>
                    <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Active Instant Setup
                    </span>
                  </div>

                  {/* Line Items */}
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-stone-900 block">
                          {currentPlan.name}
                        </span>
                        <span className="text-[11px] text-stone-500">
                          {currentPlan.billingFrequency}
                        </span>
                      </div>
                      <span className="font-black text-stone-900 text-sm">
                        ${currentPlan.price.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-stone-900 block">
                          {currentKit.name}
                        </span>
                        <span className="text-[11px] text-stone-500">
                          Physical Starter Kit (${currentKit.retailValue.toFixed(2)} value)
                        </span>
                      </div>
                      <span className="font-black text-stone-900 text-sm">
                        ${currentKit.price.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-stone-600">
                      <div>
                        <span className="text-[11.5px] block">Replicated Custom Storefront</span>
                        <span className="text-[10px] text-stone-400">$120/yr Retail Value</span>
                      </div>
                      <span className="font-bold text-emerald-700 uppercase text-[10.5px] bg-emerald-50 px-2 py-0.5 rounded">
                        Included Free
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-stone-600">
                      <div>
                        <span className="text-[11.5px] block">Starter Kit Delivery & Handling</span>
                        <span className="text-[10px] text-stone-400">Tracked Priority Courier</span>
                      </div>
                      <span className="font-bold text-emerald-700 uppercase text-[10.5px] bg-emerald-50 px-2 py-0.5 rounded">
                        Free Express
                      </span>
                    </div>

                    <div className="pt-3 border-t border-stone-200 space-y-1">
                      <div className="flex justify-between items-baseline text-[11px] text-stone-500">
                        <span>Total Package Value:</span>
                        <span className="line-through">${estimatedPackageValue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm font-black text-stone-900">
                          Total Due Today:
                        </span>
                        <span className="text-2xl font-black text-[#D30915]">
                          ${grandTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 5-Level Commission Structure Recap Box */}
                  <div className="p-3.5 rounded-xl bg-white border border-rose-100 shadow-xs space-y-2">
                    <div className="flex items-center justify-between text-xs font-black text-stone-900">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-[#D30915]" />
                        <span>5-Level Commission Structure:</span>
                      </div>
                      <span className="text-[10px] font-bold text-[#D30915] bg-rose-50 px-2 py-0.5 rounded-md">
                        Up to 35% Total
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-stone-600">
                      <span className="bg-rose-50 text-[#D30915] px-2 py-0.5 rounded-md border border-rose-200">
                        Personal: 20%
                      </span>
                      <span className="text-stone-300">•</span>
                      <span className="bg-stone-50 px-1.5 py-0.5 rounded border border-stone-200 text-purple-800">
                        L1: 5%
                      </span>
                      <span className="text-stone-300">•</span>
                      <span className="bg-stone-50 px-1.5 py-0.5 rounded border border-stone-200 text-purple-800">
                        L2: 4%
                      </span>
                      <span className="text-stone-300">•</span>
                      <span className="bg-stone-50 px-1.5 py-0.5 rounded border border-stone-200 text-purple-800">
                        L3: 3%
                      </span>
                      <span className="text-stone-300">•</span>
                      <span className="bg-stone-50 px-1.5 py-0.5 rounded border border-stone-200 text-purple-800">
                        L4: 2%
                      </span>
                      <span className="text-stone-300">•</span>
                      <span className="bg-stone-50 px-1.5 py-0.5 rounded border border-stone-200 text-purple-800">
                        L5: 1%
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-500 m-0">
                      Earn 20% immediate retail commission + up to 15% override across 5 levels of your team.
                    </p>
                  </div>

                  {/* Included Turnkey Consultant Tools */}
                  <div className="p-3.5 rounded-xl bg-white border border-stone-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-black text-stone-900">
                        <Award className="w-3.5 h-3.5 text-[#D30915]" />
                        <span>Included With Your Consultant License:</span>
                      </div>
                      <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        Turnkey
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10.5px] text-stone-700">
                      <div className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span><strong>Personal URL Shop:</strong> Live in 60 seconds</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span><strong>Monthly Payouts:</strong> Direct on the 15th</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span><strong>Team Backoffice:</strong> Real-time CRM & analytics</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span><strong>Marketing Assets:</strong> Viral reveal video clips</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Consultant FAQs */}
                  <div className="p-3.5 rounded-xl bg-white border border-stone-200 text-[10.5px] space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-stone-900 text-xs">
                      <HelpCircle className="w-3.5 h-3.5 text-[#D30915]" />
                      <span>Quick Consultant FAQs</span>
                    </div>
                    <div className="space-y-1.5 text-stone-600 leading-snug">
                      <div>
                        <strong className="text-stone-800">Do I need to store inventory at home?</strong>
                        <p className="m-0 text-[10px] text-stone-500">No. We fulfill, package, and ship all surprise reveals directly to your customers.</p>
                      </div>
                      <div>
                        <strong className="text-stone-800">How does the 20% commission work?</strong>
                        <p className="m-0 text-[10px] text-stone-500">Every customer shopping through your link automatically credits 20% to your account.</p>
                      </div>
                    </div>
                  </div>

                  {/* Checkout Security & Primary Action Button */}
                  <div className="space-y-3 pt-2">
                    {/* No stored card is displayed: none is collected, and
                        claiming a card on file would be untrue. */}
                    <div className="p-2.5 rounded-xl bg-white border border-stone-200 flex items-center gap-2 text-xs text-stone-600">
                      <CreditCard className="w-4 h-4 text-stone-400" />
                      <span className="font-medium text-[11.5px]">
                        No payment method on file
                      </span>
                    </div>

                    {/* Primary Button */}
                    <button
                      type="submit"
                      disabled={!!usernameError}
                      className="w-full h-12 rounded-xl bg-gradient-to-r from-[#D30915] to-[#B60711] hover:from-[#B60711] hover:to-[#96060e] text-white font-black text-sm uppercase tracking-wider shadow-[0_8px_20px_rgba(211,9,21,0.25)] hover:shadow-[0_12px_28px_rgba(211,9,21,0.35)] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Continue to Application Review (${grandTotal.toFixed(2)})</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <div className="space-y-1 text-center">
                      <p className="text-[10.5px] text-stone-400 leading-relaxed m-0">
                        By enrolling, you agree to the Consultant Independent Representative Agreement and recurring renewal of ${currentPlan.monthlyEquivalent.toFixed(2)}/mo. You may cancel at any time via your dashboard.
                      </p>
                      <div className="flex items-center justify-center gap-3 pt-1 text-[10px] text-stone-400">
                        <span className="flex items-center gap-1">
                          <Gift className="w-3 h-3 text-[#D30915]" /> Instant Setup
                        </span>
                        <span>•</span>
                        <span>30-Day Satisfaction</span>
                        <span>•</span>
                        <span>Zero Commitments</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </form>
        )}

        {/* STEP 2: DEDICATED SUBSCRIPTION PAYMENT PAGE */}
        {step === 'payment' && (
          <form onSubmit={handleCompleteSubscriptionPayment} className="overflow-y-auto flex-1">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 p-5 sm:p-7 lg:p-8 items-start">
              
              {/* LEFT COLUMN: Payment Methods & Details */}
              <div className="md:col-span-7 space-y-6">
                
                {/* Back Button */}
                <button
                  type="button"
                  onClick={() => setStep('configure')}
                  className="inline-flex items-center gap-2 text-xs font-bold text-stone-600 hover:text-[#D30915] transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Plan & Kit Options</span>
                </button>

                {/* 1. Payment Method Selector Tabs */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-stone-100">
                    <h3 className="text-sm font-black text-stone-900 tracking-tight m-0 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[#D30915]" />
                      <span>Select Payment Method</span>
                    </h3>
                    <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      256-Bit SSL Encrypted
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={`p-3 rounded-xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                        paymentMethod === 'card'
                          ? 'border-[#D30915] bg-[#fffafb] shadow-xs'
                          : 'border-stone-200 hover:border-stone-300 bg-white'
                      }`}
                    >
                      <CreditCard className={`w-5 h-5 ${paymentMethod === 'card' ? 'text-[#D30915]' : 'text-stone-500'}`} />
                      <span className="text-xs font-bold text-stone-900">Credit Card</span>
                      <span className="text-[9.5px] text-stone-400">Visa, MC, Amex</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('apple_pay')}
                      className={`p-3 rounded-xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                        paymentMethod === 'apple_pay'
                          ? 'border-[#D30915] bg-[#fffafb] shadow-xs'
                          : 'border-stone-200 hover:border-stone-300 bg-white'
                      }`}
                    >
                      <Zap className={`w-5 h-5 ${paymentMethod === 'apple_pay' ? 'text-[#D30915]' : 'text-stone-500'}`} />
                      <span className="text-xs font-bold text-stone-900">Apple / GPay</span>
                      <span className="text-[9.5px] text-stone-400">1-Tap Fast Pay</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('paypal')}
                      className={`p-3 rounded-xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                        paymentMethod === 'paypal'
                          ? 'border-[#D30915] bg-[#fffafb] shadow-xs'
                          : 'border-stone-200 hover:border-stone-300 bg-white'
                      }`}
                    >
                      <DollarSign className={`w-5 h-5 ${paymentMethod === 'paypal' ? 'text-[#D30915]' : 'text-stone-500'}`} />
                      <span className="text-xs font-bold text-stone-900">PayPal</span>
                      <span className="text-[9.5px] text-stone-400">Pay in 4 available</span>
                    </button>
                  </div>
                </div>

                {/* 2. Interactive Card Form Fields */}
                <div className="p-4 sm:p-5 rounded-2xl bg-stone-50/80 border border-stone-200 space-y-3.5">
                  <div>
                    <label className="text-xs font-bold text-stone-700 block mb-1">
                      Cardholder Name
                    </label>
                    <input
                      type="text"
                      required
                      value={cardholderName}
                      onChange={(e) => setCardholderName(e.target.value)}
                      placeholder="Your name"
                      className="w-full h-10 px-3.5 rounded-xl bg-white border border-stone-300 text-xs sm:text-sm text-stone-900 font-medium focus:outline-none focus:border-[#D30915] focus:ring-2 focus:ring-[#D30915]/15"
                    />
                  </div>

                  {/*
                    Card fields removed: there is no payment integration to
                    submit them to, and the raw PAN/CVC must never enter
                    application state. When a provider is configured its hosted
                    element mounts here.
                  */}
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 flex items-start gap-2.5">
                    <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900 leading-relaxed">
                      <div className="font-bold text-amber-950 mb-0.5">
                        No membership fee is charged right now
                      </div>
                      <div>
                        Online payments are not enabled on the server yet, so no
                        card is collected and nothing is billed. Your
                        representative account and storefront are still created,
                        and you can start sharing your referral link
                        immediately.
                      </div>
                    </div>
                  </div>
                </div>

                {enrollmentError && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-red-50 border border-red-300 text-xs text-red-900 leading-relaxed"
                  >
                    <span className="font-bold text-red-950">
                      Enrollment failed:{' '}
                    </span>
                    {enrollmentError}
                  </div>
                )}

                {/* 3. Physical Starter Kit Delivery Address */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-stone-100">
                    <h3 className="text-sm font-black text-stone-900 tracking-tight m-0 flex items-center gap-2">
                      <Truck className="w-4 h-4 text-[#D30915]" />
                      <span>Starter Kit Delivery Address (Ships in 24 Hours)</span>
                    </h3>
                    <span className="text-[11px] font-bold text-emerald-700">
                      Free Insured Shipping
                    </span>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl bg-stone-50/80 border border-stone-200 space-y-3">
                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        Street Address *
                      </label>
                      <input
                        type="text"
                        required
                        value={streetAddress}
                        onChange={(e) => setStreetAddress(e.target.value)}
                        placeholder="123 Main St, Apt or Suite"
                        className="w-full h-10 px-3.5 rounded-xl bg-white border border-stone-300 text-xs sm:text-sm text-stone-900 font-medium focus:outline-none focus:border-[#D30915] focus:ring-2 focus:ring-[#D30915]/15"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-bold text-stone-700 block mb-1">
                          City *
                        </label>
                        <input
                          type="text"
                          required
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="Springfield"
                          className="w-full h-10 px-3.5 rounded-xl bg-white border border-stone-300 text-xs sm:text-sm text-stone-900 font-medium focus:outline-none focus:border-[#D30915]"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-stone-700 block mb-1">
                          State *
                        </label>
                        <input
                          type="text"
                          required
                          value={stateCode}
                          onChange={(e) => setStateCode(e.target.value)}
                          placeholder="OR"
                          className="w-full h-10 px-3.5 rounded-xl bg-white border border-stone-300 text-xs sm:text-sm text-stone-900 font-medium focus:outline-none focus:border-[#D30915]"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-stone-700 block mb-1">
                          ZIP Code *
                        </label>
                        <input
                          type="text"
                          required
                          value={zipCode}
                          onChange={(e) => setZipCode(e.target.value)}
                          placeholder="97477"
                          className="w-full h-10 px-3.5 rounded-xl bg-white border border-stone-300 text-xs sm:text-sm text-stone-900 font-medium focus:outline-none focus:border-[#D30915]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: Order Summary & Authorize Payment */}
              <div className="md:col-span-5 space-y-4">
                <div className="rounded-2xl bg-[#faf9fa] border border-stone-200 p-5 sm:p-6 shadow-sm space-y-4">
                  
                  <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                    <h4 className="text-xs font-black uppercase tracking-wider text-stone-800 m-0">
                      Payment Summary
                    </h4>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Verified Secure
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs text-stone-700">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-stone-900 block">{currentPlan.name}</span>
                        <span className="text-[11px] text-stone-500">{currentPlan.billingFrequency}</span>
                      </div>
                      <span className="font-bold text-stone-900">${currentPlan.price.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-stone-900 block">{currentKit.name}</span>
                        <span className="text-[11px] text-stone-500">Physical Starter Kit</span>
                      </div>
                      <span className="font-bold text-stone-900">${currentKit.price.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center text-stone-600">
                      <span>Storefront URL (ilovesurprises.com/{username})</span>
                      <span className="font-bold text-emerald-700 uppercase text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded">FREE</span>
                    </div>

                    <div className="flex justify-between items-center text-stone-600">
                      <span>Starter Kit Tracked Courier</span>
                      <span className="font-bold text-emerald-700 uppercase text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded">FREE</span>
                    </div>

                    <div className="pt-3 border-t border-stone-200 flex justify-between items-baseline">
                      <span className="text-sm font-black text-stone-900">Total Charged Today:</span>
                      <span className="text-2xl font-black text-[#D30915]">
                        ${grandTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Trust Badges */}
                  <div className="p-3 rounded-xl bg-white border border-stone-200 space-y-1.5 text-[11px] text-stone-600">
                    <div className="flex items-center gap-1.5 font-bold text-stone-900">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Bank-Grade Encryption</span>
                    </div>
                    <p className="text-[10px] text-stone-500 m-0">
                      Payments processed via Stripe Certified Level 1 PCI Service Provider.
                    </p>
                  </div>

                  {/* Primary Pay / Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-[#D30915] to-[#B60711] hover:from-[#B60711] hover:to-[#96060e] text-white font-black text-sm uppercase tracking-wider shadow-[0_8px_20px_rgba(211,9,21,0.25)] hover:shadow-[0_12px_28px_rgba(211,9,21,0.35)] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Submitting Application...
                      </span>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Submit Application for Admin Approval</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <p className="text-center text-[10px] text-stone-400 leading-relaxed m-0">
                    By submitting, your representative application will be sent to the Administrator for approval. Storefront URL and representative dashboard access will activate upon approval.
                  </p>
                </div>
              </div>

            </div>
          </form>
        )}

        {/* STEP 3: APPLICATION SUBMITTED - PENDING ADMIN APPROVAL */}
        {step === 'success' && (
          <div className="relative p-6 sm:p-7 flex flex-col items-center text-center overflow-y-auto max-h-[88vh] space-y-4 max-w-xl mx-auto w-full">
            {/* Close Button on Success Screen */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-800 flex items-center justify-center transition-all cursor-pointer z-10 shadow-xs"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
            
            {/* Elegant Amber Pending Status Badge & Icon */}
            <div className="relative flex items-center justify-center -mt-2 sm:-mt-3.5 mb-1">
              <style>{`
                @keyframes ilsPendingPulse {
                  0% { transform: scale(0.9); opacity: 0.6; }
                  70% { transform: scale(1.4); opacity: 0; }
                  100% { transform: scale(1.5); opacity: 0; }
                }
              `}</style>
              
              {/* Expanding Ripple Rings */}
              <div
                className="absolute w-22 h-22 sm:w-26 sm:h-26 rounded-full bg-amber-400/30"
                style={{ animation: 'ilsPendingPulse 2.4s ease-out infinite' }}
              />
              <div className="absolute w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-amber-500/20 blur-md animate-pulse" />

              {/* Main Glowing Clock Circle */}
              <div className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 text-white flex items-center justify-center shadow-[0_10px_32px_rgba(245,158,11,0.48)] border-4 border-white ring-4 ring-amber-100">
                <Clock className="w-9 h-9 sm:w-10 sm:h-10 text-white drop-shadow stroke-[2.5]" />
              </div>
            </div>

            {/* Pending Approval Badge & Heading */}
            <div className="space-y-2 max-w-lg">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-black uppercase tracking-wider shadow-xs">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Application Submitted • Pending Admin Approval</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight m-0 leading-tight">
                Request Sent to{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-[#D30915] to-[#B60711]">
                  Administrator!
                </span>
              </h2>

              <div className="space-y-1">
                <p className="text-sm sm:text-base font-bold text-stone-800 m-0">
                  Thank you, {fullName || 'Applicant'}!
                </p>
                <p className="text-xs sm:text-[13px] text-stone-600 leading-snug m-0 max-w-md mx-auto">
                  Your representative application has been submitted to the Admin team. Once approved, your custom storefront URL will be created and activated, and you can sign in to your dashboard.
                </p>
              </div>
            </div>

            {/* Consultant Account & Credential Information Card */}
            <div className="w-full p-4 rounded-2xl bg-gradient-to-br from-stone-50 via-[#fffbf6] to-amber-50/50 border border-amber-200/80 shadow-xs space-y-3 text-left">
              <div className="flex items-center justify-between pb-2 border-b border-amber-200/60">
                <span className="text-[11px] font-black text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                  Your Representative Login Credentials:
                </span>
                <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-100/80 px-2.5 py-0.5 rounded-full border border-amber-300">
                  Save Details
                </span>
              </div>

              {/* Login Email ID & Password Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-white border border-stone-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-stone-400 block uppercase">Login Email ID</span>
                  <span className="font-bold text-stone-900 truncate block mt-0.5 select-all">{email}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-stone-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-stone-400 block uppercase">Login Password</span>
                  <span className="font-bold text-stone-900 truncate block mt-0.5">
                    {password ? '•••••••• (Created during enrollment)' : '•••••••• (Account Password)'}
                  </span>
                </div>
              </div>

              {/* Storefront URL Card */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-bold text-stone-600 flex items-center gap-1">
                    <Store className="w-3 h-3 text-[#D30915]" />
                    Requested Storefront URL:
                  </span>
                  <span className="text-[9.5px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Pending Activation
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-stone-300 gap-2 shadow-2xs">
                  <span className="text-xs sm:text-sm font-mono font-bold text-amber-800 truncate select-all">
                    https://ilovesurprises.com/{username.toLowerCase().trim()}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyStoreUrl}
                    className={`px-3 py-1 rounded-lg text-xs font-black tracking-wide uppercase transition-all cursor-pointer shrink-0 flex items-center gap-1 shadow-2xs ${
                      isCopied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-stone-800 hover:bg-stone-900 text-white'
                    }`}
                  >
                    {isCopied ? <Check className="w-3 h-3 text-white stroke-[3]" /> : <Copy className="w-3 h-3 text-white" />}
                    <span>{isCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-100/60 border border-amber-200 text-[10.5px] sm:text-[11px] text-amber-900 leading-snug">
                <strong>Next Step:</strong> The Administrator will review your application in the Admin portal. Once approved, your storefront link goes live and you will be able to log in with your Email ID and Password to earn 20% on every order!
              </div>
            </div>

            {/* Quick Next Steps Grid */}
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100/90 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-800 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    Admin Review
                  </span>
                  <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                    Pending
                  </span>
                </div>
                <p className="text-[10.5px] sm:text-[11px] text-stone-600 m-0 leading-snug">
                  Your request is queued for Administrator review. Approvals are typically processed swiftly.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-stone-800 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-[#D30915]" />
                    Starter Kit Dispatch
                  </span>
                  <span className="text-[9px] font-black uppercase bg-stone-200 text-stone-700 px-1.5 py-0.5 rounded">
                    Queued
                  </span>
                </div>
                <p className="text-[10.5px] sm:text-[11px] text-stone-600 m-0 leading-snug">
                  Your <strong className="text-stone-800 font-bold">{currentKit.name}</strong> will be prepared for delivery to {city || 'your address'}, {stateCode || ''}.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full pt-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSuccess?.();
                }}
                className="w-full sm:flex-1 h-12 rounded-xl bg-gradient-to-r from-[#D30915] via-[#B60711] to-[#96060e] hover:brightness-110 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-[0_8px_20px_rgba(211,9,21,0.28)] hover:shadow-[0_12px_28px_rgba(211,9,21,0.38)] transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                <span>Return to Store</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-7 h-12 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-extrabold text-xs sm:text-sm transition-colors cursor-pointer active:scale-98"
              >
                Close
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

