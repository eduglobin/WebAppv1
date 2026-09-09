import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import StudentDashboardPage from './StudentDashboardPage';
import OwnerPortalPage from './OwnerPortalPage';
import AdminPortalPage from './AdminPortalPage';

interface Library {
  id: string;
  name: string;
  distanceKm: number;
  monthlyPrice: number;
  rating: number;
  girlsSafetyScore: number;
  acAvailable: boolean;
  amenities: string[];
  focusedExams: string[];
  seatingType: string;
  hasGirlsSection: boolean;
  locality: string;
  city?: string;
  isFree?: boolean;
  lat: number;
  lng: number;
  matchScore: number;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

export default function LandingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [featuredLibraries, setFeaturedLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const checkAuthAndFeatured = async () => {
      try {
        // 1. Check logged-in user role
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          try {
            const res = await axios.get(`${API_BASE}/api/v1/me`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (res.data?.success && res.data?.data) {
              setUserRole(res.data.data.role);
            }
          } catch (e) {
            console.warn('Session verification failed on landing page:', e);
          }
        }

        // 2. Fetch featured libraries for guests
        const response = await axios.get(`${API_BASE}/api/v1/libraries/search?sortBy=RATING&limit=6`);
        if (response.data && response.data.success) {
          setFeaturedLibraries(response.data.data);
        }
      } catch (error) {
        console.error('Error fetching featured libraries:', error);
      } finally {
        setLoading(false);
      }
    };
    checkAuthAndFeatured();
  }, []);

  // When a student is logged in, show student dashboard
  if (userRole === 'STUDENT') {
    return <StudentDashboardPage />;
  }
  // When an owner is logged in, show owner portal
  if (userRole === 'LIBRARY_OWNER') {
    return <OwnerPortalPage />;
  }
  // When an admin is logged in, show central admin portal directly
  if (userRole === 'SUPER_ADMIN' || userRole === 'STAFF') {
    return <AdminPortalPage />;
  }

  const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'STAFF';

  return (
    <div className="min-h-screen bg-[#f6f8fc] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#eef2f9] via-white to-[#f6f8fc] dark:bg-slate-950 dark:from-indigo-950 dark:via-slate-950 dark:to-slate-950 text-slate-800 dark:text-slate-100 flex flex-col relative overflow-hidden transition-colors duration-300">
      <Navbar />

      {/* Decorative Blur Blobs */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-violet-600/5 dark:bg-violet-600/10 blur-3xl -top-20 -left-20 pointer-events-none"></div>
      <div className="absolute w-[600px] h-[600px] rounded-full bg-pink-600/5 dark:bg-pink-600/10 blur-3xl bottom-40 -right-20 pointer-events-none"></div>

      {/* HERO SECTION */}
      <header className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 text-center">
        {/* Brand Logo & Two-tone text */}
        <div className="flex flex-col items-center justify-center mb-8">
          <img src="/logov1.png" alt="EduGlobin Logo" className="h-28 md:h-36 w-auto object-contain mb-3 select-none pointer-events-none" />
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight transition-colors select-none flex items-center justify-center">
            <span className="text-[#032b85] dark:text-white">Edu</span>
            <span className="text-[#0f62fe] dark:text-[#00b4ff]">Globin</span>
          </h1>
          <p className="mt-3 text-xs font-bold text-slate-400 dark:text-white/40 uppercase tracking-widest">
            {t('tagline')}
          </p>
        </div>

        <p className="max-w-2xl mx-auto text-slate-500 dark:text-slate-400 text-lg md:text-xl mb-10 leading-relaxed">
          Discover verified libraries, exam-specific study spaces, and comfortable desks across Indore and Kota.
        </p>

        {/* ── Primary CTA ─────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-4">
          <Link
            to={userRole === 'SUPER_ADMIN' || userRole === 'STAFF' ? '/admin-portal' : userRole === 'LIBRARY_OWNER' ? '/owner/portal' : userRole === 'STUDENT' ? '/dashboard' : '/get-started'}
            id="hero-cta"
            className="inline-flex items-center gap-2.5 px-10 py-4 rounded-2xl
              bg-[#0f62fe] hover:bg-[#0353e9]
              text-white font-bold text-lg
              shadow-lg shadow-[#0f62fe]/30
              hover:shadow-xl hover:shadow-[#0f62fe]/40
              hover:-translate-y-0.5
              transition-all duration-200 cursor-pointer select-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
            {userRole === 'SUPER_ADMIN' || userRole === 'STAFF' ? '👑 Open Central Admin Console' : userRole === 'LIBRARY_OWNER' ? '🏢 Open Owner ERP Portal' : userRole === 'STUDENT' ? '📊 Open Student Dashboard' : 'Sign In / Create Account'}
          </Link>

          <Link
            to="/search"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-[#0f62fe] dark:hover:text-[#00b4ff] transition-colors mt-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            Just browsing? Explore study spaces →
          </Link>
        </div>
      </header>

      {/* FEATURED LIBRARIES SECTION */}
      <section id="featured" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
          <div>
            <h2 className="text-3xl font-bold font-headers text-slate-800 dark:text-white">Featured Study Spaces</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Hand-picked top-rated libraries across major student hubs.</p>
          </div>
          <Link to="/search" className="mt-4 md:mt-0 text-sm font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-500 dark:hover:text-violet-300 flex items-center gap-1 group">
            View all spaces
            <span className="transform group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        </div>

        {loading ? (
          /* Loading skeletons */
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-96 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 animate-pulse"></div>
            ))}
          </div>
        ) : featuredLibraries.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 space-y-4 shadow-sm max-w-xl mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-violet-600/10 text-violet-600 dark:text-violet-400 mx-auto flex items-center justify-center text-2xl">
              🏛️
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-900 dark:text-white font-headers">
                Zero Dummy Spaces — Authentic Network
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                EduGlobin only displays authentic libraries registered by verified owners and approved by administration.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
              <Link
                to="/search"
                className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-md shadow-violet-600/20 transition"
              >
                📍 Find Spaces Near My GPS Location →
              </Link>
              <Link
                to="/get-started"
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs hover:border-violet-500 transition"
              >
                Register Your Library Space
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredLibraries.map((lib) => {
              const isFree = lib.isFree || Number(lib.monthlyPrice) === 0;
              return (
                <article
                  key={lib.id}
                  className={`group flex flex-col justify-between p-6 rounded-2xl bg-white dark:bg-slate-900/30 border transition-all duration-300 shadow-sm ${
                    isFree
                      ? 'border-emerald-500/30 hover:border-emerald-500/60 dark:border-emerald-500/20 dark:hover:border-emerald-500/50 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/10'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div>
                    <div className="w-full h-44 rounded-xl bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 mb-5 relative overflow-hidden flex flex-col items-center justify-center border border-slate-700/50 text-white p-4 text-center">
                      <div className="absolute inset-0 bg-gradient-to-tr from-violet-600/20 to-emerald-600/20 mix-blend-overlay"></div>
                      
                      {/* Top left status badge */}
                      {isFree ? (
                        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-emerald-500/90 backdrop-blur text-[11px] font-extrabold text-white flex items-center gap-1 shadow-md shadow-emerald-500/30">
                          <span>⚡</span> 100% FREE PASS
                        </div>
                      ) : (
                        <div className="absolute top-3 left-3 px-2 py-0.5 rounded-lg bg-slate-950/70 backdrop-blur text-[10px] font-bold text-violet-300 border border-violet-500/30">
                          VERIFIED SPACE
                        </div>
                      )}

                      {/* Rating */}
                      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur text-xs font-bold text-amber-400 flex items-center gap-1 shadow-sm border border-slate-700/50">
                        ★ {lib.rating ? lib.rating.toFixed(1) : '4.8'}
                      </div>

                      {/* Visual Center Badge */}
                      <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-2xl mb-1 border border-white/20">
                        {isFree ? '🏛️' : '📚'}
                      </div>
                      <span className="text-xs font-bold font-headers tracking-wide text-slate-200 uppercase line-clamp-1">
                        {lib.locality || 'Indore Hub'}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold font-headers text-slate-800 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors mb-1 line-clamp-1">
                      {lib.name}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mb-3 flex items-center gap-1">
                      <span>📍</span> {lib.locality ? `${lib.locality}, ` : ''}{lib.city || 'Indore'}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {isFree && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xxs font-extrabold uppercase tracking-wider">
                          No Fees Required
                        </span>
                      )}
                      {lib.acAvailable && (
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xxs font-medium uppercase tracking-wider">AC Quiet Hall</span>
                      )}
                      {lib.hasGirlsSection && (
                        <span className="px-2 py-0.5 rounded bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 text-xxs font-medium uppercase tracking-wider">Girls Safe Wing</span>
                      )}
                      {lib.seatingType && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xxs font-medium uppercase tracking-wider">{lib.seatingType}</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="block text-slate-400 dark:text-slate-500 text-xxs uppercase tracking-wider">
                        {isFree ? 'Pricing' : 'Starts at'}
                      </span>
                      {isFree ? (
                        <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                          ₹0 <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Free Booking</span>
                        </span>
                      ) : (
                        <span className="text-lg font-bold text-slate-800 dark:text-white">
                          ₹{lib.monthlyPrice || '800'}<span className="text-xs font-normal text-slate-500 dark:text-slate-400">/mo</span>
                        </span>
                      )}
                    </div>
                    <Link
                      to={`/libraries/${lib.id}`}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                        isFree
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {isFree ? 'Book Free Pass →' : 'View Details →'}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ABOUT EDUGLOBIN SECTION */}
      <section id="about" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full border-t border-slate-200 dark:border-slate-800/60 space-y-16">
        {/* WHY EDUGLOBIN (TOP) */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <span className="px-3.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
            Why EduGlobin?
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold font-headers text-slate-900 dark:text-white">
            India's First Verified Silent Study Space Network
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base leading-relaxed">
            Designed for competitive aspirants in Kota, Indore, Bhopal, and Jaipur preparing for UPSC, JEE, NEET, and CA. We replace chaotic offline queues with verified desks, noise audit ratings, and instant cabin locks.
          </p>
        </div>

        {/* 3 CORE PILLARS */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-2xl font-bold">
              ⚡
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Zero Double-Booking</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Real-time Redis distributed lock engine reserves your chosen cabin for 10 minutes during checkout.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center text-2xl font-bold">
              🛡️
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Girls Safety Audited</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Every facility features verified girls safety indices, CCTV coverage, and dedicated women-only reading halls.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl font-bold">
              📱
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Automated Library ERP</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Library partners manage interactive seat grids, dynamic walk-in UPI QRs, and automated WhatsApp fee reminders.
            </p>
          </div>
        </div>

        {/* JOIN US CTA BLOCK */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-violet-600/10 via-blue-600/5 to-indigo-600/10 dark:from-violet-950/40 dark:to-slate-900/40 p-8 text-center space-y-6">
          <div className="max-w-xl mx-auto space-y-2">
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white font-headers">
              Join EduGlobin Today
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Get guaranteed access to premium study spaces or list your library with zero setup fee.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/student"
              className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-md shadow-violet-500/25 transition"
            >
              Join as a Student →
            </Link>
            <Link
              to="/owner/signup"
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/25 transition"
            >
              Join as a Library Partner →
            </Link>
            <Link
              to="/about"
              className="px-6 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              Read Full Story & Pillars →
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-850 mt-auto py-12 text-slate-500 text-sm text-center transition-colors">
        <div className="max-w-7xl mx-auto px-4 space-y-6">
          <p>© 2026 EduGlobin. All rights reserved. Empowering aspirants in Indore, Kota, and beyond.</p>
          <div className="flex justify-center gap-6 text-slate-500 dark:text-slate-400">
            <Link to="/" className="hover:text-slate-900 dark:hover:text-white transition-colors">Home</Link>
            <Link to="/search" className="hover:text-slate-900 dark:hover:text-white transition-colors">Search</Link>
            <Link to="/recommend" className="hover:text-slate-900 dark:hover:text-white transition-colors">AI Solver</Link>
            <a href="#about" className="hover:text-slate-900 dark:hover:text-white transition-colors">About Us</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
