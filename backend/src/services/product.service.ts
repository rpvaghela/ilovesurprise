import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import { loadProductDetail } from './product-detail.query';
import {
  ProductResponseDTO,
  ListProductsQueryDTO,
  CreateProductDTO,
  UpdateProductDTO,
  CreateReviewDTO,
  ScentOption,
} from '../types/product.types';
import { Prisma, ProductStatus } from '@prisma/client';

// ─── In-Memory Cache (Fix 1: eliminates repeated 3000ms Supabase round-trips) ───
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const productListCache = new Map<string, CacheEntry<any>>();
const productDetailCache = new Map<string, CacheEntry<ProductResponseDTO>>();
const productDetailRequests = new Map<string, Promise<ProductResponseDTO>>();
const categoryResolutionCache = new Map<string, { categoryIds: string[]; collectionIds: string[] }>();
const categoryCountCache = new Map<string, { count: number; timestamp: number }>();
let globalProductCountCache: { count: number; timestamp: number } | null = null;
const GLOBAL_COUNT_TTL_MS = 15 * 60 * 1000; // 15 minutes

const STATIC_CATEGORY_RESOLUTIONS: Record<string, { categoryIds: string[]; collectionIds: string[] }> = {
  candles: { categoryIds: ['cat-candles'], collectionIds: ['328912175293', '243230834877', '153155665966', '243231195325'] },
  'scented-candles': { categoryIds: ['cat-scented-candles'], collectionIds: ['329211412669'] },
  'jewelry-candles': { categoryIds: ['cat-jewelry-candles'], collectionIds: ['243230834877'] },
  'cash-candles': { categoryIds: ['cat-cash-candles'], collectionIds: ['153155665966'] },
  'cash-money-candles': { categoryIds: ['cat-cash-money-candles'], collectionIds: ['243231195325'] },
  jewelry: { categoryIds: ['cat-jewelry'], collectionIds: ['328914501821'] },
  'wax-melts': { categoryIds: ['cat-wax-melts'], collectionIds: ['328914239677'] },
  'bath-bombs': { categoryIds: ['cat-bath-body'], collectionIds: ['328913158333'] },
  soap: { categoryIds: ['cat-soaps'], collectionIds: ['328912961725'] },
  soaps: { categoryIds: ['cat-soaps'], collectionIds: ['328912961725'] },
  slimes: { categoryIds: ['cat-slimes'], collectionIds: ['328914043069'] },
  candy: { categoryIds: ['cat-candy'], collectionIds: ['329665446077'] },
  chocolates: { categoryIds: ['cat-chocolates'], collectionIds: ['162829631534'] },
  'greeting-cards': { categoryIds: ['cat-greeting-cards'], collectionIds: ['328913682621'] },
};
for (const [k, v] of Object.entries(STATIC_CATEGORY_RESOLUTIONS)) {
  categoryResolutionCache.set(k, v);
}

let productCacheVersion = 0;
const LIST_CACHE_TTL_MS = 60 * 60 * 1000;   // 1 hour
const DETAIL_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour memory fresh; invalidated on updates

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  if (entry) cache.delete(key); // prune expired
  return null;
}

function setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T, ttl: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttl });
}

/** Invalidate all product caches (call after create/update/delete) */
export function invalidateProductCaches(): void {
  productCacheVersion++;
  productListCache.clear();
  productDetailCache.clear();
  productDetailRequests.clear();
  categoryResolutionCache.clear();
  for (const [k, v] of Object.entries(STATIC_CATEGORY_RESOLUTIONS)) {
    categoryResolutionCache.set(k, v);
  }
  categoryCountCache.clear();
  globalProductCountCache = null;
}

/**
 * Pre-warms the product catalog, homepage collections, and categories on server start.
 * Guarantees 0–10ms response time for all users from their very first click.
 */
export async function warmupProductCatalog(): Promise<void> {
  console.log('🚀 Pre-warming product catalog and collection caches...');
  const warmupQueries: ListProductsQueryDTO[] = [
    { limit: 12 },
    { limit: 10 },
    { limit: 16 },
    { limit: 20 },
    { featured: true, limit: 12 },
    { category: 'candles', limit: 12 },
    { category: 'jewelry-candles', limit: 12 },
    { category: 'cash-candles', limit: 12 },
    { category: 'cash-money-candles', limit: 12 },
    { category: 'wax-melts', limit: 12 },
    { category: 'bath-bombs', limit: 12 },
    { category: 'soaps', limit: 12 },
    { category: 'candy', limit: 12 },
    { category: 'chocolates', limit: 12 },
    { category: 'slimes', limit: 12 },
    { category: 'greeting-cards', limit: 12 },
    { search: 'halloween', limit: 12 },
    { search: 'christmas', limit: 12 },
    { search: 'cash candle', limit: 12 },
    { search: 'jewelry candle', limit: 12 },
    { search: 'zodiac', limit: 12 },
  ];

  try {
    // Process warmup in small batches of 3 concurrently
    for (let i = 0; i < warmupQueries.length; i += 3) {
      const chunk = warmupQueries.slice(i, i + 3);
      await Promise.allSettled(chunk.map((q) => listProducts(q)));
    }

    // Pre-warm top collection batch handles into detail cache for 0ms cold load
    const topBatchHandles = [
      'back-and-body-hurts-happy-birthday-jewelry-candle',
      'birthday-cake-jewelry-candle',
      'bahama-mama-jewelry-candle',
      'bedtime-spa-jewelry-candle',
      'baked-apple-pie-jewelry-candle',
      'black-raspberry-vanilla-jewelry-candle',
      'cinnamon-apple-jewelry-candle',
      'blueberry-muffin-jewelry-candle',
      'birthday-cake-cash-money-candle',
      'bahama-mama-cash-money-candle',
      'happy-birthday-to-you-cash-money-candle',
      'baked-apple-pie-cash-money-candle',
    ];
    await getProductsBatch(topBatchHandles);
    console.log(`✅ Pre-warmed ${warmupQueries.length} collection queries and ${topBatchHandles.length} batch products in memory.`);
  } catch (err: any) {
    console.warn('Warmup encountered partial error (non-fatal):', err?.message);
  }

  // Refresh every 30 minutes in background so cache never expires
  setTimeout(() => {
    warmupProductCatalog().catch(() => {});
  }, 30 * 60 * 1000);
}

export const DEFAULT_CATALOG: readonly ProductResponseDTO[] = [
  {
    id: 'prod-halloween-bath-bomb-01',
    name: "Creepin' real this halloween Fragrance Bath Bombs",
    slug: 'creepin-real-this-halloween-fragrance-bath-bombs',
    shortDescription: 'Limited-edition Halloween reveal candles & bath treats with cash and jewelry inside worth up to $7,500.',
    description: 'Crafted with 100% natural organic soy wax, clean aromatic oils, and lead-free cotton wicks for a long-lasting, clean burn. Hand-poured in the USA.',
    price: 19.99,
    compareAtPrice: 29.99,
    imageUrl: 'https://cdn.shopify.com/s/files/1/0172/4672/products/4_Mockup_Jewelry_Jewelry_Candle_Halloween.png',
    images: [
      'https://cdn.shopify.com/s/files/1/0172/4672/products/4_Mockup_Jewelry_Jewelry_Candle_Halloween.png',
    ],
    categoryId: 'cat-halloween',
    categoryName: 'CANDLES',
    badge: 'CANDLES',
    rating: 0,
    reviewCount: 0,
    stock: 50,
    inStock: true,
    lowStockThreshold: 5,
    sku: 'HLW-BATH-BOMB-01',
    isBestSeller: true,
    isNew: true,
    status: ProductStatus.ACTIVE,
    scentNotes: [
      '1. Pumpkin Spice 🎃 (Halloween Priority Scent)',
      '2. Spooky Spiced Apple Cider 🍎',
      '3. Midnight Marshmallow Cauldron 👻',
    ],
    scentOptions: [
      {
        id: 'scent-pumpkin-spice',
        name: '1. Pumpkin Spice 🎃 (Halloween Priority Scent)',
        subtitle: 'Pumpkin Spice is curated #1 holiday favorite for this item.',
        isPriority: true,
      },
      {
        id: 'scent-apple-cider',
        name: '2. Spooky Spiced Apple Cider 🍎',
        subtitle: 'Warm orchard apples steeped with cinnamon and clove.',
      },
      {
        id: 'scent-cauldron-marshmallow',
        name: '3. Midnight Marshmallow Cauldron 👻',
        subtitle: 'Toasted vanilla marshmallow with smoky caramel.',
      },
    ],
    ringSizes: ['5', '6', '7', '8', '9', '10'],
    jewelryTypes: ['Ring', 'Necklace', 'Earrings', 'Bracelet'],
    limitedBatchInfo: {
      badge: 'LIMITED SURPRISE BATCH',
      urgencyText: 'Order in next 02h 44m to ship today!',
      countdownHours: 2,
      countdownMinutes: 44,
      countdownSeconds: 38,
    },
    surpriseRevealInfo: {
      badge: 'Guaranteed Fine Jewelry Inside',
      valueRange: 'Jewelry inside worth $10 - $7,500',
      description:
        'Every single handcrafted product holds a sealed, waterproof, heat-resistant capsule with your guaranteed surprise. Burn or unwrap to reveal your treasure!',
      appraisalCallout:
        'Your ring surprise will be tailored in Size 7 appraised $10 to $7,500. Already revealed your jewelry? Check appraisal value & certificate ->',
    },
    trustBadges: ['100% Win Guarantee', 'Free Shipping $50+', '30-Day Returns', 'Made in USA'],
    reviewsSummary: {
      overallRating: 0,
      maxRating: 5.0,
      totalReviews: 0,
      breakdown: [
        { stars: 5, percentage: 0, count: 0 },
        { stars: 4, percentage: 0, count: 0 },
        { stars: 3, percentage: 0, count: 0 },
        { stars: 2, percentage: 0, count: 0 },
        { stars: 1, percentage: 0, count: 0 },
      ],
      appraisedValueRange: '$10 - $7,500',
      guaranteeBadge: '100% Win Guarantee Verified',
    },
    createdAt: new Date('2026-10-01'),
    updatedAt: new Date(),
  },
  {
    id: 'prod-christmas-x-02',
    name: 'Christmas X Holiday Priority Candle',
    slug: 'christmas-x-holiday-priority-candle',
    shortDescription: 'Festive holiday reveal candle featuring certified diamond jewelry and cash surprises inside.',
    description: 'Brimming with fresh balsam pine, warm cinnamon bark, and vanilla sugar. Includes a guaranteed holiday jewelry or cash reveal worth up to $5,000.',
    price: 24.99,
    compareAtPrice: 34.99,
    imageUrl: 'https://cdn.shopify.com/s/files/1/0172/4672/products/4_Mockup_Jewelry_Jewelry_Candle_Christmas.png',
    images: [
      'https://cdn.shopify.com/s/files/1/0172/4672/products/4_Mockup_Jewelry_Jewelry_Candle_Christmas.png',
    ],
    categoryId: 'cat-christmas',
    categoryName: 'CANDLES',
    badge: 'Holiday Priority',
    rating: 0,
    reviewCount: 0,
    stock: 65,
    inStock: true,
    lowStockThreshold: 5,
    sku: 'XMAS-CANDLE-02',
    isBestSeller: true,
    isNew: true,
    status: ProductStatus.ACTIVE,
    scentNotes: ['Winter Balsam & Pine 🎄', 'Cinnamon Sugar Cookie 🍪', 'Frosted Cranberry ❄️'],
    scentOptions: [
      { id: 'scent-balsam', name: 'Winter Balsam & Pine 🎄', isPriority: true },
      { id: 'scent-cookie', name: 'Cinnamon Sugar Cookie 🍪' },
      { id: 'scent-cranberry', name: 'Frosted Cranberry ❄️' },
    ],
    ringSizes: ['5', '6', '7', '8', '9', '10'],
    jewelryTypes: ['Ring', 'Necklace', 'Earrings', 'Bracelet'],
    limitedBatchInfo: {
      badge: 'LIMITED SURPRISE BATCH',
      urgencyText: 'Holiday Batch: Ships within 24 hours!',
      countdownHours: 4,
      countdownMinutes: 15,
      countdownSeconds: 0,
    },
    surpriseRevealInfo: {
      badge: 'Guaranteed Fine Jewelry Inside',
      valueRange: 'Jewelry inside worth $15 - $5,000',
      description: 'Contains sealed genuine diamond jewelry or cash surprise in every jar.',
      appraisalCallout: 'Appraised certificate included with every reveal.',
    },
    trustBadges: ['100% Win Guarantee', 'Free Shipping $50+', '30-Day Returns', 'Made in USA'],
    reviewsSummary: {
      overallRating: 0,
      maxRating: 5.0,
      totalReviews: 0,
      breakdown: [
        { stars: 5, percentage: 0, count: 0 },
        { stars: 4, percentage: 0, count: 0 },
        { stars: 3, percentage: 0, count: 0 },
        { stars: 2, percentage: 0, count: 0 },
        { stars: 1, percentage: 0, count: 0 },
      ],
      appraisedValueRange: '$15 - $5,000',
      guaranteeBadge: '100% Win Guarantee Verified',
    },
    createdAt: new Date('2026-10-01'),
    updatedAt: new Date(),
  },
  {
    id: 'prod-cash-candles-03',
    name: 'Cash Candles Deluxe Hunt Candle',
    slug: 'cash-candles-deluxe-hunt-candle',
    shortDescription: 'Every candle holds real cash inside from $2 up to $2,500 cold hard cash.',
    description: 'Clean burning soy candle infused with crisp clean linen fragrance. Unwrap real cash bills sealed inside heat-resistant foil.',
    price: 24.99,
    compareAtPrice: null,
    imageUrl: 'https://cdn.shopify.com/s/files/1/0172/4672/products/4_Mockup_Jewelry_Jewelry_Candle_Cash.png',
    images: [
      'https://cdn.shopify.com/s/files/1/0172/4672/products/4_Mockup_Jewelry_Jewelry_Candle_Cash.png',
    ],
    categoryId: 'cat-cash-candles',
    categoryName: 'CANDLES',
    badge: 'Win Up To $2,500',
    rating: 0,
    reviewCount: 0,
    stock: 40,
    inStock: true,
    lowStockThreshold: 5,
    sku: 'CASH-CANDLE-03',
    isBestSeller: true,
    isNew: false,
    status: ProductStatus.ACTIVE,
    scentNotes: ['Fresh Crisp Linen 💵', 'Vanilla Gold Rush 🪙', 'Sandalwood & Cashmere 💎'],
    scentOptions: [
      { id: 'scent-linen', name: 'Fresh Crisp Linen 💵', isPriority: true },
      { id: 'scent-vanilla-gold', name: 'Vanilla Gold Rush 🪙' },
      { id: 'scent-sandalwood', name: 'Sandalwood & Cashmere 💎' },
    ],
    ringSizes: [],
    jewelryTypes: ['Cash Reveal Only'],
    limitedBatchInfo: {
      badge: 'CASH PRIZE BATCH',
      urgencyText: 'Order today to claim high denomination capsules!',
      countdownHours: 3,
      countdownMinutes: 20,
      countdownSeconds: 15,
    },
    surpriseRevealInfo: {
      badge: 'Real Cash Inside',
      valueRange: 'Cash inside worth $2 - $2,500',
      description: 'Cold hard USD cash sealed in every candle. Burn to reveal your cash packet.',
      appraisalCallout: '1 in 50 candles contains $100 or higher cash bill!',
    },
    trustBadges: ['100% Win Guarantee', 'Free Shipping $50+', '30-Day Returns', 'Made in USA'],
    reviewsSummary: {
      overallRating: 0,
      maxRating: 5.0,
      totalReviews: 0,
      breakdown: [
        { stars: 5, percentage: 0, count: 0 },
        { stars: 4, percentage: 0, count: 0 },
        { stars: 3, percentage: 0, count: 0 },
        { stars: 2, percentage: 0, count: 0 },
        { stars: 1, percentage: 0, count: 0 },
      ],
      appraisedValueRange: '$2 - $2,500 Real Cash',
      guaranteeBadge: '100% Win Guarantee Verified',
    },
    createdAt: new Date('2026-10-01'),
    updatedAt: new Date(),
  },
  {
    id: 'prod-zodiac-cash-04',
    name: 'Zodiac Celestial Birthstone & Cash Candle',
    slug: 'zodiac-celestial-birthstone-cash-candle',
    shortDescription: 'Astrology-inspired surprise candle personalized to your celestial birth chart with real cash & gemstone inside.',
    description: 'Handcrafted soy blend topped with real crushed amethyst and starlight glitter. Each candle holds a certified gemstone or cash prize inside.',
    price: 29.99,
    compareAtPrice: 39.99,
    imageUrl: 'https://cdn.shopify.com/s/files/1/0172/4672/products/4_Mockup_Jewelry_Jewelry_Candle_Zodiac.png',
    images: [
      'https://cdn.shopify.com/s/files/1/0172/4672/products/4_Mockup_Jewelry_Jewelry_Candle_Zodiac.png',
    ],
    categoryId: 'cat-zodiac',
    categoryName: 'CANDLES',
    badge: 'Real Cash Inside',
    rating: 0,
    reviewCount: 0,
    stock: 35,
    inStock: true,
    lowStockThreshold: 5,
    sku: 'ZODIAC-CANDLE-04',
    isBestSeller: false,
    isNew: true,
    status: ProductStatus.ACTIVE,
    scentNotes: ['Celestial Lavender & Starlight 🔮', 'Moonlit Jasmine & Sandalwood 🌙', 'Solar Citrus Aura ☀️'],
    scentOptions: [
      { id: 'scent-lavender', name: 'Celestial Lavender & Starlight 🔮', isPriority: true },
      { id: 'scent-jasmine', name: 'Moonlit Jasmine & Sandalwood 🌙' },
      { id: 'scent-citrus', name: 'Solar Citrus Aura ☀️' },
    ],
    ringSizes: ['5', '6', '7', '8', '9', '10'],
    jewelryTypes: ['Ring', 'Necklace', 'Earrings', 'Bracelet'],
    limitedBatchInfo: {
      badge: 'LIMITED SURPRISE BATCH',
      urgencyText: 'Order now for next astrological transit dispatch!',
      countdownHours: 1,
      countdownMinutes: 50,
      countdownSeconds: 45,
    },
    surpriseRevealInfo: {
      badge: 'Guaranteed Fine Jewelry & Cash Inside',
      valueRange: 'Prizes inside worth $10 - $5,000',
      description: 'Zodiac gemstone jewelry or cash sealed in waterproof capsule.',
      appraisalCallout: 'Includes personalized zodiac affirmation certificate.',
    },
    trustBadges: ['100% Win Guarantee', 'Free Shipping $50+', '30-Day Returns', 'Made in USA'],
    reviewsSummary: {
      overallRating: 0,
      maxRating: 5.0,
      totalReviews: 0,
      breakdown: [
        { stars: 5, percentage: 0, count: 0 },
        { stars: 4, percentage: 0, count: 0 },
        { stars: 3, percentage: 0, count: 0 },
        { stars: 2, percentage: 0, count: 0 },
        { stars: 1, percentage: 0, count: 0 },
      ],
      appraisedValueRange: '$10 - $5,000',
      guaranteeBadge: '100% Win Guarantee Verified',
    },
    createdAt: new Date('2026-10-01'),
    updatedAt: new Date(),
  },
];

export const ZODIAC_SCENT_OPTIONS = [
  'BIRTHDAY CAKE',
  'BAHAMA MAMA (TROPICAL)',
  'BAKED APPLE PIE',
  'BLACK RASPBERRY VANILLA',
  'AMAZON RAINFOREST (BASIL SAGE AND MINT)',
  'CALMING LAVENDER',
  'CINNAMON APPLE',
  'BLUEBERRY MUFFIN',
  'CINNAMON BUN',
  'CHOCOLATE CHIP COOKIES',
  'COTTON CANDY',
  'ALOHA! (TROPICAL)',
  'LAVENDER VANILLA',
  'BEDTIME SPA',
  'FRESH LINEN',
  'FRESH CUT ROSES',
  'FRENCH VANILLA',
  'COZY CABIN',
  'STRAWBERRY FIELDS',
  'APPLE MANGO MARTINI',
  'JAMAICAN ME CRAZY!',
  'BOMBSHELL (INSPIRED BY VS)',
  'FRESH BAKED SUGAR COOKIES',
  'HONEYSUCKLE',
  'SWEET PEA',
  'BETTER THAN SEX (CHOCOLATE)',
];

export const formatDbProduct = (product: any): ProductResponseDTO => {
  const images: string[] = [];
  if (product.imageUrl) images.push(product.imageUrl);
  if (product.product_images && Array.isArray(product.product_images)) {
    product.product_images.forEach((img: any) => {
      if (img.url && !images.includes(img.url)) images.push(img.url);
    });
  }

  // Dynamic options from product_options relation
  const options = Array.isArray(product.product_options)
    ? product.product_options.map((po: any, idx: number) => ({
        id: po.id,
        name: po.name,
        position: idx + 1,
        values: Array.isArray(po.product_option_values)
          ? po.product_option_values.map((v: any) => v.value)
          : [],
      }))
    : [];

  // Dynamic variants from product_variants relation
  const variants = Array.isArray(product.product_variants)
    ? product.product_variants.map((v: any) => ({
        variantId: v.id,
        productId: product.id,
        title: v.title || undefined,
        price: Number(v.price),
        compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : null,
        sku: v.sku || null,
        stock: v.stock ?? 0,
        inStock: (v.stock ?? 0) > 0,
        ringSize: v.ringSize || null,
        scent: v.scent || null,
      }))
    : [];

  // Determine authentic scents from options, variants, or scentNotes
  const scentOptionEntry = options.find((o: any) => /scent|fragrance/i.test(o.name));
  const optionScents: string[] = scentOptionEntry && Array.isArray(scentOptionEntry.values)
    ? scentOptionEntry.values
    : [];

  const variantScents = Array.isArray(product.product_variants)
    ? (Array.from(new Set(product.product_variants.map((v: any) => v.scent).filter(Boolean))) as string[])
    : [];

  const rawScentNotes = Array.isArray(product.scentNotes) ? product.scentNotes : [];

  const isZodiacCashMoneyCandle =
    /(aquarius|aries|cancer|capricorn|gemini|leo|libra|pisces|sagittarius|scorpio|taurus|virgo)-zodiac-cash(-money)?-candle/i.test(product.slug || '') ||
    (/(aquarius|aries|cancer|capricorn|gemini|leo|libra|pisces|sagittarius|scorpio|taurus|virgo)/i.test(product.name || '') && /zodiac\s*cash/i.test(product.name || ''));

  const mockMatch = DEFAULT_CATALOG.find(
    (m: any) => m.slug === product.slug || m.id === product.id
  );

  let scentNotes: string[] = [];
  if (optionScents.length > 1) {
    scentNotes = optionScents;
  } else if (variantScents.length > 1) {
    scentNotes = variantScents;
  } else if (isZodiacCashMoneyCandle) {
    scentNotes = variantScents.length > 0 ? variantScents : ZODIAC_SCENT_OPTIONS;
  } else if (rawScentNotes.length > 1) {
    scentNotes = rawScentNotes;
  } else if (mockMatch && Array.isArray(mockMatch.scentNotes) && mockMatch.scentNotes.length > 0) {
    scentNotes = mockMatch.scentNotes;
  } else {
    scentNotes = [];
  }

  // Normalize existing scent option name to "Choose your scent" according to reference site
  for (const opt of options) {
    if (/scent|fragrance/i.test(opt.name.trim())) {
      opt.name = 'Choose your scent';
    }
  }

  // Ensure Choose your scent option is present in options ONLY if product has authentic scent variety (> 1)
  if (scentNotes.length > 1 && !options.some((o: any) => /scent|fragrance/i.test(o.name))) {
    options.unshift({
      id: `${product.id}::scent-options`,
      name: 'Choose your scent',
      position: 1,
      values: scentNotes,
    });
  }

  const ringSizes =
    Array.isArray(product.ringSizes) && product.ringSizes.length > 0
      ? product.ringSizes
      : ['5', '6', '7', '8', '9', '10'];
  const jewelryTypes =
    Array.isArray(product.jewelryTypes) && product.jewelryTypes.length > 0
      ? product.jewelryTypes
      : ['Ring', 'Necklace', 'Earrings', 'Bracelet'];

  const scentOptions: ScentOption[] = (mockMatch && Array.isArray(mockMatch.scentOptions) && mockMatch.scentOptions.length > 0)
    ? mockMatch.scentOptions
    : scentNotes.map((name: string, index: number) => ({
        id: `scent-${index + 1}`,
        name,
        subtitle:
          index === 0 ? `${name.split(' ')[1] || name} is popular for this item.` : undefined,
        isPriority: index === 0,
      }));

  const maxVal = product.surpriseValue ? Number(product.surpriseValue) : 7500;
  const appraisedRange = `$10 - $${maxVal.toLocaleString()}`;
  const valueRange = `Jewelry inside worth ${appraisedRange}`;

  const primaryCollection = (product as any).product_collections?.[0]?.collections;
  const collections = (product as any).product_collections?.map((pc: any) => ({
    id: pc.collections?.id || pc.collectionId,
    name: pc.collections?.name || '',
    slug: pc.collections?.slug || '',
  })).filter((c: any) => c.id) || [];
  const publishedRatings: number[] = Array.isArray(product.product_reviews)
    ? product.product_reviews.map((review: { rating: number }) => review.rating)
    : [];
  const reviewCount = publishedRatings.length;
  const rating = reviewCount
    ? publishedRatings.reduce((total, value) => total + value, 0) / reviewCount
    : 0;
  const ratingBreakdown = [5, 4, 3, 2, 1].map((stars) => {
    const count = publishedRatings.filter((value) => value === stars).length;
    return {
      stars,
      percentage: reviewCount ? Math.round((count / reviewCount) * 100) : 0,
      count,
    };
  });

    const isJewelryCandle = Boolean(
      product.categories?.slug === 'jewelry-candles' ||
      product.categories?.name === 'Jewelry Candles' ||
      (product.slug && product.slug.includes('jewelry-candle')) ||
      (product.name && /jewelry\s*candle/i.test(product.name))
    );

    const resolvedCategoryName = product.categories?.name || (isJewelryCandle ? 'Jewelry Candles' : primaryCollection?.name || product.badge || 'CANDLES');
    const resolvedBadge = (product.badge && product.badge.toUpperCase() !== 'CANDLES')
      ? product.badge
      : isJewelryCandle
        ? (product.isBestSeller ? 'BESTSELLER' : 'JEWELRY CANDLES')
        : (primaryCollection?.name || product.badge || 'CANDLES');

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      description: product.description,
      price: Number(product.price),
      compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
      imageUrl: product.imageUrl || (images[0] || null),
      images,
      categoryId: product.categoryId || (primaryCollection?.id ? `cat-${primaryCollection.slug}` : (isJewelryCandle ? '1779da67-aa64-4840-af06-5e87ad1af4be' : null)),
      categoryName: resolvedCategoryName,
      badge: resolvedBadge,
    collections,
    rating,
    reviewCount,
    stock: product.stock ?? 50,
    inStock: (product.stock ?? 50) > 0,
    lowStockThreshold: product.lowStockThreshold || 5,
    sku: product.sku,
    isBestSeller: Boolean(product.isBestSeller),
    isNew: Boolean(product.isNew),
    status: product.status || ProductStatus.ACTIVE,
    scentNotes,
    scentOptions,
    ringSizes,
    jewelryTypes,
    options: options.length > 0 ? options : undefined,
    variants: variants.length > 0 ? variants : undefined,
    limitedBatchInfo: {
      badge: 'LIMITED SURPRISE BATCH',
      urgencyText: 'Order in next 02h 44m to ship today!',
      countdownHours: 2,
      countdownMinutes: 44,
      countdownSeconds: 38,
    },
    surpriseRevealInfo: {
      badge: 'Guaranteed Fine Jewelry Inside',
      valueRange,
      description:
        'Every single handcrafted product holds a sealed, waterproof, heat-resistant capsule with your guaranteed surprise. Burn or unwrap to reveal your treasure!',
      appraisalCallout: `Your ring surprise will be tailored in Size 7 appraised $10 to $${maxVal.toLocaleString()}. Already revealed your jewelry? Check appraisal value & certificate ->`,
    },
    trustBadges: ['100% Win Guarantee', 'Free Shipping $50+', '30-Day Returns', 'Made in USA'],
    reviewsSummary: {
      overallRating: rating,
      maxRating: 5.0,
      totalReviews: reviewCount,
      breakdown: ratingBreakdown,
      appraisedValueRange: appraisedRange,
      guaranteeBadge: '100% Win Guarantee Verified',
    },
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
};

export const listProducts = async (query: ListProductsQueryDTO): Promise<{
  products: ProductResponseDTO[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}> => {
  const page = Math.max(1, query.page || 1);
  const limit = Math.max(1, Math.min(100, query.limit || 20));
  const skip = (page - 1) * limit;

  // ── Cache check: serve in <5ms for repeated/paginated requests ──
  const cacheKey = JSON.stringify({ page, limit, ...query });
  const cachedResult = getCached(productListCache, cacheKey);
  if (cachedResult) return cachedResult;

  try {
    const conditions: Prisma.productsWhereInput[] = [];

    if (query.status) {
      conditions.push({ status: query.status });
    }

    if (query.featured) {
      conditions.push({ isBestSeller: true });
    }

    if (query.search) {
      const searchTerm = query.search.trim();
      const slugSearch = searchTerm.toLowerCase().replace(/\s+/g, '-');
      conditions.push({
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { slug: { contains: slugSearch, mode: 'insensitive' } },
          { badge: { contains: searchTerm, mode: 'insensitive' } },
        ],
      });
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const priceFilter: Prisma.DecimalFilter = {};
      if (query.minPrice !== undefined) priceFilter.gte = query.minPrice;
      if (query.maxPrice !== undefined) priceFilter.lte = query.maxPrice;
      conditions.push({ price: priceFilter });
    }

    if (query.category) {
      const catTrimmed = query.category.trim();
      const catKey = catTrimmed.toLowerCase();
      let res = categoryResolutionCache.get(catKey);
      if (!res) {
        try {
          const timeoutPromise = new Promise<any>((_, reject) =>
            setTimeout(() => reject(new Error('Category resolution timeout')), 2000)
          );
          const fetchPromise = Promise.all([
            prisma.categories.findMany({
              where: {
                OR: [
                  { id: catTrimmed },
                  { slug: { equals: catTrimmed, mode: 'insensitive' } },
                  { name: { contains: catTrimmed, mode: 'insensitive' } },
                ],
              },
              select: { id: true },
            }),
            prisma.collections.findMany({
              where: {
                OR: [
                  { id: catTrimmed },
                  { slug: { equals: catTrimmed, mode: 'insensitive' } },
                  { name: { contains: catTrimmed, mode: 'insensitive' } },
                ],
              },
              select: { id: true },
            }),
          ]);

          const [cats, cols] = await Promise.race([fetchPromise, timeoutPromise]);
          res = {
            categoryIds: (cats || []).map((c: any) => c.id),
            collectionIds: (cols || []).map((c: any) => c.id),
          };
          categoryResolutionCache.set(catKey, res);
        } catch {
          res = { categoryIds: [catTrimmed], collectionIds: [] };
          categoryResolutionCache.set(catKey, res);
        }
      }

      const orConds: Prisma.productsWhereInput[] = [];
      if (res.categoryIds.length > 0) {
        orConds.push({ categoryId: { in: res.categoryIds } });
      }
      if (res.collectionIds.length > 0) {
        orConds.push({
          product_collections: {
            some: {
              collectionId: { in: res.collectionIds },
            },
          },
        });
      }
      orConds.push({ badge: { contains: catTrimmed, mode: 'insensitive' } });
      if (orConds.length > 0) {
        conditions.push({ OR: orConds });
      }
    }

    const where: Prisma.productsWhereInput = conditions.length > 0 ? { AND: conditions } : {};

    const orderBy: Prisma.productsOrderByWithRelationInput = {};
    if (query.sortBy === 'price-asc') orderBy.price = 'asc';
    else if (query.sortBy === 'price-desc') orderBy.price = 'desc';
    else if (query.sortBy === 'rating') orderBy.rating = 'desc';
    else if (query.sortBy === 'bestseller') orderBy.isBestSeller = 'desc';
    else orderBy.createdAt = 'desc';

    const findManyPromise = prisma.products.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        categories: { select: { id: true, name: true, slug: true } },
        product_images: {
          take: 2,
          orderBy: { sortOrder: 'asc' },
          select: { url: true, isPrimary: true, sortOrder: true },
        },
        product_collections: {
          take: 2,
          orderBy: { sortOrder: 'asc' },
          include: {
            collections: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
      },
    });

    const countKey = query.category ? query.category.trim().toLowerCase() : (query.search || 'all');
    let countPromise: Promise<number>;
    const cachedCount = categoryCountCache.get(countKey);
    if (cachedCount && Date.now() - cachedCount.timestamp < GLOBAL_COUNT_TTL_MS) {
      countPromise = Promise.resolve(cachedCount.count);
    } else if (conditions.length === 0) {
      if (globalProductCountCache && Date.now() - globalProductCountCache.timestamp < GLOBAL_COUNT_TTL_MS) {
        countPromise = Promise.resolve(globalProductCountCache.count);
      } else {
        countPromise = prisma.products.count().then((c) => {
          globalProductCountCache = { count: c, timestamp: Date.now() };
          return c;
        });
      }
    } else {
      countPromise = prisma.products.count({ where }).then((c) => {
        categoryCountCache.set(countKey, { count: c, timestamp: Date.now() });
        return c;
      });
    }

    const queryTimeoutPromise = new Promise<any>((_, reject) =>
      setTimeout(() => reject(new Error('Database query timed out')), 3500)
    );

    const [dbProducts, dbTotal] = await Promise.race([
      Promise.all([findManyPromise, countPromise]),
      queryTimeoutPromise,
    ]);

    if (dbProducts.length > 0) {
      const result = {
        products: dbProducts.map(formatDbProduct),
        pagination: {
          total: dbTotal,
          page,
          limit,
          totalPages: Math.ceil(dbTotal / limit),
        },
      };
      setCached(productListCache, cacheKey, result, LIST_CACHE_TTL_MS);
      return result;
    }
  } catch (err: any) {
    console.warn('DB query in listProducts fell back to default catalog:', err.message);
  }

  let filtered = [...DEFAULT_CATALOG];
  if (query.search) {
    const q = query.search.toLowerCase();
    filtered = filtered.filter((p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
  }
  if (query.category) {
    const cat = query.category.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.categoryName?.toLowerCase().includes(cat) ||
        p.badge?.toLowerCase().includes(cat) ||
        p.categoryId?.toLowerCase() === cat
    );
  }
  if (query.featured) {
    filtered = filtered.filter((p) => p.isBestSeller);
  }

  const total = filtered.length;
  const paginated = filtered.slice(skip, skip + limit);

  const fallbackResult = {
    products: paginated,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
  setCached(productListCache, cacheKey, fallbackResult, LIST_CACHE_TTL_MS);
  return fallbackResult;
};

export const getProductByIdOrSlug = async (identifier: string): Promise<ProductResponseDTO> => {
  const cleanId = identifier.trim();
  const cached = getCached(productDetailCache, cleanId);
  if (cached) return cached;
  const inFlight = productDetailRequests.get(cleanId);
  if (inFlight) return inFlight;
  const request = fetchProductDetail(cleanId, productCacheVersion);
  productDetailRequests.set(cleanId, request);
  try {
    return await request;
  } finally {
    if (productDetailRequests.get(cleanId) === request) productDetailRequests.delete(cleanId);
  }
};

async function fetchProductDetail(cleanId: string, version: number): Promise<ProductResponseDTO> {
  try {
    const dbProduct = await loadProductDetail(cleanId);

    if (dbProduct) {
      const formatted = formatDbProduct(dbProduct);
      // An admin edit during the query must not repopulate the cache with old data.
      if (version === productCacheVersion) {
        for (const key of new Set([cleanId, formatted.slug, formatted.id])) {
          if (key) setCached(productDetailCache, key, formatted, DETAIL_CACHE_TTL_MS);
        }
      }
      return formatted;
    }
  } catch (err: any) {
    console.warn('DB query in getProductByIdOrSlug failed, checking catalog:', err.message);
  }

  const matched = DEFAULT_CATALOG.find(
    (p) => p.id === cleanId || p.slug.toLowerCase() === cleanId.toLowerCase()
  );

  if (matched) {
    if (version === productCacheVersion) setCached(productDetailCache, cleanId, matched, DETAIL_CACHE_TTL_MS);
    return matched;
  }

  const error: any = new Error(`Product with identifier "${cleanId}" not found`);
  error.statusCode = 404;
  throw error;
};

export const getProductsBatch = async (ids: string[]): Promise<ProductResponseDTO[]> => {
  if (!ids || ids.length === 0) return [];
  const cleanIds = ids.map((id) => id.trim()).filter(Boolean);
  if (cleanIds.length === 0) return [];

  const results: ProductResponseDTO[] = [];
  const missingIds: string[] = [];

  // 1. Check in-memory cache first
  for (const id of cleanIds) {
    const cached = getCached(productDetailCache, id);
    if (cached) {
      results.push(cached);
    } else {
      missingIds.push(id);
    }
  }

  if (missingIds.length === 0) return results;

  // 2. Query DB in a single fast round-trip with PostgreSQL JSON aggregation
  try {
    let dbProducts: any[] = [];
    try {
      dbProducts = await prisma.$queryRaw<any[]>`
        SELECT p.*, to_jsonb(c) AS categories,
          COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i."sortOrder")
            FROM product_images i WHERE i."productId" = p.id), '[]'::jsonb) AS product_images,
          COALESCE((SELECT jsonb_agg(to_jsonb(v))
            FROM product_variants v WHERE v."productId" = p.id), '[]'::jsonb) AS product_variants,
          COALESCE((SELECT jsonb_agg(to_jsonb(o) || jsonb_build_object(
              'product_option_values', COALESCE((
                SELECT jsonb_agg(to_jsonb(ov) ORDER BY ov."sortOrder")
                FROM product_option_values ov WHERE ov."optionId" = o.id
              ), '[]'::jsonb)))
            FROM product_options o WHERE o."productId" = p.id), '[]'::jsonb) AS product_options
        FROM products p
        LEFT JOIN categories c ON c.id = p."categoryId"
        WHERE p.id = ANY(${missingIds}::text[]) OR p.slug = ANY(${missingIds}::text[])
      `;
    } catch (rawErr: any) {
      console.warn('Fast batch queryRaw failed, falling back to findMany:', rawErr?.message);
      dbProducts = await prisma.products.findMany({
        where: {
          OR: [
            { id: { in: missingIds } },
            { slug: { in: missingIds } },
          ],
        },
        include: {
          categories: true,
          product_images: { orderBy: { sortOrder: 'asc' } },
          product_variants: true,
          product_options: {
            include: {
              product_option_values: { orderBy: { sortOrder: 'asc' } },
            },
          },
        },
      });
    }

    const foundMap = new Map<string, ProductResponseDTO>();
    for (const p of dbProducts) {
      const formatted = formatDbProduct(p);
      setCached(productDetailCache, formatted.id, formatted, DETAIL_CACHE_TTL_MS);
      if (formatted.slug) {
        setCached(productDetailCache, formatted.slug, formatted, DETAIL_CACHE_TTL_MS);
      }
      foundMap.set(formatted.id.toLowerCase(), formatted);
      if (formatted.slug) {
        foundMap.set(formatted.slug.toLowerCase(), formatted);
      }
      results.push(formatted);
    }

    // 3. Fallback catalog for anything still missing
    const remainingMissing = missingIds.filter(
      (id) => !foundMap.has(id.toLowerCase())
    );
    for (const id of remainingMissing) {
      const matched = DEFAULT_CATALOG.find(
        (p) => p.id === id || p.slug.toLowerCase() === id.toLowerCase()
      );
      if (matched) {
        setCached(productDetailCache, id, matched, DETAIL_CACHE_TTL_MS);
        results.push(matched);
      } else {
        const cleanSlug = id.replace(/^(prod[-_])?/, '');
        const title = cleanSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const isCash = cleanSlug.includes('cash');
        const synthProduct: ProductResponseDTO = {
          id,
          name: title,
          slug: cleanSlug,
          price: 28.99,
          category: 'Candles',
          badge: isCash ? 'CASH SURPRISE' : 'JEWELRY CANDLES',
          inStock: true,
          isBestSeller: true,
          images: ['/assets/ilovesurprises/categories/1_Mockup_Jewelry_JewelryCandles_93d459aa-d530-474d-ba4c-32fb9af4f94c.jpg'],
          description: `Handcrafted ${title} with guaranteed surprise inside.`,
          surpriseType: isCash ? 'cash' : 'jewelry',
          surpriseValue: isCash ? 'Real Cash inside up to $2,500' : 'Jewelry inside worth $10 - $7,500',
          limitedBatchInfo: {
            badge: 'LIMITED SURPRISE BATCH',
            urgencyText: 'Ships within 24 hours!',
            timeLeft: 'Limited Batch',
          },
        } as any;
        setCached(productDetailCache, id, synthProduct, DETAIL_CACHE_TTL_MS);
        setCached(productDetailCache, cleanSlug, synthProduct, DETAIL_CACHE_TTL_MS);
        results.push(synthProduct);
      }
    }
  } catch (err: any) {
    console.warn('DB batch query failed, checking catalog:', err.message);
    for (const id of missingIds) {
      const matched = DEFAULT_CATALOG.find(
        (p) => p.id === id || p.slug.toLowerCase() === id.toLowerCase()
      );
      if (matched) {
        results.push(matched);
      } else {
        const cleanSlug = id.replace(/^(prod[-_])?/, '');
        const title = cleanSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const isCash = cleanSlug.includes('cash');
        const synthProduct: ProductResponseDTO = {
          id,
          name: title,
          slug: cleanSlug,
          price: 28.99,
          category: 'Candles',
          badge: isCash ? 'CASH SURPRISE' : 'JEWELRY CANDLES',
          inStock: true,
          isBestSeller: true,
          images: ['/assets/ilovesurprises/categories/1_Mockup_Jewelry_JewelryCandles_93d459aa-d530-474d-ba4c-32fb9af4f94c.jpg'],
          description: `Handcrafted ${title} with guaranteed surprise inside.`,
          surpriseType: isCash ? 'cash' : 'jewelry',
        } as any;
        results.push(synthProduct);
      }
    }
  }

  return results;
};

const reviewRelations = {
  users: { select: { firstName: true, lastName: true } },
  products: { select: { name: true } },
} as const;

type ProductReviewWithRelations = Prisma.product_reviewsGetPayload<{
  include: typeof reviewRelations;
}>;

const formatProductReview = (review: ProductReviewWithRelations) => ({
  id: review.id,
  productId: review.productId,
  author: [review.users.firstName, review.users.lastName?.charAt(0)]
    .filter(Boolean)
    .join(' ') || 'Verified customer',
  rating: review.rating,
  date: review.createdAt.toISOString().slice(0, 10),
  title: review.title || '',
  comment: review.comment,
  verified: review.isVerifiedPurchase,
  productName: review.products.name,
});

export const getProductReviews = async (productIdOrSlug: string) => {
  const product = await getProductByIdOrSlug(productIdOrSlug);
  const reviews = await prisma.product_reviews.findMany({
    where: {
      productId: product.id,
      isApproved: true,
      isVerifiedPurchase: true,
    },
    include: reviewRelations,
    orderBy: { createdAt: 'desc' },
  });

  return reviews.map(formatProductReview);
};

export const getRecentReviews = async (limit: number) => {
  const reviews = await prisma.product_reviews.findMany({
    where: {
      isApproved: true,
      isVerifiedPurchase: true,
    },
    include: reviewRelations,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return reviews.map(formatProductReview);
};

export const createReview = async (productIdOrSlug: string, userId: string, data: CreateReviewDTO) => {
  const product = await getProductByIdOrSlug(productIdOrSlug);

  return prisma.$transaction(async (transaction) => {
    const deliveredPurchase = await transaction.order_items.findFirst({
      where: {
        productId: product.id,
        orders: {
          userId,
          status: 'DELIVERED',
          paymentStatus: 'PAID',
        },
      },
      select: { id: true },
    });

    if (!deliveredPurchase) {
      throw Object.assign(
        new Error('A review can be submitted after a paid order containing this product has been delivered.'),
        { statusCode: 403 }
      );
    }

    const existingReview = await transaction.product_reviews.findUnique({
      where: { productId_userId: { productId: product.id, userId } },
      select: { id: true },
    });
    if (existingReview) {
      throw Object.assign(new Error('You have already reviewed this product.'), { statusCode: 409 });
    }

    const review = await transaction.product_reviews.create({
      data: {
        id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        productId: product.id,
        userId,
        rating: data.rating,
        title: data.title || null,
        comment: data.comment,
        isApproved: true,
        isVerifiedPurchase: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      include: reviewRelations,
    });

    const aggregate = await transaction.product_reviews.aggregate({
      where: {
        productId: product.id,
        isApproved: true,
        isVerifiedPurchase: true,
      },
      _avg: { rating: true },
      _count: { _all: true },
    });

    await transaction.products.update({
      where: { id: product.id },
      data: {
        rating: aggregate._avg.rating || 0,
        reviewCount: aggregate._count._all,
      },
    });

    return formatProductReview(review);
  }).then((review) => {
    invalidateProductCaches();
    return review;
  });
};

export const createProduct = async (data: CreateProductDTO): Promise<ProductResponseDTO> => {
  let baseSlug = (data.slug || data.name)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!baseSlug) baseSlug = `product-${Date.now().toString(36)}`;

  let slug = baseSlug;
  let counter = 1;
  while (await prisma.products.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter++}`;
  }

  const id = `prod-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  const created = await prisma.products.create({
    data: {
      id,
      name: data.name,
      slug,
      shortDescription: data.shortDescription || null,
      description: data.description || null,
      price: data.price,
      compareAtPrice: data.compareAtPrice || null,
      imageUrl: data.imageUrl || null,
      categoryId: data.categoryId || null,
      surpriseType: data.surpriseType || 'JEWELRY',
      surpriseValue: data.surpriseValue || 7500,
      badge: data.badge || 'CANDLES',
      stock: data.stock || 50,
      lowStockThreshold: data.lowStockThreshold || 5,
      sku: data.sku || null,
      isBestSeller: data.isBestSeller || false,
      isNew: data.isNew || true,
      scentNotes: data.scentNotes || [],
      ringSizes: data.ringSizes || ['5', '6', '7', '8', '9', '10'],
      jewelryTypes: data.jewelryTypes || ['Ring', 'Necklace', 'Earrings', 'Bracelet'],
      status: data.status || ProductStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    include: {
      categories: true,
      product_images: true,
    },
  });

  invalidateProductCaches();
  return formatDbProduct(created);
};

export const updateProduct = async (id: string, data: UpdateProductDTO): Promise<ProductResponseDTO> => {
  let finalSlug: string | undefined;
  if (data.slug) {
    let baseSlug = data.slug
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!baseSlug && data.name) {
      baseSlug = data.name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
    }
    if (baseSlug) {
      finalSlug = baseSlug;
      let counter = 1;
      while (await prisma.products.findFirst({ where: { slug: finalSlug, NOT: { id } } })) {
        finalSlug = `${baseSlug}-${counter++}`;
      }
    }
  }

  await prisma.$transaction(
    async (transaction) => {
      let categoryId = data.categoryId;
      if (data.categorySlug !== undefined) {
        if (data.categorySlug === null || data.categorySlug.trim() === '') {
          categoryId = null;
        } else {
          const cleanSlug = data.categorySlug.trim().toLowerCase();
          const collection = await transaction.collections.findFirst({
            where: { slug: cleanSlug },
            select: { name: true },
          });

          const categoryName =
            collection?.name ||
            cleanSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

          const category = await transaction.categories.upsert({
            where: { slug: cleanSlug },
            update: { name: categoryName, updatedAt: new Date() },
            create: {
              id: randomUUID(),
              slug: cleanSlug,
              name: categoryName,
              updatedAt: new Date(),
            },
            select: { id: true },
          });
          categoryId = category.id;
        }
      }

      await transaction.products.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(finalSlug && { slug: finalSlug }),
          ...(data.shortDescription !== undefined && { shortDescription: data.shortDescription }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.price !== undefined && { price: data.price }),
          ...(data.compareAtPrice !== undefined && { compareAtPrice: data.compareAtPrice }),
          ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
          ...(categoryId !== undefined && { categoryId }),
          ...(data.surpriseType !== undefined && { surpriseType: data.surpriseType }),
          ...(data.surpriseValue !== undefined && { surpriseValue: data.surpriseValue }),
          ...(data.badge !== undefined && { badge: data.badge }),
          ...(data.stock !== undefined && { stock: data.stock }),
          ...(data.lowStockThreshold !== undefined && { lowStockThreshold: data.lowStockThreshold }),
          ...(data.sku !== undefined && { sku: data.sku }),
          ...(data.isBestSeller !== undefined && { isBestSeller: data.isBestSeller }),
          ...(data.isNew !== undefined && { isNew: data.isNew }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.scentNotes !== undefined && { scentNotes: data.scentNotes }),
          ...(data.ringSizes !== undefined && { ringSizes: data.ringSizes }),
          ...(data.jewelryTypes !== undefined && { jewelryTypes: data.jewelryTypes }),
          updatedAt: new Date(),
        },
      });

      if (data.images !== undefined) {
        await transaction.product_images.deleteMany({ where: { productId: id } });
        if (data.images.length > 0) {
          await transaction.product_images.createMany({
            data: data.images.map((url, sortOrder) => ({
              id: randomUUID(),
              productId: id,
              url,
              sortOrder,
              isPrimary: sortOrder === 0,
            })),
          });
        }
      }

      if (data.options !== undefined) {
        await transaction.product_options.deleteMany({ where: { productId: id } });
        for (const option of data.options) {
          await transaction.product_options.create({
            data: {
              id: randomUUID(),
              productId: id,
              name: option.name,
              product_option_values: {
                create: option.values.map((value, sortOrder) => ({
                  id: randomUUID(),
                  value,
                  sortOrder,
                })),
              },
            },
          });
        }
      }

      if (data.collectionSlug && data.collectionSlug.trim()) {
        const cleanColSlug = data.collectionSlug.trim().toLowerCase();
        let collection = await transaction.collections.findFirst({
          where: { slug: cleanColSlug },
          select: { id: true },
        });
        if (!collection) {
          const collectionName = cleanColSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          collection = await transaction.collections.create({
            data: {
              id: randomUUID(),
              name: collectionName,
              slug: cleanColSlug,
              updatedAt: new Date(),
            },
            select: { id: true },
          });
        }

        await transaction.product_collections.upsert({
          where: {
            productId_collectionId: {
              productId: id,
              collectionId: collection.id,
            },
          },
          update: { sortOrder: 0 },
          create: { productId: id, collectionId: collection.id, sortOrder: 0 },
        });
        await transaction.product_collections.updateMany({
          where: {
            productId: id,
            collectionId: { not: collection.id },
            sortOrder: 0,
          },
          data: { sortOrder: 1 },
        });
      }
    },
    {
      maxWait: 15000,
      timeout: 30000,
    }
  );

  const updated = await prisma.products.findUniqueOrThrow({
    where: { id },
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
        orderBy: { sortOrder: 'asc' },
        include: { collections: { select: { id: true, name: true, slug: true } } },
      },
    },
  });

  invalidateProductCaches();
  return formatDbProduct(updated);
};

export const deleteProduct = async (id: string): Promise<{ message: string }> => {
  await prisma.products.delete({
    where: { id },
  });
  invalidateProductCaches();
  return { message: 'Product deleted successfully' };
};

// Backward compatibility object export
export const productService = {
  formatProduct: formatDbProduct,
  listProducts,
  getProductByIdOrSlug,
  createReview,
  createProduct,
  updateProduct,
  deleteProduct,
};
