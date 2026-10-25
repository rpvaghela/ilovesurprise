import { Request, Response, NextFunction } from 'express';
import * as affiliateService from '../services/affiliate.service';
import { getReferralAttributionDays, ensureInitialized } from '../services/settings.service';
import { signToken } from '../utils/jwt';

export const resolveAffiliate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawUsername = String(req.params.username);
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const landingPage = (req.query.landingPage as string) || `/${rawUsername}`;
    const referrerUrl = req.headers['referer'] || (req.query.ref as string);

    const affiliate = await affiliateService.resolveAffiliateByUsername(rawUsername, {
      ipAddress,
      userAgent,
      landingPage,
      referrerUrl,
    });

    if (!affiliate) {
      res.status(404).json({
        status: 'error',
        message: `Affiliate with username or referral code "${rawUsername}" not found`,
      });
      return;
    }

    // Set signed/secure HTTP-only tracking cookie using configured referral attribution duration
    const isProduction = process.env.NODE_ENV === 'production';
    await ensureInitialized();
    const attributionDays = getReferralAttributionDays();
    const referralToken = signToken({ id: affiliate.id, purpose: 'referral' }, { expiresIn: `${attributionDays}d` });
    res.cookie('ils_affiliate_id', referralToken, {
      maxAge: attributionDays * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
    });

    res.status(200).json({
      status: 'success',
      data: {
        affiliate: {
          id: affiliate.id,
          username: affiliate.username,
          referralCode: affiliate.referralCode,
          status: affiliate.status,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const registerAffiliate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const affiliate = await affiliateService.registerAffiliate({
      ...req.body,
      userId,
    });

    res.status(201).json({
      status: 'success',
      message: 'Affiliate profile created successfully',
      data: { affiliate },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const dashboard = await affiliateService.getAffiliateDashboard(userId);

    res.status(200).json({
      status: 'success',
      data: dashboard,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyLedger = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const dashboard = await affiliateService.getAffiliateDashboard(userId);
    const ledger = await affiliateService.getAffiliateLedger(
      dashboard.profile.id,
      req.query as any
    );

    res.status(200).json({
      status: 'success',
      data: ledger,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyGenealogy = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const dashboard = await affiliateService.getAffiliateDashboard(userId);
    const tree = await affiliateService.getGenealogyDownlines(dashboard.profile.id, 5);

    res.status(200).json({
      status: 'success',
      data: { genealogy: tree },
    });
  } catch (error) {
    next(error);
  }
};

export const uploadAvatar = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    let avatarUrl = '';
    if (req.file) {
      avatarUrl = `/uploads/${req.file.filename}`;
    } else if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      avatarUrl = `/uploads/${(req.files[0] as any).filename}`;
    } else if (req.body.avatar) {
      avatarUrl = req.body.avatar;
    } else {
      res.status(400).json({ status: 'error', message: 'No image provided' });
      return;
    }

    const savedUrl = await affiliateService.updateAffiliateAvatar(userId, avatarUrl);
    res.status(200).json({
      status: 'success',
      message: 'Avatar updated successfully',
      data: { avatarUrl: savedUrl },
      avatarUrl: savedUrl,
    });
  } catch (error) {
    next(error);
  }
};

export const affiliateController = {
  resolveAffiliate,
  registerAffiliate,
  getMe,
  getMyLedger,
  getMyGenealogy,
  uploadAvatar,
};
