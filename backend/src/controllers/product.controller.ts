import { Request, Response, NextFunction } from 'express';
import * as productService from '../services/product.service';

export const listProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await productService.listProducts(req.query as any);
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const identifier = String(req.params.slugOrId || req.params.id);
    const product = await productService.getProductByIdOrSlug(identifier);
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.status(200).json({
      status: 'success',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

export const createReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'Sign in to submit a product review.' });
      return;
    }
    const productId = String(req.params.id);
    const review = await productService.createReview(productId, req.user.id, req.body);
    res.status(201).json({
      status: 'success',
      message: 'Review submitted successfully',
      data: { review },
    });
  } catch (error) {
    next(error);
  }
};

export const getProductReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const reviews = await productService.getProductReviews(String(req.params.id));
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120');
    res.status(200).json({ status: 'success', data: { reviews } });
  } catch (error) {
    next(error);
  }
};

export const getRecentReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const requestedLimit = Number(req.query.limit) || 12;
    const limit = Math.min(24, Math.max(1, requestedLimit));
    const reviews = await productService.getRecentReviews(limit);
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120');
    res.status(200).json({ status: 'success', data: { reviews } });
  } catch (error) {
    next(error);
  }
};

export const getProductsBatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let ids: string[] = [];
    if (req.method === 'POST' && Array.isArray(req.body?.ids)) {
      ids = req.body.ids;
    } else if (req.query.ids) {
      ids = String(req.query.ids).split(',').map((s) => s.trim()).filter(Boolean);
    }

    const products = await productService.getProductsBatch(ids);
    res.setHeader('Cache-Control', 'public, max-age=180, s-maxage=1200, stale-while-revalidate=86400');
    res.status(200).json({
      status: 'success',
      data: { products, count: products.length },
    });
  } catch (error) {
    next(error);
  }
};

// Backward compatibility object export
export const productController = {
  listProducts,
  getProduct,
  getProductsBatch,
  getProductReviews,
  getRecentReviews,
  createReview,
};
