import React from 'react';
import { Link } from 'react-router-dom';

export interface LibraryItem {
  id: string;
  name: string;
  locality?: string;
  city?: string;
  distanceKm: number;
  monthlyPrice?: number;
  rating?: number;
  girlsSafetyScore?: number;
  hasGirlsSection?: boolean;
  acAvailable?: boolean;
  amenities?: string[];
  focusedExams?: string[];
  seatingType?: string;
  matchScore?: number;
  availableSeats?: number;
  isFree?: boolean;
  semanticMatchReason?: string;
}

interface LibraryCardProps {
  library: LibraryItem;
  matchExplanation?: string;
}

export default function LibraryCard({ library, matchExplanation }: LibraryCardProps) {
  const isFree = library.isFree || library.monthlyPrice === 0;

  return (
    <Link
      to={`/library/${library.id}`}
      className="group flex flex-col justify-between p-5 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 hover:border-violet-500/50 hover:shadow-lg dark:hover:shadow-violet-950/20 transition-all duration-300"
    >
      <div>
        <div className="flex justify-between items-start mb-2 gap-2">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white font-headers group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
              {library.name}
            </h3>
            <p className="text-xs text-slate-500">
              {library.locality ? `${library.locality}, ` : ''}{library.city || 'Central City'} · {library.distanceKm ? `${library.distanceKm.toFixed(1)} km away` : 'Nearby'}
            </p>
          </div>

          <div className="text-right">
            {isFree ? (
              <span className="inline-block px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs uppercase tracking-wider border border-emerald-500/30">
                100% Free Space
              </span>
            ) : (
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-base">
                ₹{library.monthlyPrice ?? 0}<span className="text-xs text-slate-400">/mo</span>
              </span>
            )}
          </div>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5 mt-3 text-xs">
          {library.availableSeats !== undefined && (
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium border border-blue-500/20">
              {library.availableSeats} seats open
            </span>
          )}
          {library.acAvailable && (
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-medium border border-cyan-500/20">
              AC
            </span>
          )}
          {library.hasGirlsSection && (
            <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium border border-rose-500/20">
              Girls Safe · {library.girlsSafetyScore ?? 95}/100
            </span>
          )}
          {library.rating && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium border border-amber-500/20">
              ★ {library.rating.toFixed(1)}
            </span>
          )}
        </div>

        {/* Amenities chips */}
        {library.amenities && library.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2.5">
            {library.amenities.slice(0, 3).map(am => (
              <span key={am} className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {am}
              </span>
            ))}
            {library.amenities.length > 3 && (
              <span className="text-[11px] text-slate-400">+{library.amenities.length - 3} more</span>
            )}
          </div>
        )}

        {/* Match Explanation / Semantic Match Reason */}
        {(library.semanticMatchReason || matchExplanation) && (
          <p className="text-xs text-violet-600 dark:text-violet-300 mt-2.5 font-medium bg-violet-500/5 dark:bg-violet-500/10 p-2 rounded-lg border border-violet-500/20 flex items-center gap-1.5">
            <span>🧠</span>
            <span>{library.semanticMatchReason || matchExplanation}</span>
          </p>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-semibold text-violet-600 dark:text-violet-400">
        <span>View Details & Seat Map</span>
        <span>→</span>
      </div>
    </Link>
  );
}
