import { describe, expect, it } from 'vitest';
import { getUnifiedCatalog, productService } from './productService';

const animeCandleImage =
  'https://cdn.shopify.com/s/files/1/0172/4672/products/10_Mockup_Jewelry_JewelryCandles_e7df548c-3142-457f-a401-200681ffb061.jpg?v=1649138122';
const funnyCandleImage =
  'https://cdn.shopify.com/s/files/1/0172/4672/products/75_Mockup_Jewelry_JewelryCandles_5d4a6586-9d1d-4450-b124-9fc8b2770291.jpg?v=1655831614';
const goatMilkSoapImage =
  'https://cdn.shopify.com/s/files/1/0172/4672/files/happy_birthday_to_you_goat_milk_soap.jpg?v=1765692096';
const backAndBodyJewelryCandleImage =
  'https://cdn.shopify.com/s/files/1/0172/4672/files/back-and-body-hurts-happy-birthday-jewelry-candle-two-flames.png?v=1791140460';

describe('jewelry collection', () => {
  it('uses the database image and real review totals for the Back and Body jewelry candle fallback', () => {
    const product = getUnifiedCatalog().find(
      (item) => item.slug === 'back-and-body-hurts-happy-birthday-jewelry-candle'
    );

    expect(product).toMatchObject({
      image: backAndBodyJewelryCandleImage,
      rating: 0,
      reviewCount: 0,
    });
  });

  it('routes Jewelry to the real Jewelry collection in the catalog', async () => {
    const collection = await productService.getCollectionByHandle('jewelry');

    expect(collection).toMatchObject({
      handle: 'jewelry-surprise-mystery-boxes',
      title: 'Jewelry',
      productsCount: 8,
      imageUrl: 'https://cdn.shopify.com/s/files/1/0172/4672/files/mjb.png?v=1763934706',
    });

  });

  it('keeps Jewelry Candles as a separate collection', async () => {
    const collection = await productService.getCollectionByHandle('jewelry-candles');

    expect(collection).toMatchObject({
      handle: 'jewelry-candles',
      title: 'Jewelry Candles',
    });
  });

  describe('collection banner images', () => {
    it('uses the database Goat Milk soap image for the canonical collection and aliases', async () => {
      const canonical = await productService.getCollectionByHandle('money-soaps');
      const alias = await productService.getCollectionByHandle('goat-milk-cash-money-soaps');

      expect(canonical?.imageUrl).toBe(goatMilkSoapImage);
      expect(alias?.imageUrl).toBe(goatMilkSoapImage);
    });

    it('uses the Anime candle image from the database, not the Coke can fallback', async () => {
      const collection = await productService.getCollectionByHandle('cash-anime-candles');

      expect(collection?.imageUrl).toBe(animeCandleImage);
    });

    it('uses the Funny candle image from the database, not the Coke can fallback', async () => {
      const collection = await productService.getCollectionByHandle('funny-candle');

      expect(collection?.imageUrl).toBe(funnyCandleImage);
    });
  });
});
