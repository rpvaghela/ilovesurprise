import { prisma } from '../lib/prisma';
import { formatDbProduct } from './product.service';

// Curated collections baseline to guarantee exact count and storefront consistency
export const CURATED_COLLECTIONS = [
  {
    id: 'cat-candles',
    dbId: '328912175293',
    name: 'Candles',
    slug: 'candles',
    tagline: '#1 Candle store for premium soy & essential oil candles',
    description: 'Explore our complete handcrafted soy and essential oil candle collections with hidden cash and fine jewelry reveals.',
    productCount: 28878,
    image: '/assets/ilovesurprises/categories/1_Mockup_Jewelry_JewelryCandles_93d459aa-d530-474d-ba4c-32fb9af4f94c.jpg',
    featured: true,
    sortOrder: 1,
  },
  {
    id: 'cat-scented-candles',
    dbId: '329211412669',
    name: 'Scented Candles',
    slug: 'scented-candles',
    tagline: 'Artisan aromatic clean-burn candles',
    description: 'Long-lasting clean burn scented candles with surprise reveals inside.',
    productCount: 37228,
    image: '/assets/ilovesurprises/categories/cash_candles.jpg',
    featured: true,
    sortOrder: 2,
  },
  {
    id: 'cat-jewelry',
    dbId: '328914501821',
    name: 'Jewelry',
    slug: 'jewelry',
    tagline: 'Certified fine jewelry reveals',
    description: 'Solid 925 sterling silver, 14k gold, and genuine gemstones valued up to $7,500.',
    productCount: 18476,
    image: '/assets/ilovesurprises/hero/hero-lifestyle-reveal.jpg',
    featured: true,
    sortOrder: 3,
  },
  {
    id: 'cat-jewelry-candles',
    dbId: '243230834877',
    name: 'Jewelry Candles',
    slug: 'jewelry-candles',
    tagline: 'Luxury jewelry in every candle',
    description: 'Hand-poured aromatic soy candles with a real ring, necklace, or earrings valued up to $7,500 inside.',
    productCount: 100,
    image: '/assets/ilovesurprises/categories/1_Mockup_Jewelry_JewelryCandles_93d459aa-d530-474d-ba4c-32fb9af4f94c.jpg',
    featured: true,
    sortOrder: 4,
  },
  {
    id: 'cat-cash-candles',
    dbId: '153155665966',
    name: 'Cash Candles',
    slug: 'cash-candles',
    tagline: 'Find real cash ($2–$2,500) inside',
    description: 'The original cash candle experience with real surprise cash bills hidden inside every single jar.',
    productCount: 495,
    image: '/assets/ilovesurprises/categories/cash_candles.jpg',
    featured: true,
    sortOrder: 2,
  },
  {
    id: 'cat-cash-money-candles',
    dbId: '243231195325',
    name: 'Cash Money Candles',
    slug: 'cash-money-candles',
    tagline: 'Authentic cash money reveals',
    description: 'Find real cash money prizes inside premium scented candles with guaranteed reveals.',
    productCount: 76,
    image: '/assets/ilovesurprises/categories/cash_money_candles.jpg',
    featured: true,
    sortOrder: 3,
  },
  {
    id: 'cat-wax-melts',
    dbId: '328914239677',
    name: 'Wax Melts',
    slug: 'wax-melts',
    tagline: 'Scented melts you’ll love',
    description: 'Artisan hand-crafted scented wax melts shaped like cute figurines with hidden surprise treasures.',
    productCount: 8376,
    image: '/assets/ilovesurprises/categories/Cat-2_Figurines_JWL_wax_melts.jpg',
    featured: true,
    sortOrder: 4,
  },
  {
    id: 'cat-bath-body',
    dbId: '328913158333',
    name: 'Bath & Body',
    slug: 'bath-bombs',
    tagline: 'Pamper yourself every day',
    description: 'Soothing bath bombs, comforting hugs and plush bath rituals with pampering surprise reveals.',
    productCount: 9068,
    image: '/assets/ilovesurprises/categories/Heartfelt-Hugs.jpg',
    featured: true,
    sortOrder: 5,
  },
  {
    id: 'cat-soaps',
    dbId: '328912961725',
    name: 'Soaps',
    slug: 'soap',
    tagline: 'Handmade & skin loving',
    description: 'Ultra-nourishing organic goat milk soaps crafted with essential oils and gentle botanical extracts.',
    productCount: 18,
    image: '/assets/ilovesurprises/categories/goats_milk_soaps.jpg',
    featured: true,
    sortOrder: 6,
  },
  {
    id: 'cat-slimes',
    dbId: '328914043069',
    name: 'Slimes',
    slug: 'slimes',
    tagline: 'Fun, colorful & surprising',
    description: 'Sweet scented gourmet surprise slimes and birthday celebration reveal treats for all ages.',
    productCount: 1652,
    image: '/assets/ilovesurprises/categories/BDayCake.webp',
    featured: true,
    sortOrder: 7,
  },
  {
    id: 'cat-candy',
    dbId: '329665446077',
    name: 'Cash Candy',
    slug: 'candy',
    tagline: 'Sweet surprise cash candy',
    description: 'Artisan sweet treats and candies concealing real surprise cash bills.',
    productCount: 300,
    image: '/assets/ilovesurprises/categories/cash_candy.jpg',
    featured: true,
    sortOrder: 8,
  },
  {
    id: 'cat-chocolates',
    dbId: '162829631534',
    name: 'Chocolates',
    slug: 'chocolates',
    tagline: 'Decadent chocolate reveals',
    description: 'Rich gourmet Belgian chocolate tubes with hidden surprise treasures.',
    productCount: 28,
    image: '/assets/ilovesurprises/categories/chocolates.jpg',
    featured: true,
    sortOrder: 9,
  },
  {
    id: 'cat-greeting-cards',
    dbId: '328913682621',
    name: 'Greeting Cards',
    slug: 'greeting-cards',
    tagline: 'Cards with real reveals',
    description: 'Hilarious and heartfelt surprise greeting cards with real cash or jewelry inside.',
    productCount: 688,
    image: '/assets/ilovesurprises/categories/Coke_CSH_Sodapop-CND_JC.jpg',
    featured: true,
    sortOrder: 10,
  },
];

const collectionProductsCache = new Map<string, { data: any[]; expiresAt: number }>();

export class CollectionService {
  /**
   * Returns list of admin collections with product counts.
   */
  async listAdminCollections() {
    // 1. Get database collection counts for curated items
    const dbCollections = await prisma.collections.findMany({
      where: {
        OR: [
          { slug: { in: CURATED_COLLECTIONS.map((c) => c.slug) } },
          { id: { in: CURATED_COLLECTIONS.map((c) => c.dbId) } },
        ],
      },
      include: {
        _count: {
          select: { product_collections: true },
        },
      },
    });

    const dbMapBySlug = new Map(dbCollections.map((c) => [c.slug.toLowerCase(), c]));
    const dbMapById = new Map(dbCollections.map((c) => [c.id, c]));

    const result = CURATED_COLLECTIONS.map((c, idx) => {
      const dbMatch = dbMapBySlug.get(c.slug.toLowerCase()) || dbMapById.get(c.dbId);
      const dbCount = dbMatch?._count?.product_collections || 0;
      const finalCount = Math.max(c.productCount, dbCount);

      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        productCount: finalCount,
        featured: c.featured,
        orderIndex: idx + 1,
        image: c.image,
        tagline: c.tagline,
        description: c.description,
        dbId: dbMatch?.id || c.dbId,
      };
    });

    return result;
  }

  /**
   * Fetches products assigned to a collection
   */
  async getCollectionProducts(collectionIdOrSlug: string, limit = 50) {
    const cacheKey = `${collectionIdOrSlug.toLowerCase()}_${limit}`;
    const cached = collectionProductsCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    const slug = collectionIdOrSlug.toLowerCase().replace(/^cat-/, '');
    const curated = CURATED_COLLECTIONS.find(
      (c) => c.id === collectionIdOrSlug || c.slug === slug || c.dbId === collectionIdOrSlug
    );

    const searchSlug = curated?.slug || slug;
    const dbId = curated?.dbId || collectionIdOrSlug;

    try {
      const dbProducts = await prisma.products.findMany({
        where: {
          OR: [
            {
              product_collections: {
                some: {
                  OR: [
                    { collectionId: dbId },
                    { collections: { slug: { equals: searchSlug, mode: 'insensitive' } } },
                    { collections: { name: { contains: curated?.name || searchSlug, mode: 'insensitive' } } },
                  ],
                },
              },
            },
            { categoryId: collectionIdOrSlug },
            { categories: { slug: { equals: searchSlug, mode: 'insensitive' } } },
            { badge: { contains: curated?.name || searchSlug, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          categories: true,
          product_images: { orderBy: { sortOrder: 'asc' } },
          product_variants: true,
          product_options: {
            include: {
              product_option_values: { orderBy: { sortOrder: 'asc' } },
            },
          },
          product_collections: {
            include: {
              collections: {
                select: { id: true, name: true, slug: true },
              },
            },
            take: 5,
          },
        },
      });

      const formatted = dbProducts.map(formatDbProduct);
      collectionProductsCache.set(cacheKey, { data: formatted, expiresAt: Date.now() + 15 * 60 * 1000 });
      return formatted;
    } catch (err: any) {
      console.warn('DB getCollectionProducts failed, returning cached or empty:', err?.message);
      return [];
    }
  }

  /**
   * Assigns a product to a collection
   */
  async assignProduct(collectionIdOrSlug: string, productId: string) {
    const curated = CURATED_COLLECTIONS.find(
      (c) => c.id === collectionIdOrSlug || c.slug === collectionIdOrSlug || c.dbId === collectionIdOrSlug
    );
    let targetColId = curated?.dbId;

    if (!targetColId) {
      const found = await prisma.collections.findFirst({
        where: {
          OR: [{ id: collectionIdOrSlug }, { slug: collectionIdOrSlug }],
        },
      });
      targetColId = found?.id;
    }

    if (!targetColId) {
      throw new Error(`Collection "${collectionIdOrSlug}" not found in database.`);
    }

    await prisma.product_collections.upsert({
      where: {
        productId_collectionId: {
          productId,
          collectionId: targetColId,
        },
      },
      update: {},
      create: {
        productId,
        collectionId: targetColId,
      },
    });

    collectionProductsCache.clear();
    return { success: true, productId, collectionId: targetColId };
  }

  /**
   * Unassigns a product from a collection
   */
  async unassignProduct(collectionIdOrSlug: string, productId: string) {
    const curated = CURATED_COLLECTIONS.find(
      (c) => c.id === collectionIdOrSlug || c.slug === collectionIdOrSlug || c.dbId === collectionIdOrSlug
    );
    const targetColId = curated?.dbId || collectionIdOrSlug;

    await prisma.product_collections.deleteMany({
      where: {
        productId,
        OR: [
          { collectionId: targetColId },
          { collections: { slug: collectionIdOrSlug } },
        ],
      },
    });

    collectionProductsCache.clear();
    return { success: true, productId, collectionId: targetColId };
  }
}

export const collectionService = new CollectionService();
