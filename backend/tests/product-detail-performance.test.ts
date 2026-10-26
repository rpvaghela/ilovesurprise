import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { loadProductDetail } from '../src/services/product-detail.query';
import { formatDbProduct, getProductByIdOrSlug, invalidateProductCaches, updateProduct, createProduct, deleteProduct } from '../src/services/product.service';

const id = 'detail-performance-product';
const slug = 'detail-performance-candle';

beforeAll(async () => {
  await prisma.products.create({ data: {
    id, slug, name: 'Detail Performance Candle', price: 21.99, compareAtPrice: 29.95,
    stock: 7, status: 'ACTIVE', updatedAt: new Date(), imageUrl: 'https://example.test/main.jpg',
    categories: { create: { id: 'detail-category', slug: 'detail-category', name: 'Candles', updatedAt: new Date() } },
    product_images: { create: [
      { id: 'detail-image-2', url: 'https://example.test/second.jpg', sortOrder: 2 },
      { id: 'detail-image-1', url: 'https://example.test/first.jpg', sortOrder: 1 },
    ] },
    product_variants: { create: { id: 'detail-variant', price: 25.55, stock: 3, scent: 'Rose', updatedAt: new Date() } },
    product_options: { create: { id: 'detail-option', name: 'Scent', product_option_values: { create: [
      { id: 'detail-value-2', value: 'Rose', sortOrder: 2 },
      { id: 'detail-value-1', value: 'Vanilla', sortOrder: 1 },
    ] } } },
    product_collections: { create: { collections: { create: {
      id: 'detail-collection', slug: 'detail-collection', name: 'Collection', updatedAt: new Date(),
    } } } },
  } });
  await prisma.products.create({ data: {
    id: 'detail-empty', slug: 'detail-empty', name: 'No Relations', price: 0, stock: 0, updatedAt: new Date(),
  } });
  for (const suffix of ['z', 'b', 'a', 'd', 'c', 'e']) {
    await prisma.product_collections.create({ data: { products: { connect: { id } }, collections: { create: {
      id: `detail-collection-${suffix}`, slug: `detail-collection-${suffix}`, name: suffix, updatedAt: new Date(),
    } } } });
  }
});
beforeEach(() => invalidateProductCaches());
afterEach(() => vi.restoreAllMocks());

describe('Single-round-trip product details', () => {
  it('preserves the original product response including prices, images, options and collections', async () => {
    const original = await prisma.products.findUniqueOrThrow({ where: { id }, include: {
      categories: true, product_images: { orderBy: { sortOrder: 'asc' } }, product_variants: true,
      product_options: { include: { product_option_values: { orderBy: { sortOrder: 'asc' } } } },
      product_collections: { include: { collections: { select: { id: true, name: true, slug: true } } }, take: 5 },
    } });
    const query = vi.spyOn(prisma, '$queryRaw');
    const actual = await loadProductDetail(slug);
    expect(query).toHaveBeenCalledTimes(1);
    expect(formatDbProduct(actual)).toEqual(formatDbProduct(original));
    expect(actual?.product_collections).toHaveLength(5);
    expect(formatDbProduct(actual).variants?.[0].price).toBe(25.55);
  });

  it('supports IDs, absent relations, zero price/stock and a missing product', async () => {
    expect((await loadProductDetail(id))?.slug).toBe(slug);
    const empty = await loadProductDetail('detail-empty');
    expect(empty?.categories).toBeNull();
    expect(empty?.product_options).toEqual([]);
    expect(empty?.product_collections).toEqual([]);
    expect(formatDbProduct(empty)).toMatchObject({ price: 0, stock: 0, inStock: false });
    expect(await loadProductDetail('missing-detail')).toBeNull();
    await expect(getProductByIdOrSlug('missing-detail')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('treats quote-containing identifiers as values, never executable SQL', async () => {
    expect(await loadProductDetail("' OR 1=1 --")).toBeNull();
    expect(await prisma.products.count()).toBe(2);
  });

  it('deduplicates concurrent cold lookups and caches ID/slug aliases', async () => {
    const query = vi.spyOn(prisma, '$queryRaw');
    const results = await Promise.all(Array.from({ length: 8 }, () => getProductByIdOrSlug(slug)));
    expect(results.every(p => p.id === id)).toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
    await getProductByIdOrSlug(id);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('reloads changed price and stock after invalidation', async () => {
    await getProductByIdOrSlug(slug);
    await updateProduct(id, { price: 18.75, stock: 0 });
    expect(await getProductByIdOrSlug(slug)).toMatchObject({ price: 18.75, stock: 0, inStock: false });
  });

  it('resolves the selected collection to a valid product category', async () => {
    await updateProduct(id, { categorySlug: 'detail-collection' });

    const updated = await prisma.products.findUniqueOrThrow({
      where: { id },
      include: { categories: true },
    });
    expect(updated.categories).toMatchObject({
      name: 'Collection',
      slug: 'detail-collection',
    });
    expect(updated.categoryId).toBe(updated.categories?.id);
  });

  it('invalidates product details after deletion', async () => {
    const created = await createProduct({ name: 'Delete Performance Fixture', slug: 'delete-performance-fixture', price: 12 });
    await getProductByIdOrSlug(created.slug);
    await deleteProduct(created.id);
    await expect(getProductByIdOrSlug(created.slug)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('does not allow an old in-flight lookup to refill an invalidated cache', async () => {
    const snapshot = await loadProductDetail(id);
    let release!: (rows: unknown) => void;
    const delayed = new Promise(resolve => { release = resolve; });
    const query = vi.spyOn(prisma, '$queryRaw').mockImplementationOnce(() => delayed as any);
    const oldRequest = getProductByIdOrSlug(slug);
    invalidateProductCaches();
    await prisma.products.update({ where: { id }, data: { stock: 9 } });
    release([snapshot]);
    await oldRequest;
    expect((await getProductByIdOrSlug(slug)).stock).toBe(9);
    expect(query).toHaveBeenCalledTimes(2);
  });
});
