import React from 'react';
import { Link } from 'react-router-dom';

export interface LibraryItem {
  id: string;
  name: string;
  locality?: string;
  city?: string;
  distanceKm: number;
  monthlyPrice?: number;
  dailyPrice?: number;
  rating?: number;
  totalReviews?: number;
  girlsSafetyScore?: number;
  hasGirlsSection?: boolean;
  acAvailable?: boolean;
  wifiAvailable?: boolean;
  powerBackupAvailable?: boolean;
  amenities?: string[];
  focusedExams?: string[];
  seatingType?: string;
  matchScore?: number;
  availableSeats?: number;
  isFree?: boolean;
  semanticMatchReason?: string;
  photoUrl?: string;
}

interface LibraryCardProps {
  library: LibraryItem;
  matchExplanation?: string;
}

const DEFAULT_PHOTOS = [
  'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1568667256549-094345857637?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&w=800&q=80'
];

export default function LibraryCard({ library, matchExplanation }: LibraryCardProps) {
  const isFree = library.isFree || library.monthlyPrice === 0;

  // Pick photo based on ID hash or provided photoUrl
  const photoIndex = Math.abs(library.id ? library.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : 0) % DEFAULT_PHOTOS.length;
  const photoSrc = library.photoUrl || DEFAULT_PHOTOS[photoIndex];

  const ratingVal = library.rating ?? 4.5;
  const reviewsCount = library.totalReviews ?? (Math.abs(photoIndex * 110 + 150));
  const dailyRate = library.dailyPrice ?? (library.monthlyPrice ? Math.round(library.monthlyPrice / 15) : 60);

  const amenitiesList = library.amenities && library.amenities.length > 0 
    ? library.amenities 
    : [
        library.acAvailable !== false ? 'AC' : null,
        library.wifiAvailable !== false ? 'Wi-Fi' : null,
        library.powerBackupAvailable !== false ? 'Power Backup' : null,
        'Reading Zone'
      ].filter(Boolean) as string[];

  return (
    <Link
      to={`/library/${library.id}`}
      className="group flex flex-col sm:flex-row items-stretch gap-4 p-4 rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/90 hover:border-violet-500/50 hover:shadow-xl dark:hover:shadow-violet-950/20 transition-all duration-300 relative overflow-hidden"
    >
      {/* Photo Thumbnail with Verified Badge */}
      <div className="relative w-full sm:w-48 h-40 sm:h-auto rounded-2xl overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800">
        <img
          src={photoSrc}
          alt={library.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-emerald-600/90 backdrop-blur-md text-white text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 shadow-md">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
          </svg>
          Verified
        </div>
      </div>

      {/* Content Details */}
      <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
        <div>
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-headers group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors truncate">
                {library.name}
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                <span>📍 {library.locality ? `${library.locality}, ` : ''}{library.city || 'Indore'}</span>
                <span>·</span>
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {library.distanceKm ? `${library.distanceKm.toFixed(1)} km` : '1.2 km'}
                </span>
              </div>
            </div>

            {/* Pricing Tag */}
            <div className="text-right shrink-0">
              {isFree ? (
                <span className="px-3 py-1 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black text-xs uppercase tracking-wider border border-emerald-500/30">
                  100% FREE
                </span>
              ) : (
                <div>
                  <span className="font-mono text-slate-900 dark:text-white font-black text-lg">
                    ₹{library.monthlyPrice ?? 999}
                  </span>
                  <span className="text-xs text-slate-500 font-bold"> / month</span>
                  <p className="text-[10px] text-slate-400 font-mono text-right">₹{dailyRate} / day</p>
                </div>
              )}
            </div>
          </div>

          {/* Rating Row */}
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-amber-400 text-xs">⭐</span>
            <span className="text-xs font-black text-slate-900 dark:text-white">{ratingVal.toFixed(1)}</span>
            <span className="text-xs text-slate-400">({reviewsCount} reviews)</span>
            {library.availableSeats !== undefined && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-[10px] border border-blue-500/20">
                {library.availableSeats} seats open
              </span>
            )}
          </div>

          {/* Amenities Badges */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {amenitiesList.slice(0, 4).map(am => (
              <span key={am} className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
                {am}
              </span>
            ))}
          </div>

          {/* Match Explanation */}
          {(library.semanticMatchReason || matchExplanation) && (
            <p className="text-xs text-violet-600 dark:text-violet-300 mt-2 font-medium bg-violet-500/5 dark:bg-violet-500/10 p-2 rounded-xl border border-violet-500/20 flex items-center gap-1.5">
              <span>🧠</span>
              <span className="truncate">{library.semanticMatchReason || matchExplanation}</span>
            </p>
          )}
        </div>

        {/* Action Button Row */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">Verified by EduGlobin</span>
          <button
            type="button"
            className="px-4 py-2 rounded-xl bg-violet-600 group-hover:bg-violet-500 text-white font-extrabold text-xs transition shadow-md shadow-violet-500/20 flex items-center gap-1 cursor-pointer"
          >
            <span>View Details</span>
          </button>
        </div>
      </div>
    </Link>
  );
}

