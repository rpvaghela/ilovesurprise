import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reviewService } from './reviewService';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('reviewService', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads reviews and derives its summary from database responses only', async () => {
    localStorage.setItem('ils_reviews_v1', JSON.stringify([
      { id: 'sample', rating: 5, author: 'Sample customer' },
    ]));
    fetchMock.mockResolvedValue(jsonResponse({
      status: 'success',
      data: {
        reviews: [{
          id: 'review-1',
          productId: 'product-1',
          author: 'Alex R',
          rating: 4,
          date: '2025-05-01T00:00:00.000Z',
          title: 'Good product',
          comment: 'The product arrived as expected.',
          verified: true,
          productName: 'Example product',
        }],
      },
    }));

    const result = await reviewService.getProductReviews('product/1');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/products/product%2F1/reviews');
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0].id).toBe('review-1');
    expect(result.stats).toEqual({
      averageRating: 4,
      totalReviews: 1,
      breakdown: { 5: 0, 4: 1, 3: 0, 2: 0, 1: 0 },
    });
  });

  it('keeps an empty database result empty instead of inventing a rating', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      status: 'success',
      data: { reviews: [] },
    }));

    const result = await reviewService.getProductReviews('product-1');

    expect(result.reviews).toEqual([]);
    expect(result.stats.averageRating).toBe(0);
    expect(result.stats.totalReviews).toBe(0);
  });
});
