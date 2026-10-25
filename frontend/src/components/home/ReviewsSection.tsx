import React, { useState, useEffect } from 'react';
import { Star, CheckCircle, Gift, PackageCheck } from 'lucide-react';
import type { Review } from '../../types';
import { Skeleton } from '../ui/Skeleton';
import { reviewService } from '../../services/reviewService';

interface ReviewsSectionProps {
  isLoading?: boolean;
}

export const ReviewsSection: React.FC<ReviewsSectionProps> = React.memo(({ isLoading = false }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);
  const [reviewLoadError, setReviewLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    reviewService.getRecentReviews().then((recentReviews) => {
      if (isMounted) setReviews(recentReviews);
    }).catch((error: unknown) => {
      if (isMounted) {
        setReviewLoadError(error instanceof Error ? error.message : 'Reviews could not be loaded.');
      }
    }).finally(() => {
      if (isMounted) setIsLoadingReviews(false);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section id="reviews" className="max-w-[1460px] mx-auto px-3 sm:px-6 py-4 sm:py-6 overflow-hidden">

      {/* Master Customer Reveal & Social Proof Showcase Card */}
      <div className="relative rounded-[24px] sm:rounded-[30px] border border-[#ebd2e2] bg-gradient-to-br from-[#fff1f2] via-[#fffafc] to-[#fbf6ff] p-5 sm:p-7 lg:p-8 shadow-[0_16px_45px_rgba(50,31,63,0.08)] overflow-hidden">

        {/* Soft Ambient Radial Backlight */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#D30915]/8 rounded-full blur-3xl pointer-events-none" />

        {/* Section Header: Title, Subtitle & Trust Rating Summary */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-6 z-10 relative">

          <div className="max-w-2xl">
            {/* Top Eyebrow Tag */}
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#D30915]/10 text-[#D30915] text-[10px] sm:text-[11px] font-black uppercase tracking-wider mb-2.5 shadow-2xs">
              <span>Verified customer reviews</span>
            </div>

            {/* Main Headline */}
            <h2 className="text-2xl sm:text-3xl lg:text-[34px] font-black text-[#141219] tracking-tight leading-snug hero-title-font m-0 mb-2">
              What customers say
            </h2>

            {/* Subtext */}
            <p className="text-xs sm:text-sm lg:text-[14px] text-[#55505a] leading-relaxed m-0 font-medium">
              Reviews shown here are from customers with a paid, delivered order.
            </p>
          </div>

          {/* Real review count */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 p-3 sm:p-3.5 rounded-[18px] bg-white/95 backdrop-blur-md border border-[#ebdce6] shadow-sm shrink-0">
            <span className="text-sm font-bold text-[#141219]">
              {reviews.length > 0
                ? `${reviews.length} recent verified review${reviews.length === 1 ? '' : 's'}`
                : 'No reviews yet'}
            </span>
          </div>

        </div>

        {/* Dynamic Responsive Reviews Grid */}
        {isLoading || isLoadingReviews ? (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4 mb-6"
            role="status"
            aria-label="Loading customer reviews"
          >
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="p-4 rounded-[20px] bg-white border border-[#eedbe6] shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-full bg-gray-700 skeleton-shimmer shrink-0" />
                      <div className="space-y-1">
                        <Skeleton className="h-3.5 w-24 rounded-md" />
                        <Skeleton className="h-2.5 w-16 rounded-md" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-4/5 rounded-md mb-2" />
                  <Skeleton className="h-3 w-full rounded-md mb-1.5" />
                  <Skeleton className="h-3 w-3/4 rounded-md mb-3" />
                </div>
                <Skeleton className="h-7 w-full rounded-[10px]" />
              </div>
            ))}
          </div>
        ) : reviewLoadError ? (
          <div role="alert" className="py-10 px-4 rounded-[20px] bg-rose-50 border border-rose-200 text-center mb-6">
            <p className="text-sm font-semibold text-rose-800 m-0">{reviewLoadError}</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="py-12 px-4 rounded-[20px] bg-white border border-[#eedbe6] text-center mb-6">
            <Gift className="w-10 h-10 text-[#D30915] mx-auto mb-3 opacity-60" />
            <h3 className="text-base sm:text-lg font-black text-[#141219] mb-1 font-display">
              No verified reviews yet
            </h3>
            <p className="text-xs sm:text-sm text-[#716d77] max-w-md mx-auto">
              Reviews will appear here after a customer with a paid, delivered order shares feedback.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4 mb-6">
            {reviews.map((review) => {
              return (
                <div
                  key={review.id}
                  className="p-4 rounded-[20px] bg-white border border-[#eedbe6] shadow-[0_8px_24px_rgba(50,31,63,0.04)] hover:shadow-[0_16px_36px_rgba(211, 9, 21,0.12)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group"
                >
                  <div>

                    {/* Top Customer Info Row */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          aria-hidden="true"
                          className="w-10 h-10 rounded-full border border-[#fecdd3] bg-[#fff1f2] text-[#D30915] flex items-center justify-center font-bold shrink-0"
                        >
                          {review.author.charAt(0).toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <strong className="text-xs font-black text-[#141219] truncate">
                              {review.author}
                            </strong>
                            {review.verified && (
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 fill-emerald-100 shrink-0" />
                            )}
                          </div>
                          <span className="text-[10px] text-[#716d77] block truncate">
                            Verified purchase | {review.date}
                          </span>
                        </div>
                      </div>

                      {/* 5-Star Rating Pill */}
                      <div className="flex items-center text-amber-400 bg-amber-50/80 px-1.5 py-0.5 rounded-full border border-amber-200 shrink-0">
                        {[...Array(review.rating)].map((_, i) => (
                          <Star key={i} className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                    </div>

                    {/* Review Title with Quotes */}
                    {review.title && (
                      <h4 className="text-xs sm:text-[13px] font-black text-[#141219] leading-snug m-0 mb-1.5 group-hover:text-[#D30915] transition-colors line-clamp-2">
                        {review.title}
                      </h4>
                    )}

                    {/* Review Text */}
                    <p className="text-[11px] sm:text-xs text-[#55505a] leading-relaxed m-0 mb-3.5 line-clamp-3 font-medium">
                      {review.comment}
                    </p>

                  </div>

                  <div>

                    {/* Product Footer */}
                    <div className="pt-2 border-t border-[#f4edf2] flex items-center justify-between text-[10px] text-[#716d77]">
                      <div className="flex items-center gap-1.5 truncate">
                        <PackageCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate font-semibold">{review.productName}</span>
                      </div>
                      {review.verified && (
                        <span className="text-emerald-700 font-black bg-emerald-50 px-1.5 py-0.5 rounded-full shrink-0">
                          Verified
                        </span>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </section>
  );
});

ReviewsSection.displayName = 'ReviewsSection';
