import { Decimal } from 'decimal.js';

export interface PayoutChainItem {
  level: number;
  affiliateId: string;
  rate: Decimal;
  qualifyingRetailSales?: number;
}

export interface CommissionCalculationResult {
  status:
    | 'success'
    | 'no_affiliate_attributed'
    | 'already_processed'
    | 'order_not_eligible'
    | 'zero_commissionable_base'
    | 'self_referral_blocked_completely'
    | 'personal_purchase_no_commission';
  orderId?: string;
  commissionableBaseUsd?: number;
  totalRate?: number;
  payoutsCount?: number;
  payouts?: Array<{
    level: number;
    beneficiaryId: string;
    rate: number;
    amountUsd: number;
  }>;
}

export interface RefundCommissionResult {
  status: 'success' | 'order_not_found' | 'no_commissions_found';
  orderId: string;
  reversalCount: number;
  totalReversalUsd: number;
}
