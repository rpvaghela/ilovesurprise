import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './apiClient';
import { productService } from './productService';
import { productsData } from '../data/products';
import type { Product } from '../types';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('collection sorting', () => {
  it('sorts Shop results using the final prices shown to customers', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      status: 'success',
      data: {
        products: [
          {
            id: 'candle',
            name: 'Cash Candle',
            slug: 'cash-candle',
            categoryName: 'Candles',
            price: 10,
          },
          {
            id: 'card',
            name: 'Cash Greeting Card',
            slug: 'cash-greeting-card',
            categoryName: 'Greeting Cards',
            price: 20,
          },
        ],
        pagination: { total: 2, totalPages: 1 },
      },
    });

    const result = await productService.getProducts({
      page: 1,
      limit: 2,
      sort: 'price-asc',
      searchQuery: 'sorting-final-price-regression',
    });

    expect(result.products.map((product) => [product.slug, product.price])).toEqual([
      ['cash-greeting-card', 14.99],
      ['cash-candle', 44.99],
    ]);
  });

  it('sorts a large approved collection before slicing pages', async () => {
    const products: Product[] = [
      { ...productsData[0], id: 'high', slug: 'high', price: 30 },
      { ...productsData[0], id: 'low', slug: 'low', price: 2 },
      { ...productsData[0], id: 'middle', slug: 'middle', price: 10 },
    ];
    const getProductsByIds = vi
      .spyOn(productService, 'getProductsByIds')
      .mockResolvedValue(products);

    const result = await productService.getProductsByCollection('funny-candle', {
      page: 2,
      limit: 2,
      sort: 'price-asc',
    });

    expect(getProductsByIds).toHaveBeenCalledTimes(1);
    expect(getProductsByIds.mock.calls[0][0].length).toBeGreaterThan(200);
    expect(result.products.map((product) => product.id)).toEqual(['high']);
    expect(result.total).toBeGreaterThan(200);
  });
});
