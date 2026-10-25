import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import * as adminService from '../services/admin.service';
import * as productService from '../services/product.service';
import { collectionService } from '../services/collection.service';
import { storefrontController } from './storefront.controller';

// ─── USER MANAGEMENT (ADMIN) ──────────────────────────────────────────────────

export const listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await adminService.listUsers(req.query as any);
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);
    const user = await adminService.getUserById(id);
    res.status(200).json({
      status: 'success',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);
    const user = await adminService.updateUser(id, req.body);
    res.status(200).json({
      status: 'success',
      message: 'User updated successfully',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);
    const user = await adminService.updateUserRole(id, req.body);
    res.status(200).json({
      status: 'success',
      message: 'User role updated successfully',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

export const uploadUserAvatar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);
    let avatarUrl = '';

    if (req.file) {
      avatarUrl = `/uploads/${req.file.filename}`;
    } else if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      avatarUrl = `/uploads/${(req.files[0] as any).filename}`;
    } else if (req.body.avatar) {
      avatarUrl = req.body.avatar;
      if (avatarUrl.startsWith('data:image/')) {
        const { saveBase64Image } = await import('../middlewares/upload.middleware');
        avatarUrl = await saveBase64Image(avatarUrl);
      }
    } else {
      res.status(400).json({ status: 'error', message: 'No image file or avatar data provided' });
      return;
    }

    let targetUserId = id;
    const userExists = await prisma.user.findUnique({ where: { id } });
    if (!userExists) {
      const affiliateProfile = await prisma.affiliate_profiles.findFirst({
        where: { OR: [{ id }, { userId: id }] },
      });
      if (affiliateProfile) {
        targetUserId = affiliateProfile.userId;
      }
    }

    const user = await adminService.updateUser(targetUserId, { avatar: avatarUrl });
    res.status(200).json({
      status: 'success',
      message: 'Avatar updated successfully',
      data: { user, avatarUrl },
      avatarUrl,
    });
  } catch (error) {
    next(error);
  }
};

// ─── STOREFRONT CUSTOMIZATION (ADMIN) ─────────────────────────────────────────

export const getStorefrontConfig = storefrontController.getAdminStorefrontConfig;
export const updateFullStorefrontConfig = storefrontController.updateFullStorefrontConfig;
export const resetStorefrontDefaults = storefrontController.resetStorefrontDefaults;

// Hero & Tiles
export const updateHeroContent = storefrontController.updateHeroContent;
export const createBenefitTile = storefrontController.createBenefitTile;
export const updateBenefitTile = storefrontController.updateBenefitTile;
export const deleteBenefitTile = storefrontController.deleteBenefitTile;

// Showcase Cards / Collections
export const createShowcaseCard = storefrontController.createShowcaseCard;
export const updateShowcaseCard = storefrontController.updateShowcaseCard;
export const deleteShowcaseCard = storefrontController.deleteShowcaseCard;

// Announcements & Banners
export const updateStorefrontBanners = storefrontController.updateStorefrontBanners;

// Value Proposition
export const updateValueProposition = storefrontController.updateValueProposition;

// About Brand Story
export const updateAboutContent = storefrontController.updateAboutContent;

// FAQs
export const createFaq = storefrontController.createFaq;
export const updateFaq = storefrontController.updateFaq;
export const deleteFaq = storefrontController.deleteFaq;

// Footer
export const updateFooterContent = storefrontController.updateFooterContent;

// Upload
export const uploadImage = storefrontController.uploadImage;

//  PRODUCT CATALOG (ADMIN) 

export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const product = await productService.createProduct(req.body);
    res.status(201).json({
      status: 'success',
      message: 'Product created successfully',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = String(req.params.id);
    const product = await productService.updateProduct(id, req.body);
    res.status(200).json({
      status: 'success',
      message: 'Product updated successfully',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = String(req.params.id);
    const result = await productService.deleteProduct(id);
    res.status(200).json({
      status: 'success',
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

// ─── COLLECTIONS MANAGEMENT (ADMIN) ───────────────────────────────────────────

export const listCollections = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const collections = await collectionService.listAdminCollections();
    res.status(200).json({
      status: 'success',
      data: { collections },
    });
  } catch (error) {
    next(error);
  }
};

export const getCollectionProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);
    const limit = Number(req.query.limit) || 50;
    const products = await collectionService.getCollectionProducts(id, limit);
    res.status(200).json({
      status: 'success',
      data: { products },
    });
  } catch (error) {
    next(error);
  }
};

export const assignProductToCollection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { productId } = req.body;
    if (!productId) {
      res.status(400).json({ status: 'fail', message: 'productId is required' });
      return;
    }
    const result = await collectionService.assignProduct(id, productId);
    res.status(200).json({
      status: 'success',
      message: 'Product assigned to collection successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const unassignProductFromCollection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);
    const productId = String(req.params.productId);
    const result = await collectionService.unassignProduct(id, productId);
    res.status(200).json({
      status: 'success',
      message: 'Product unassigned from collection successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const listRepresentatives = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const representatives = await adminService.listRepresentatives();
    res.status(200).json({
      status: 'success',
      data: representatives,
    });
  } catch (error) {
    next(error);
  }
};

export const approveRepresentative = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);
    const result = await adminService.approveRepresentative(id);
    res.status(200).json({
      status: 'success',
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const rejectRepresentative = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);
    const result = await adminService.rejectRepresentative(id);
    res.status(200).json({
      status: 'success',
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteRepresentative = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);
    const result = await adminService.deleteRepresentative(id);
    res.status(200).json({
      status: 'success',
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const addStaffMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;
    const user = await adminService.createStaffUser({ name, email, password, role });
    res.status(201).json({
      status: 'success',
      message: `Staff member credentials successfully created for ${user.email}`,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const updateStaffMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { name, email, password, role, isActive } = req.body;
    const user = await adminService.updateStaffUser(id, { name, email, password, role, isActive });
    res.status(200).json({
      status: 'success',
      message: `Staff member credentials successfully updated for ${user.email}`,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const removeStaffMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);
    const result = await adminService.deleteStaffUser(id);
    res.status(200).json({
      status: 'success',
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

import * as orderController from './order.controller';
import { membershipController } from './membership.controller';
import { appraisalController } from './appraisal.controller';

// Backward compatibility object export
export const adminController = {
  listCollections,
  getCollectionProducts,
  assignProductToCollection,
  unassignProductFromCollection,
  listRepresentatives,
  approveRepresentative,
  rejectRepresentative,
  deleteRepresentative,
  addStaffMember,
  updateStaffMember,
  removeStaffMember,
  listUsers,
  getUserById,
  updateUser,
  updateUserRole,
  uploadUserAvatar,
  getStorefrontConfig,
  updateFullStorefrontConfig,
  resetStorefrontDefaults,
  updateHeroContent,
  createBenefitTile,
  updateBenefitTile,
  deleteBenefitTile,
  createShowcaseCard,
  updateShowcaseCard,
  deleteShowcaseCard,
  updateStorefrontBanners,
  updateValueProposition,
  updateAboutContent,
  createFaq,
  updateFaq,
  deleteFaq,
  updateFooterContent,
  uploadImage,
  createProduct,
  updateProduct,
  deleteProduct,
  listOrders: orderController.listOrders,
  getOrderById: orderController.getOrderById,
  updateOrderStatus: orderController.updateOrderStatus,
  createOrUpdateFulfillment: orderController.createOrUpdateFulfillment,
  addOrderNote: orderController.addOrderNote,
  processOrderRefund: orderController.processOrderRefund,
  // Memberships
  listMemberships: membershipController.listAdminMemberships,
  updateMembershipStatus: membershipController.updateMembershipStatus,
  getMembershipPricing: membershipController.getMembershipPricing,
  updateMembershipPricing: membershipController.updateMembershipPricing,
  listMembershipPlans: membershipController.listMembershipPlans,
  createMembershipPlan: membershipController.createMembershipPlan,
  updateMembershipPlan: membershipController.updateMembershipPlan,
  assignMembership: membershipController.assignMembership,
  deleteMembership: membershipController.deleteMembership,
  // Appraisals
  listAppraisals: appraisalController.listAdminAppraisals,
  getAppraisalStats: appraisalController.getAppraisalStats,
  createAppraisal: appraisalController.createAppraisal,
  getAppraisalById: appraisalController.getAppraisalById,
  updateAppraisal: appraisalController.updateAppraisal,
  deleteAppraisal: appraisalController.deleteAppraisal,
  clearAppraisals: appraisalController.clearAppraisals,
  resetAppraisals: appraisalController.resetAppraisals,
  updateCustomerSubmission: appraisalController.updateCustomerSubmission,
  deleteCustomerSubmission: appraisalController.deleteCustomerSubmission,
};


