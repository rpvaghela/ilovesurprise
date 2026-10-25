import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowRight, DollarSign, Flame, Gift, Gem } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { productService } from '../../services/productService';
import { deduplicateProducts } from '../../utils/productUtils';
import { ProductCard } from '../products/ProductCard';
import { ProductCardSkeleton } from '../ui/ProductCardSkeleton';
import type { Product, CartItem } from '../../types';

interface FeaturedCollectionsSectionProps {
  cart?: CartItem[];
  wishlistIds?: string[];
  onSelectCategory?: (category: string) => void;
  onSelectCollection?: (handle: string) => void;
  onSelectProduct?: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
  onUpdateQuantity?: (productId: string, delta: number) => void;
  onWishlistToggle?: (product: Product) => void;
}

interface CuratedCollectionConfig {
  id: string;
  title: string;
  categoryKey: string;
  badge: string;
  badgeIcon: React.ComponentType<{ className?: string }>;
  tagline: string;
  itemCount: number;
  image: string;
  ctaText: string;
  highlights: string[];
  eyebrow: string;
  theme: 'amber' | 'red' | 'emerald' | 'purple';
}

type CollectionStatus = 'loading' | 'success' | 'empty' | 'error';

interface CollectionItemState {
  status: CollectionStatus;
  products: Product[];
  errorMessage?: string;
}

const DEFAULT_CURATED_CARDS: Record<string, CuratedCollectionConfig> = {
  halloween: {
    id: 'halloween',
    title: 'Wax Melts',
    categoryKey: 'Wax Melts',
    badge: 'Fragrance Melts',
    badgeIcon: Flame,
    tagline: 'Long-lasting surprise wax melts with cash and jewelry reveals inside',
    itemCount: 83,
    image: 'https://cdn.shopify.com/s/files/1/0172/4672/products/4_Mockup_Jewelry_JewelryCandles_37b9e8df-fc51-4b27-9db3-6236ee9d84b6.jpg?v=1602742369',
    ctaText: 'Shop Wax Melts',
    highlights: ['🎃 Cash or Jewelry Inside', '🕯️ 100% Natural Soy Wax', '⚡ Limited Holiday Release'],
    eyebrow: 'Wax Melt Collection',
    theme: 'amber',
  },
  'christmas-candles-1': {
    id: 'christmas-candles-1',
    title: 'Christmas Candles',
    categoryKey: 'Christmas Candles',
    badge: 'Holiday Priority',
    badgeIcon: Gift,
    tagline: 'Magical Christmas reveal candles and seasonal celebration scents with hidden treasures',
    itemCount: 98,
    image: 'https://cdn.shopify.com/s/files/1/0172/4672/products/1_Mockup_Jewelry_Jewelry_Candles_9c1f97ea-399f-403a-ae64-3f3afc816a87.jpg?v=1573149158',
    ctaText: 'Shop Christmas Collection',
    highlights: ['🎁 Real Cash Up To $2,500', '💍 Genuine Jewelry Ring', '🎄 Festive Seasonal Aroma'],
    eyebrow: 'Upcoming Holiday Priority',
    theme: 'red',
  },
  'cash-money-candles': {
    id: 'cash-money-candles',
    title: 'Money Cash Candles',
    categoryKey: 'Cash Money Candles',
    badge: 'Win Up To $2,500',
    badgeIcon: DollarSign,
    tagline: 'Real cash prizes ($2 – $2,500) hidden inside every single candle',
    itemCount: 76,
    image: '/assets/ilovesurprises/categories/cash_money_candles.jpg',
    ctaText: 'Shop Money Cash Candles',
    highlights: ['💵 Real Cash Guaranteed', '💰 Up to $2,500 Cash Bill', '⭐ Signature Bestseller'],
    eyebrow: 'Signature Money Reveal Experience',
    theme: 'emerald',
  },
  'jewelry-candy': {
    id: 'jewelry-candy',
    title: 'Jewelry Candles',
    categoryKey: 'Jewelry Candles',
    badge: '💎 Real Jewelry Inside',
    badgeIcon: Gem,
    tagline: 'Delicious sweet treats with a real surprise jewelry piece hidden inside every single tube',
    itemCount: 28,
    image: 'https://cdn.shopify.com/s/files/1/0172/4672/products/10_Mockup_Jewelry_JewelryCandles_f8e103f9-76ed-434e-a46b-87c79da2da4d.jpg?v=1588143552',
    ctaText: 'Shop Jewelry Candles',
    highlights: ['🍬 Delicious Sweet Treats', '💍 Real Jewelry Inside ($15–$7,500)', '✨ Perfect Novelty Gift'],
    eyebrow: 'Sweet Surprises & Real Jewelry',
    theme: 'purple',
  },
};

export const FeaturedCollectionsSection: React.FC<FeaturedCollectionsSectionProps> = ({
  cart = [],
  wishlistIds = [],
  onSelectCategory,
  onSelectCollection,
  onSelectProduct,
  onAddToCart,
  onUpdateQuantity,
  onWishlistToggle,
}) => {
  const [homepageConfig, setHomepageConfig] = useState(() => adminService.getHomepageContent());
  const [collectionStates, setCollectionStates] = useState<Record<string, CollectionItemState>>(() => {
    // Initial check for synchronous cache hit
    const initial: Record<string, CollectionItemState> = {};
    const ids = ['halloween', 'christmas-candles-1', 'cash-money-candles', 'jewelry-candy'];
    ids.forEach((id) => {
      const cached = productService.getCachedCollectionProducts(id, 10);
      if (cached && cached.length > 0) {
        initial[id] = { status: 'success', products: deduplicateProducts(cached).slice(0, 10) };
      } else {
        initial[id] = { status: 'loading', products: [] };
      }
    });
    return initial;
  });

  const wishlistSet = useMemo(() => new Set(wishlistIds), [wishlistIds]);

  useEffect(() => {
    const controller = new AbortController();

    // Showcase card content (titles, badges, taglines, CTAs, images, order,
    // visibility) is stored in the database and served by GET /api/storefront,
    // so an admin edit appears here after a refetch without a frontend build.
    const loadStorefrontContent = () => {
      adminService
        .fetchLiveStorefrontContent({ signal: controller.signal })
        .then((content) => {
          if (!controller.signal.aborted && content) {
            setHomepageConfig(content);
          }
        })
        .catch(() => {
          /* Keep the currently rendered configuration on failure. */
        });
    };

    loadStorefrontContent();

    window.addEventListener('ils_homepage_content_updated', loadStorefrontContent);
    window.addEventListener('ils_storefront_updated', loadStorefrontContent);
    return () => {
      controller.abort();
      window.removeEventListener('ils_homepage_content_updated', loadStorefrontContent);
      window.removeEventListener('ils_storefront_updated', loadStorefrontContent);
    };
  }, []);

  // Guarantee Founder Hierarchy:
  // Row 1: Halloween & Christmas (Upcoming Holiday Priority)
  // Row 2: Cash Candles & Zodiac Cash Candles (Signature Cash Reveals)
  const { row1Cards, row2Cards, allFeaturedCards } = useMemo(() => {
    const cards = homepageConfig.featuredCards || [];

    const resolveCard = (id: string, defaultCard: CuratedCollectionConfig): CuratedCollectionConfig => {
      const found = cards.find((c) => c.id === id);
      if (!found) return defaultCard;
      return {
        ...defaultCard,
        title: found.title || defaultCard.title,
        badge: found.badge || defaultCard.badge,
        tagline: found.tagline || defaultCard.tagline,
        ctaText: found.ctaText || defaultCard.ctaText,
        image: found.image || defaultCard.image,
        itemCount: found.itemCount || defaultCard.itemCount,
      };
    };

    const halloween = resolveCard('halloween', DEFAULT_CURATED_CARDS.halloween);
    const christmas = resolveCard('christmas-candles-1', DEFAULT_CURATED_CARDS['christmas-candles-1']);
    const moneyCandles = resolveCard('cash-money-candles', DEFAULT_CURATED_CARDS['cash-money-candles']);
    const jewelryCandy = resolveCard('jewelry-candy', DEFAULT_CURATED_CARDS['jewelry-candy']);

    return {
      row1Cards: [halloween, christmas],
      row2Cards: [moneyCandles, jewelryCandy],
      allFeaturedCards: [halloween, christmas, moneyCandles, jewelryCandy],
    };
  }, [homepageConfig]);

  const loadSingleCollection = useCallback((colId: string) => {
    const productCollectionHandle = colId === 'halloween' ? 'wax-melts' : colId;

    // Check synchronous cache first
    const cached = productService.getCachedCollectionProducts(productCollectionHandle, 10);
    if (cached && cached.length > 0) {
      setCollectionStates((prev) => ({
        ...prev,
        [colId]: {
          status: 'success',
          products: deduplicateProducts(cached).slice(0, 10),
        },
      }));
    } else {
      setCollectionStates((prev) => {
        if (prev[colId]?.status === 'success' && prev[colId]?.products.length > 0) {
          return prev;
        }
        return {
          ...prev,
          [colId]: {
            status: 'loading',
            products: [],
          },
        };
      });
    }

    productService
      .getProductsByCollection(productCollectionHandle, {
        page: 1,
        limit: 10,
        sort: 'featured',
      })
      .then((res) => {
        const prods = deduplicateProducts(res?.products || []).slice(0, 10);
        setCollectionStates((prev) => ({
          ...prev,
          [colId]: {
            status: prods.length > 0 ? 'success' : 'empty',
            products: prods,
          },
        }));
      })
      .catch((err) => {
        console.warn(`Error fetching products for collection ${colId}:`, err);
        setCollectionStates((prev) => ({
          ...prev,
          [colId]: {
            status: 'error',
            products: [],
            errorMessage: err?.message || 'Failed to load products',
          },
        }));
      });
  }, []);

  // Fetch products for each collection independently in parallel
  useEffect(() => {
    allFeaturedCards.forEach((col) => {
      loadSingleCollection(col.id);
    });
  }, [allFeaturedCards, loadSingleCollection]);

  const handleViewCollection = (handle: string, categoryKey?: string) => {
    const targetHandle = handle === 'halloween' ? 'wax-melts' : handle;

    if (onSelectCollection) {
      onSelectCollection(targetHandle);
    } else if (onSelectCategory && categoryKey) {
      onSelectCategory(categoryKey);
    } else {
      const cleanUrl =
        targetHandle === 'cash-candles' || targetHandle === 'zodiac-cash-money-candles' || targetHandle === 'candles'
          ? `/candles/${targetHandle}`
          : `/${targetHandle}`;
      window.history.pushState(
        { view: 'collection', collectionHandle: targetHandle },
        '',
        cleanUrl
      );
      window.dispatchEvent(new CustomEvent('ils_route_change', { detail: { route: 'collection', handle: targetHandle } }));
      window.dispatchEvent(new PopStateEvent('popstate', { state: { view: 'collection', collectionHandle: targetHandle } }));
    }
  };

  const getProductQuantity = (productId: string) => {
    return cart.reduce((sum, item) => (item.product.id === productId ? sum + item.quantity : sum), 0);
  };

  const handleAddToCart = onAddToCart || ((product: Product) => onSelectProduct?.(product));

  const renderCollectionGrid = (col: CuratedCollectionConfig) => {
    const colState = collectionStates[col.id] || { status: 'loading', products: [] };
    const { status } = colState;
    const prods = deduplicateProducts(colState.products);
    const isCardLoading = status === 'loading' && prods.length === 0;
    const BadgeIcon = col.badgeIcon;
    const testId = `featured-collection-${col.id}`;

    return (
      <div
        key={col.id}
        id={testId}
        data-testid={testId}
        className="mb-10 sm:mb-14 last:mb-0"
      >
        {/* Header (No tabs - clean title & View All CTA, matching Trending structure) */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6 sm:mb-8 pb-4 border-b border-[#f4edf2]">
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left w-full sm:w-auto">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#fff1f2] border border-[#fecdd3] text-[#D30915] text-[10px] sm:text-[11px] font-black uppercase tracking-wider mb-2">
              <BadgeIcon className="w-3.5 h-3.5" />
              <span>{col.badge || 'Curated Collection'}</span>
            </div>

            <h3
              onClick={() => handleViewCollection(col.id, col.categoryKey)}
              className="text-2xl sm:text-3xl font-black text-[#141219] tracking-tight m-0 font-display hover:text-[#D30915] cursor-pointer transition-colors"
            >
              {col.title}
            </h3>
            {col.tagline && (
              <p className="text-xs sm:text-sm text-[#716d77] m-0 mt-1 max-w-xl mx-auto sm:mx-0">
                {col.tagline}
              </p>
            )}
          </div>

          {/* Top View All CTA */}
          <button
            type="button"
            onClick={() => handleViewCollection(col.id, col.categoryKey)}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#D30915] hover:text-[#B60711] hover:underline active:scale-95 transition-all self-center sm:self-end cursor-pointer"
          >
            <span>View All {col.title}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Product Grid - Exactly max 10 products, responsive layout identical to Trending */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4 lg:gap-5">
          {isCardLoading ? (
            Array.from({ length: 10 }).map((_, i) => <ProductCardSkeleton key={i} />)
          ) : status === 'success' && prods.length > 0 ? (
            prods.map((product, index) => (
              <ProductCard
                key={`${col.id}-${product.id || product.slug || product.name}-${index}`}
                product={product}
                cartQuantity={getProductQuantity(product.id)}
                onAddToCart={handleAddToCart}
                onUpdateQuantity={onUpdateQuantity}
                onToggleWishlist={() => onWishlistToggle?.(product)}
                onSelectProduct={onSelectProduct}
                isWishlisted={wishlistSet.has(product.id)}
              />
            ))
          ) : status === 'error' ? (
            <div className="col-span-full py-8 text-center text-sm text-[#716d77] flex flex-col items-center justify-center gap-3">
              <p className="m-0 text-[#716d77]">Unable to load products for this collection right now.</p>
              <button
                type="button"
                onClick={() => loadSingleCollection(col.id)}
                className="px-4 py-2 rounded-lg bg-[#141219] hover:bg-[#D30915] text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="col-span-full py-8 text-center text-sm text-[#716d77]">
              No products found in this collection.
            </div>
          )}
        </div>

        {/* COLLECTION NAME UNDERNEATH & COLLECTION LINK/VIEW ALL */}
        {!isCardLoading && status === 'success' && prods.length > 0 && (
          <div className="mt-8 sm:mt-12 text-center flex flex-col items-center justify-center">
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#716d77] mb-2">
              {col.title}
            </span>
            <button
              type="button"
              onClick={() => handleViewCollection(col.id, col.categoryKey)}
              className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 rounded-full bg-[#141219] hover:bg-[#D30915] text-white font-bold text-xs uppercase tracking-wider transition-all duration-300 shadow-sm hover:shadow-md active:scale-95 cursor-pointer"
            >
              <span>Explore All {col.title}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <section
      id="featured-collections"
      className="relative max-w-[1460px] mx-auto px-2.5 sm:px-6 pt-2 pb-6 sm:pb-10 box-border overflow-hidden"
      aria-label="Featured Collections"
    >
      {/* Row 1: Holiday Collections (Halloween & Christmas) */}
      <div className="mb-10 sm:mb-14">
        {/* Product Grids for Row 1 collections */}
        <div className="space-y-10 sm:space-y-14">
          {row1Cards.map((col) => renderCollectionGrid(col))}
        </div>
      </div>

      {/* Row 2: Signature Money Candles & Jewelry Candy */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 mb-6 pb-2 border-b border-[#eedbe6]/70">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-pink-100 flex items-center justify-center text-[#D30915] shadow-2xs shrink-0">
              <Gem className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#D30915]" />
            </div>
            <h3 className="text-sm sm:text-base font-black text-[#141219] uppercase tracking-wider font-display m-0">
              Signature Money Reveals & Jewelry Treats
            </h3>
          </div>

          <div className="hidden min-[480px]:inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border border-emerald-200">
            <DollarSign className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>Guaranteed Real Cash & Real Jewelry Inside</span>
          </div>
        </div>

        {/* Product Grids for Row 2 collections */}
        <div className="space-y-10 sm:space-y-14">
          {row2Cards.map((col) => renderCollectionGrid(col))}
        </div>
      </div>
    </section>
  );
};
