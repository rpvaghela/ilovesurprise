import { afterEach, describe, expect, it, vi } from 'vitest';
import { productService } from './productService';
import { productsData } from '../data/products';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('soap collection', () => {
  it('uses only the approved soap collection for the Soaps category', async () => {
    const collection = await productService.getCollectionByHandle('soap');

    expect(collection).toMatchObject({
      handle: 'money-soaps',
      title: 'Soaps',
      productsCount: 18,
      imageUrl: '/assets/ilovesurprises/categories/goats_milk_soaps.jpg',
    });
  });

  it('shows all available soap catalog products and excludes other categories', async () => {
    const soapProducts = productsData.filter(
      (product) => product.category?.trim().toLowerCase() === 'soaps'
    );
    const getProductsByIds = vi
      .spyOn(productService, 'getProductsByIds')
      .mockImplementation(async (slugs) =>
        slugs
          .map((slug) => soapProducts.find((product) => product.slug === slug))
          .filter((product): product is (typeof soapProducts)[number] => Boolean(product))
      );

    const result = await productService.getProductsByCollection('soap', {
      page: 1,
      limit: 100,
    });

    expect(result.total).toBe(18);
    expect(result.products).toHaveLength(18);
    expect(result.products.every((product) => product.category === 'Soaps')).toBe(true);
    expect(getProductsByIds).toHaveBeenCalledWith(soapProducts.map((product) => product.slug));
  });

  it('provides the local soap collection immediately while the server refreshes', () => {
    const placeholder = productService.getCollectionPlaceholder('soap', {
      page: 1,
      limit: 15,
      sort: 'featured',
    });

    expect(placeholder?.products).toHaveLength(15);
    expect(placeholder?.total).toBe(18);
    expect(placeholder?.products.every((product) => product.category === 'Soaps')).toBe(true);
  });

  it('provides local category products while the product list loads', () => {
    const placeholder = productService.getProductsPlaceholder({
      page: 1,
      limit: 15,
      category: 'Soaps',
    });

    expect(placeholder?.products.length).toBeGreaterThan(0);
    expect(placeholder?.products.every((product) => product.category === 'Soaps')).toBe(true);
  });

  it('does not hydrate the category from a stale broad-search cache entry', () => {
    const staleResult = {
      collection: { handle: 'soap', title: 'Soaps' },
      products: [{ name: 'Cash Bath Bomb' }],
      total: 32379,
      page: 1,
      totalPages: 2159,
    };
    const cacheKey = 'ils_prod_qcache_v7_col_prods_soap_1_15_featured';

    sessionStorage.setItem(
      cacheKey,
      JSON.stringify({ data: staleResult, timestamp: Date.now() })
    );

    expect(
      productService.getCachedCollectionResult('soap', {
        page: 1,
        limit: 15,
        sort: 'featured',
      })
    ).not.toEqual(staleResult);

    sessionStorage.removeItem(cacheKey);
  });
});
