import type { Review } from '../types';
import { apiClient, type ApiResponse } from './apiClient';

interface ApiReview {
  id: string;
  productId: string;
  author: string;
  rating: number;
  date: string;
  title: string;
  comment: string;
  verified: boolean;
  productName: string;
}

interface ReviewListResponse {
  reviews: ApiReview[];
}

function toReview(review: ApiReview): Review {
  return {
    ...review,
    date: review.date.slice(0, 10),
  };
}

function reviewStats(reviews: Review[]) {
  const breakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach((review) => {
    const rating = Math.min(5, Math.max(1, Math.round(review.rating)));
    breakdown[rating] += 1;
  });

  return {
    averageRating: reviews.length
      ? Number((reviews.reduce((total, review) => total + review.rating, 0) / reviews.length).toFixed(1))
      : 0,
    totalReviews: reviews.length,
    breakdown,
  };
}

async function fetchReviews(endpoint: string): Promise<Review[]> {
  const response = await apiClient.get<ApiResponse<ReviewListResponse>>(endpoint);
  const reviews = response.data?.reviews;
  if (!Array.isArray(reviews)) {
    throw new Error('The reviews service returned an invalid response.');
  }
  return reviews.map(toReview);
}

export const reviewService = {
  async getProductReviews(productId: string): Promise<{
    reviews: Review[];
    stats: { averageRating: number; totalReviews: number; breakdown: Record<number, number> };
  }> {
    const reviews = await fetchReviews(
      `/api/products/${encodeURIComponent(productId)}/reviews`
    );
    return { reviews, stats: reviewStats(reviews) };
  },

  async getRecentReviews(limit = 12): Promise<Review[]> {
    return fetchReviews(`/api/products/reviews?limit=${encodeURIComponent(String(limit))}`);
  },

  async createReview(data: {
    productId: string;
    rating: number;
    title: string;
    comment: string;
  }): Promise<Review> {
    const response = await apiClient.post<ApiResponse<{ review: ApiReview }>>(
      `/api/products/${encodeURIComponent(data.productId)}/reviews`,
      {
        rating: data.rating,
        title: data.title,
        comment: data.comment,
      }
    );
    const review = response.data?.review;
    if (!review) {
      throw new Error('The review could not be saved. Please try again.');
    }
    return toReview(review);
  },
};
