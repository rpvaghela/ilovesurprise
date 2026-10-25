import { describe, it, expect } from 'vitest';
import { isScentSelectionExcluded } from './ProductDetails';

describe('isScentSelectionExcluded', () => {
  describe('Cash Money Candles (fixed single-scent candles excluded from scent selection)', () => {
    it('excludes Birthday Cake Cash Money Candle', () => {
      expect(
        isScentSelectionExcluded({
          id: 'prod_birthday-cake-cash-money-candle',
          name: 'Birthday Cake Cash Money Candle',
          slug: 'birthday-cake-cash-money-candle',
          category: 'Cash Money Candles',
        })
      ).toBe(true);
    });

    it('excludes Iced Lemon Cookies Cash Money Candles', () => {
      expect(
        isScentSelectionExcluded({
          id: 'prod_iced-lemon-cookies-cash-money-candles',
          name: 'Iced Lemon Cookies Cash Money Candles',
          slug: 'iced-lemon-cookies-cash-money-candles',
          category: 'Candles',
        })
      ).toBe(true);
    });

    it('excludes products with category Cash Money Candles or cat-cash-money-candles', () => {
      expect(
        isScentSelectionExcluded({
          id: 'custom-1',
          name: 'Golden Fortune Candle',
          slug: 'golden-fortune-candle',
          category: 'Cash Money Candles',
        })
      ).toBe(true);

      expect(
        isScentSelectionExcluded({
          id: 'custom-2',
          name: 'Surprise Cash Jar',
          slug: 'surprise-cash-jar',
          category: 'cat-cash-money-candles',
        })
      ).toBe(true);
    });

    it('excludes handles in approved cash-money-candles collection', () => {
      expect(
        isScentSelectionExcluded({
          id: 'god-always-provides-cash-candle',
          name: 'God Always Provides Cash Candle',
          slug: 'god-always-provides-cash-candle',
          category: 'Candles',
        })
      ).toBe(true);
    });
  });

  describe('Jewellery Candles (must be excluded from scent selection)', () => {
    it('excludes Beach Bum Jewelry Candle (from user screenshot)', () => {
      expect(
        isScentSelectionExcluded({
          id: 'prod_beach-bum-jewelry-candle',
          name: 'Beach Bum Jewelry Candle',
          slug: 'beach-bum-jewelry-candle',
          category: 'Candles',
        })
      ).toBe(true);
    });

    it('excludes New York Giants Game Day Jewelry Candles', () => {
      expect(
        isScentSelectionExcluded({
          id: 'prod_new-orleans-saints-game-day-jewelry-candles-copy',
          name: 'New York Giants Game Day Jewelry Candles',
          slug: 'new-orleans-saints-game-day-jewelry-candles-copy',
          category: 'Jewelry Candles',
        })
      ).toBe(true);
    });

    it('excludes Fresh Cut Roses Jewelry Candle', () => {
      expect(
        isScentSelectionExcluded({
          id: 'fresh-cut-roses-jewelry-candle',
          name: 'Fresh Cut Roses Jewelry Candle',
          slug: 'fresh-cut-roses-jewelry-candle',
          category: 'Candles',
        })
      ).toBe(true);
    });

    it('excludes UK spelling Jewellery Candles', () => {
      expect(
        isScentSelectionExcluded({
          id: 'emerald-sparkle-jewellery-candle',
          name: 'Emerald Sparkle Jewellery Candle',
          slug: 'emerald-sparkle-jewellery-candle',
          category: 'Jewellery Candles',
        })
      ).toBe(true);
    });
  });

  describe('Unrelated products and categories (scent selection must remain active)', () => {
    it('keeps scent options for Zodiac Cash Candles (e.g. Aquarius Zodiac Cash Money Candle)', () => {
      expect(
        isScentSelectionExcluded({
          id: 'prod_aquarius-zodiac-cash-money-candle',
          name: 'Aquarius Zodiac Cash Money Candle',
          slug: 'aquarius-zodiac-cash-money-candle',
          category: 'Cash Candles',
        })
      ).toBe(false);
    });

    it('keeps scent options for products with explicit variants or options in DB', () => {
      expect(
        isScentSelectionExcluded({
          id: 'custom-product-with-variants',
          name: 'Custom Surprise Product',
          slug: 'custom-surprise-product',
          category: 'Cash Money Candles',
          variants: [
            { scent: 'Birthday Cake' },
            { scent: 'French Vanilla' },
          ],
        })
      ).toBe(false);

      expect(
        isScentSelectionExcluded({
          id: 'custom-product-with-options',
          name: 'Special Candle',
          slug: 'special-candle',
          category: 'Jewelry Candles',
          options: [
            { name: 'Scent', values: ['Fresh Cut Roses', 'Lavender Vanilla'] },
          ],
        })
      ).toBe(false);
    });

    it('keeps scent options for Military Cash Candles', () => {
      expect(
        isScentSelectionExcluded({
          id: 'prod_military-cash-candle',
          name: 'Army Veteran Military Cash Candle',
          slug: 'army-veteran-military-cash-candle',
          category: 'Military Cash Candles',
        })
      ).toBe(false);
    });

    it('keeps scent options for Funny Money Candles', () => {
      expect(
        isScentSelectionExcluded({
          id: 'prod_funny-candle',
          name: 'You Are Awesome Funny Cash Candle',
          slug: 'you-are-awesome-funny-candle',
          category: 'Funny Cash Candles',
        })
      ).toBe(false);
    });

    it('keeps scent options for Cereal Bowl Candles', () => {
      expect(
        isScentSelectionExcluded({
          id: 'prod_cereal-candle',
          name: 'Frooty Loops Cereal Bowl Candle',
          slug: 'frooty-loops-cereal-bowl-candle',
          category: 'Cereal Bowl Candles',
        })
      ).toBe(false);
    });

    it('keeps scent options for general scented candles', () => {
      expect(
        isScentSelectionExcluded({
          id: 'prod_scented_candle',
          name: 'French Vanilla Aromatherapy Candle',
          slug: 'french-vanilla-aromatherapy-candle',
          category: 'Scented Candles',
        })
      ).toBe(false);
    });

    it('keeps scent options for Wax Melts and Giant Jewelry Wax Melts', () => {
      expect(
        isScentSelectionExcluded({
          id: 'prod_wax_melt',
          name: 'Lavender Fields Wax Melt',
          slug: 'lavender-fields-wax-melt',
          category: 'Wax Melts',
        })
      ).toBe(false);

      expect(
        isScentSelectionExcluded({
          id: 'prod_giant_jewelry_wax_melt',
          name: 'Giant Jewelry Wax Melts',
          slug: 'giant-jewelry-wax-melts',
          category: 'Wax Melts',
        })
      ).toBe(false);
    });

    it('keeps scent options for Bath Bombs', () => {
      expect(
        isScentSelectionExcluded({
          id: 'prod_bath_bomb',
          name: 'Rose Gold Jewelry Bath Bomb',
          slug: 'rose-gold-jewelry-bath-bomb',
          category: 'Bath & Body',
        })
      ).toBe(false);

      expect(
        isScentSelectionExcluded({
          id: 'prod_cash_bath_bomb',
          name: 'Million Dollar Cash Bath Bomb',
          slug: 'million-dollar-cash-bath-bomb',
          category: 'Bath & Body',
        })
      ).toBe(false);
    });

    it('keeps scent options for Greeting Candles', () => {
      expect(
        isScentSelectionExcluded({
          id: 'prod_greeting_candle',
          name: 'Follow Your Dreams Jewelry Greeting Candle',
          slug: 'follow-your-dreams-jewelry-greeting-candle',
          category: 'Greeting Candles',
        })
      ).toBe(false);
    });

    it('keeps scent options for Soaps and Slimes', () => {
      expect(
        isScentSelectionExcluded({
          id: 'prod_soap',
          name: 'Cash Money Goat Milk Soap',
          slug: 'cash-money-goat-milk-soap',
          category: 'Soaps',
        })
      ).toBe(false);

      expect(
        isScentSelectionExcluded({
          id: 'prod_slime',
          name: 'Birthday Cake Jewelry Slime',
          slug: 'birthday-cake-jewelry-slime',
          category: 'Slimes',
        })
      ).toBe(false);
    });
  });
});

describe('getProductDropdownStatus (Spreadsheet Audit Source of Truth)', () => {
  it('identifies dropdown = 0 for reference cash money candle', async () => {
    const { getProductDropdownStatus } = await import('../data/productDropdownAudit');
    expect(
      getProductDropdownStatus({
        id: 'prod_birthday-cake-cash-money-candle',
        slug: 'birthday-cake-cash-money-candle',
        name: 'Birthday Cake Cash Money Candle',
      })
    ).toBe(0);
  });

  it('identifies dropdown = 1 for reference jewelry candle', async () => {
    const { getProductDropdownStatus } = await import('../data/productDropdownAudit');
    expect(
      getProductDropdownStatus({
        id: 'prod_back-and-body-hurts-happy-birthday-jewelry-candle',
        slug: 'back-and-body-hurts-happy-birthday-jewelry-candle',
        name: 'Back and Body Hurts Happy Birthday Jewelry Candle',
      })
    ).toBe(1);
  });

  it('identifies dropdown = 1 for customizable scent cash money candle', async () => {
    const { getProductDropdownStatus } = await import('../data/productDropdownAudit');
    expect(
      getProductDropdownStatus({
        id: 'prod_happy-birthday-to-you-cash-money-candle',
        slug: 'happy-birthday-to-you-cash-money-candle',
        name: 'Happy Birthday To You Cash Money Candle',
      })
    ).toBe(1);
  });

  it('identifies dropdown = 1 for photo gift products', async () => {
    const { getProductDropdownStatus } = await import('../data/productDropdownAudit');
    expect(
      getProductDropdownStatus({
        id: 'prod_photo-cash-candle',
        slug: 'photo-cash-candle',
        name: 'Photo Cash Candle',
      })
    ).toBe(1);
  });

  it('returns null for unassessed products not covered in audit', async () => {
    const { getProductDropdownStatus } = await import('../data/productDropdownAudit');
    expect(
      getProductDropdownStatus({
        id: 'prod_totally-unknown-product-xyz',
        slug: 'totally-unknown-product-xyz',
        name: 'Unknown Mysterious Product',
      })
    ).toBeNull();
  });
});

describe('Scent Sanitization & Founder Scents Quality', () => {
  it('FOUNDER_SCENTS does not contain any unwanted holiday priority or artificial scent words', async () => {
    const { FOUNDER_SCENTS } = await import('./ProductDetails');
    const banned = [
      'holiday priority',
      'halloween priority',
      'spooky spiced apple cider',
      'midnight marshmallow cauldron',
    ];
    for (const scent of FOUNDER_SCENTS) {
      for (const b of banned) {
        expect(scent.toLowerCase()).not.toContain(b);
      }
    }
  });

  it('productService filters out banned scent notes from products', async () => {
    const { productService } = await import('../services/productService');
    const transformed = (productService as any).transformProductRow?.({
      id: 'test-product',
      name: 'Test Scented Product',
      slug: 'test-scented-product',
      category: 'Candles',
      price: 24.99,
      scentNotes: [
        '1. Pumpkin Spice 🎃 (Holiday Priority Scent)',
        '2. Spooky Spiced Apple Cider 🍎',
        '3. Midnight Marshmallow Cauldron 👻',
        'French Vanilla',
        'Birthday Cake',
      ],
    });

    if (transformed?.scentNotes) {
      expect(transformed.scentNotes).not.toContain('1. Pumpkin Spice 🎃 (Holiday Priority Scent)');
      expect(transformed.scentNotes).not.toContain('2. Spooky Spiced Apple Cider 🍎');
      expect(transformed.scentNotes).not.toContain('3. Midnight Marshmallow Cauldron 👻');
      expect(transformed.scentNotes).toEqual(['French Vanilla', 'Birthday Cake']);
    }
  });
});

describe('Jewellery Candle Ring Size & Surprise Me Reveal Configuration', () => {
  it('RING_SIZES provides standard US sizes 5 through 11 for dropdown selection', async () => {
    const { RING_SIZES } = await import('./ProductDetails');
    expect(RING_SIZES).toEqual([5, 6, 7, 8, 9, 10, 11]);
  });

  it('JEWELRY_TYPES includes Surprise Me along with jewelry pieces', async () => {
    const { JEWELRY_TYPES } = await import('./ProductDetails');
    expect(JEWELRY_TYPES).toContain('Surprise Me');
    expect(JEWELRY_TYPES).toContain('Ring');
    expect(JEWELRY_TYPES).toContain('Necklace');
    expect(JEWELRY_TYPES).toContain('Earrings');
    expect(JEWELRY_TYPES).toContain('Bracelet');
  });

  it('isJewelryOrRingOption identifies Ring, Size, and Surprise options to prevent duplicate open lists', async () => {
    const { isJewelryOrRingOption } = await import('./ProductDetails');
    expect(isJewelryOrRingOption({ name: 'Ring Size', values: ['5', '6', '7'] })).toBe(true);
    expect(isJewelryOrRingOption({ name: 'Jewelry Reveal Type', values: ['Ring', 'Surprise Me'] })).toBe(true);
    expect(isJewelryOrRingOption({ name: 'Choose Your Surprise', values: ['Ring', 'Necklace'] })).toBe(true);
    expect(isJewelryOrRingOption({ name: 'Size', values: ['5', '6', '7', '8', '9', '10'] })).toBe(true);
    expect(isJewelryOrRingOption({ name: 'Color', values: ['Red', 'Blue'] })).toBe(false);
    expect(isJewelryOrRingOption({ name: 'Wick', values: ['Single Wick', 'Double Wick'] })).toBe(false);
  });

  it('SURPRISE_ME_OPTIONS matches reference website dropdown options', async () => {
    const { SURPRISE_ME_OPTIONS } = await import('./ProductDetails');
    expect(SURPRISE_ME_OPTIONS).toEqual([
      'Surprise me!',
      'Bracelet',
      'Earrings',
      'Necklace',
      'Ring Size 5',
      'Ring Size 6',
      'Ring Size 7',
      'Ring Size 8',
      'Ring Size 9',
      'Ring Size 10',
      'Ring Size 11',
    ]);
  });
});

describe('Database Scent Variety Audit & Validation', () => {
  it('ZODIAC_SCENT_OPTIONS contains the authoritative 26 scent options requested', async () => {
    const { ZODIAC_SCENT_OPTIONS } = await import('./ProductDetails');
    expect(ZODIAC_SCENT_OPTIONS).toHaveLength(26);
    expect(ZODIAC_SCENT_OPTIONS).toContain('BIRTHDAY CAKE');
    expect(ZODIAC_SCENT_OPTIONS).toContain('BAHAMA MAMA (TROPICAL)');
    expect(ZODIAC_SCENT_OPTIONS).toContain('BAKED APPLE PIE');
    expect(ZODIAC_SCENT_OPTIONS).toContain('BLACK RASPBERRY VANILLA');
    expect(ZODIAC_SCENT_OPTIONS).toContain('AMAZON RAINFOREST (BASIL SAGE AND MINT)');
    expect(ZODIAC_SCENT_OPTIONS).toContain('CALMING LAVENDER');
    expect(ZODIAC_SCENT_OPTIONS).toContain('CINNAMON APPLE');
    expect(ZODIAC_SCENT_OPTIONS).toContain('BLUEBERRY MUFFIN');
    expect(ZODIAC_SCENT_OPTIONS).toContain('CINNAMON BUN');
    expect(ZODIAC_SCENT_OPTIONS).toContain('CHOCOLATE CHIP COOKIES');
    expect(ZODIAC_SCENT_OPTIONS).toContain('COTTON CANDY');
    expect(ZODIAC_SCENT_OPTIONS).toContain('ALOHA! (TROPICAL)');
    expect(ZODIAC_SCENT_OPTIONS).toContain('LAVENDER VANILLA');
    expect(ZODIAC_SCENT_OPTIONS).toContain('BEDTIME SPA');
    expect(ZODIAC_SCENT_OPTIONS).toContain('FRESH LINEN');
    expect(ZODIAC_SCENT_OPTIONS).toContain('FRESH CUT ROSES');
    expect(ZODIAC_SCENT_OPTIONS).toContain('FRENCH VANILLA');
    expect(ZODIAC_SCENT_OPTIONS).toContain('COZY CABIN');
    expect(ZODIAC_SCENT_OPTIONS).toContain('STRAWBERRY FIELDS');
    expect(ZODIAC_SCENT_OPTIONS).toContain('APPLE MANGO MARTINI');
    expect(ZODIAC_SCENT_OPTIONS).toContain('JAMAICAN ME CRAZY!');
    expect(ZODIAC_SCENT_OPTIONS).toContain('BOMBSHELL (INSPIRED BY VS)');
    expect(ZODIAC_SCENT_OPTIONS).toContain('FRESH BAKED SUGAR COOKIES');
    expect(ZODIAC_SCENT_OPTIONS).toContain('HONEYSUCKLE');
    expect(ZODIAC_SCENT_OPTIONS).toContain('SWEET PEA');
    expect(ZODIAC_SCENT_OPTIONS).toContain('BETTER THAN SEX (CHOCOLATE)');
  });

  it('removes scent variety for single-scent items (e.g. Birthday Cake Cash Money Candle)', async () => {
    const { mapRowToProduct } = await import('../services/productService');
    const product = mapRowToProduct({
      id: 'prod_birthday-cake-cash-money-candle',
      name: 'Birthday Cake Cash Money Candle',
      slug: 'birthday-cake-cash-money-candle',
      category: 'Cash Money Candles',
      scentNotes: ['BIRTHDAY CAKE'],
      options: [],
    });

    expect(product.options?.some((o) => /scent/i.test(o.name))).toBeFalsy();
    expect(product.scentNotes).toEqual([]);
  });

  it('removes scent variety from candy and chocolate items (e.g. 100% Mood Booster Cash Candy)', async () => {
    const { mapRowToProduct } = await import('../services/productService');
    const product = mapRowToProduct({
      id: '100-mood-booster-cash-candy',
      name: '100% Mood Booster Cash Candy',
      slug: '100-mood-booster-cash-candy',
      category: 'Cash Candy',
      options: [
        { name: 'Candy', values: ['Skittles', 'M & Ms', 'Sour Patch Kids'] },
      ],
    });

    expect(product.options?.some((o) => /scent/i.test(o.name))).toBeFalsy();
    expect(product.options?.find((o) => o.name === 'Candy')?.values).toEqual([
      'Skittles',
      'M & Ms',
      'Sour Patch Kids',
    ]);
    expect(product.scentNotes).toEqual([]);
  });

  it('removes scent variety from cereal bowl candles that only have Toppings options', async () => {
    const { mapRowToProduct } = await import('../services/productService');
    const product = mapRowToProduct({
      id: 'a-day-at-the-spa-cereal-bowl-cash-luxury-candles',
      name: 'A Day At The Spa Cereal Bowl Cash Luxury Candles',
      slug: 'a-day-at-the-spa-cereal-bowl-cash-luxury-candles',
      category: 'Candles',
      options: [
        { name: 'Toppings', values: ['Puppy Paws', 'Kitty Cats', 'Mini Donuts'] },
      ],
    });

    expect(product.options?.some((o) => /scent/i.test(o.name))).toBeFalsy();
    expect(product.options?.find((o) => o.name === 'Toppings')?.values).toEqual([
      'Puppy Paws',
      'Kitty Cats',
      'Mini Donuts',
    ]);
  });

  it('retains authentic database scent options when present in options', async () => {
    const { mapRowToProduct } = await import('../services/productService');
    const dbScents = ['Backed Apple Pie', 'Bahama Mama', 'Birthday Cake', 'Black Raspberry Vanilla'];
    const product = mapRowToProduct({
      id: '1-doge-1-lambo-crypto-greeting-candles',
      name: '1 Doge = 1 Lambo Crypto Greeting Candles',
      slug: '1-doge-1-lambo-crypto-greeting-candles',
      category: 'Greeting Candles',
      options: [
        { name: 'Scent', values: dbScents },
      ],
    });

    const scentOpt = product.options?.find((o) => /scent/i.test(o.name));
    expect(scentOpt).toBeDefined();
    expect(scentOpt?.values).toEqual(dbScents);
    expect(product.scentNotes).toEqual(dbScents);
  });

  it('retains authentic 26 scents for Zodiac Cash Money Candles', async () => {
    const { mapRowToProduct, ZODIAC_SCENT_OPTIONS } = await import('../services/productService');
    const product = mapRowToProduct({
      id: 'prod_aquarius-zodiac-cash-money-candle',
      name: 'Aquarius Zodiac Cash Money Candle',
      slug: 'aquarius-zodiac-cash-money-candle',
      category: 'Cash Candles',
    });

    expect(product.options?.find((o) => /scent/i.test(o.name))?.values).toEqual(ZODIAC_SCENT_OPTIONS);
    expect(product.scentNotes).toHaveLength(26);
  });

  describe('Website reference products with "Choose your scent" option', () => {
    it('sets "Choose your scent" option for I Got It From My Mama! Jewelry Greeting Candle', async () => {
      const { mapRowToProduct } = await import('../services/productService');
      const product = mapRowToProduct({
        id: 'i-got-it-from-my-mama-jewelry-greeting-candle',
        name: 'I Got It From My Mama! Jewelry Greeting Candle',
        slug: 'i-got-it-from-my-mama-jewelry-greeting-candle',
        category: 'Jewelry Greeting Candles',
        options: [
          { name: 'Jewelry Surprise', values: ['Surprise me!', 'Bracelet', 'Necklace'] },
          { name: 'Scent', values: ['Bahama Mama', 'Baked Apple Pie', 'Birthday Cake'] },
        ],
      });

      const scentOpt = product.options?.find((o) => /scent/i.test(o.name));
      expect(scentOpt).toBeDefined();
      expect(scentOpt?.name).toBe('Choose your scent');
      expect(scentOpt?.values).toHaveLength(3);
    });

    it('sets "Choose your scent" option for Gojou, Satoru Anime Candle', async () => {
      const { mapRowToProduct } = await import('../services/productService');
      const product = mapRowToProduct({
        id: 'gojou-satoru-anime-candle',
        name: 'Gojou, Satoru Anime Candle',
        slug: 'gojou-satoru-anime-candle',
        category: 'Anime Candles',
        options: [
          { name: 'Choose Your Scent', values: ['Characters Scent', 'Bahama Mama', 'Baked Apple Pie'] },
        ],
      });

      const scentOpt = product.options?.find((o) => /scent/i.test(o.name));
      expect(scentOpt).toBeDefined();
      expect(scentOpt?.values).toContain('Characters Scent');
    });

    it('sets "Choose your scent" option for Nailed It! Funny Candles', async () => {
      const { mapRowToProduct } = await import('../services/productService');
      const product = mapRowToProduct({
        id: 'nailed-it-funny-candles',
        name: 'Nailed It! Funny Candles',
        slug: 'nailed-it-funny-candles',
        category: 'Funny Candles',
        options: [
          { name: 'CHOOSE YOUR SCENT', values: ['Bahama Mama', 'Baked Apple Pie', 'Vanilla'] },
        ],
      });

      const scentOpt = product.options?.find((o) => /scent/i.test(o.name));
      expect(scentOpt).toBeDefined();
      expect(scentOpt?.values).toHaveLength(3);
    });

    it('sets "Choose your scent" option for Greetings From Nevada', async () => {
      const { mapRowToProduct } = await import('../services/productService');
      const product = mapRowToProduct({
        id: 'greetings-from-nevada-greetings-from-candles',
        name: 'Greetings From Nevada',
        slug: 'greetings-from-nevada-greetings-from-candles',
        category: 'Greetings From Candles',
        options: [
          { name: 'Pick a Choose Your Jewelry', values: ['Surprise me!'] },
          { name: 'Choose Your Scent', values: ['Backed Apple Pie', 'Bahama Mama', 'Birthday Cake'] },
        ],
      });

      const scentOpt = product.options?.find((o) => /scent/i.test(o.name));
      expect(scentOpt).toBeDefined();
      expect(scentOpt?.values).toContain('Backed Apple Pie');
    });
  });
});
