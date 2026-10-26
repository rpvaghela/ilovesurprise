import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { sortProductsForDisplay } from './productUtils';

const products: Product[] = [
  {
    id: 'older',
    name: 'Older product',
    slug: 'older',
    category: 'Candles',
    price: 44.99,
    surpriseType: 'cash',
    rating: 4.2,
    reviewCount: 12,
    image: '',
    isBestSeller: false,
    inStock: true,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'newer',
    name: 'Newer product',
    slug: 'newer',
    category: 'Candles',
    price: 19.99,
    surpriseType: 'cash',
    rating: 4.8,
    reviewCount: 8,
    image: '',
    isBestSeller: true,
    inStock: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'mid',
    name: 'Mid product',
    slug: 'mid',
    category: 'Candles',
    price: 29.99,
    surpriseType: 'cash',
    rating: 4.5,
    reviewCount: 5,
    image: '',
    isBestSeller: false,
    inStock: true,
    createdAt: '2025-06-01T00:00:00.000Z',
  },
];

describe('sortProductsForDisplay', () => {
  it('sorts the final displayed prices in both directions without mutating the input', () => {
    expect(sortProductsForDisplay(products, 'price-asc').map((product) => product.id)).toEqual([
      'newer',
      'mid',
      'older',
    ]);
    expect(sortProductsForDisplay(products, 'price-desc').map((product) => product.id)).toEqual([
      'older',
      'mid',
      'newer',
    ]);
    expect(products.map((product) => product.id)).toEqual(['older', 'newer', 'mid']);
  });

  it('sorts rating, best sellers, and newest consistently', () => {
    expect(sortProductsForDisplay(products, 'rating').map((product) => product.id)).toEqual([
      'newer',
      'mid',
      'older',
    ]);
    expect(sortProductsForDisplay(products, 'best-sellers').map((product) => product.id)).toEqual([
      'newer',
      'older',
      'mid',
    ]);
    expect(sortProductsForDisplay(products, 'newest').map((product) => product.id)).toEqual([
      'newer',
      'mid',
      'older',
    ]);
  });
});
