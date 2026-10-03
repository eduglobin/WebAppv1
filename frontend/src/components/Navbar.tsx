import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useTheme } from '../theme/ThemeContext';
import { supabase } from '../lib/supabase';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

interface NavbarProps {
  onToggleSidebar?: () => void;
}

export default function Navbar({ onToggleSidebar }: NavbarProps = {}) {
  const { t, i18n } = useTranslation();
  const { resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchRole = async (token: string) => {
    try {
      const res = await axios.get(`${API_BASE}/api/v1/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success && res.data?.data) {
        setUserRole(res.data.data.role);
        setUserEmail(res.data.data.email || '');
      }
    } catch (e) {
      // Fallback
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        setUserEmail(session.user.email || '');
        fetchRole(session.access_token);
      } else {
        setUserRole(null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setUserEmail(session.user.email || '');
        fetchRole(session.access_token);
      } else {
        setUserRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageToggle = () => {
    const nextLang = i18n.language === 'en' ? 'hi' : 'en';
    i18n.changeLanguage(nextLang);
    localStorage.setItem('eduglobin_lang', nextLang);
  };

  const handleThemeToggle = () => {
    const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUserRole(null);
    setSession(null);
    setProfileDropdownOpen(false);
    navigate('/');
  };

  const isStudent = session && userRole === 'STUDENT';
  const isOwner = session && userRole === 'LIBRARY_OWNER';
  const isAdmin = session && (userRole === 'SUPER_ADMIN' || userRole === 'STAFF');
  const isGuest = !session;

  return (
    <nav className="sticky top-0 z-50 bg-white/90 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800/80 backdrop-blur-md transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-between h-16">
          {/* Mobile hamburger menu button (LEFT on mobile) */}
          <div className="flex items-center md:hidden z-10">
            <button
              onClick={() => {
                if (onToggleSidebar) {
                  onToggleSidebar();
                } else {
                  setIsOpen(!isOpen);
                }
              }}
              className="inline-flex items-center justify-center p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              <span className="text-xl font-bold">{isOpen ? '✕' : '☰'}</span>
            </button>
          </div>

          {/* Logo & Brand Name (CENTER on mobile, LEFT on desktop) */}
          <div className="absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0 flex-shrink-0 flex items-center z-0 md:z-auto">
            <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90 select-none">
              <img src="/eduglobin_logo.png" alt="EduGlobin" className="h-9 sm:h-10 w-9 sm:w-10 object-cover rounded-full" />
              <span className="text-xl sm:text-2xl font-extrabold tracking-tight select-none flex items-center font-headers">
                <span className="text-[#032b85] dark:text-white">Edu</span>
                <span className="text-[#0f62fe] dark:text-[#00b4ff]">Glob</span>
                <span className="relative inline-block text-[#0f62fe] dark:text-[#00b4ff] leading-none">
                  ı
                  <span className="absolute -top-[3px] left-[2.5px] w-2 h-2 bg-[#ff9900] rounded-full"></span>
                </span>
                <span className="text-[#0f62fe] dark:text-[#00b4ff]">n</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-6">
            {!isGuest && (
              <>
                <Link
                  to="/search"
                  className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium text-sm transition-colors"
                >
                  Find Libraries
                </Link>

                <Link
                  to="/recommend"
                  className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium text-sm transition-colors"
                >
                  Recommender
                </Link>
              </>
            )}

            {isStudent && (
              <Link
                to="/dashboard"
                className="text-[#0f62fe] dark:text-[#00b4ff] font-bold text-sm transition-colors flex items-center gap-1.5"
              >
                <span>Dashboard</span>
              </Link>
            )}

            {isOwner && (
              <Link
                to="/owner/portal"
                className="text-[#0f62fe] dark:text-[#00b4ff] font-bold text-sm transition-colors flex items-center gap-1.5"
              >
                <span>Owner Portal</span>
              </Link>
            )}

            {isAdmin && (
              <Link
                to="/admin-portal"
                className="text-rose-600 dark:text-rose-400 font-bold text-sm transition-colors flex items-center gap-1.5"
              >
                <span>Admin Portal</span>
              </Link>
            )}

            <Link
              to="/about"
              className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium text-sm transition-colors"
            >
              About Us
            </Link>
            <Link
              to="/"
              className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium text-sm transition-colors"
            >
              About EduGlobin
            </Link>
          </div>

          {/* Mobile Right Controls: Language & Theme */}
          <div className="flex md:hidden items-center space-x-2 z-10">
            <button
              onClick={handleLanguageToggle}
              className="px-2 py-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-bold text-xs"
              title="Change Language"
            >
              {i18n.language === 'en' ? 'हिन्दी' : 'EN'}
            </button>
            <button
              onClick={handleThemeToggle}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-sm"
              title="Toggle Theme"
            >
              {resolvedTheme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>

          {/* Desktop Controls & Auth */}
          <div className="hidden md:flex items-center space-x-4">
            <button
              onClick={handleLanguageToggle}
              className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-bold text-xs"
              title="Change Language"
            >
              {i18n.language === 'en' ? 'हिन्दी' : 'EN'}
            </button>

            <button
              onClick={handleThemeToggle}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              title="Toggle Theme"
            >
              {resolvedTheme === 'dark' ? '☀️' : '🌙'}
            </button>

            {isGuest && (
              <Link
                to="/get-started"
                id="nav-signin"
                className="px-5 py-2 rounded-xl bg-[#0f62fe] hover:bg-[#0353e9] text-white text-sm font-semibold shadow-md shadow-[#0f62fe]/20 hover:shadow-lg transition-all cursor-pointer"
              >
                Sign In / Sign Up
              </Link>
            )}

            {!isGuest && (
              <div className="flex items-center gap-2.5">
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
                  >
                    <span className="w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center text-[10px] font-bold">
                      {userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}
                    </span>
                    <span>Account</span>
                    <span className="text-[10px]">▼</span>
                  </button>

                  {profileDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50 text-xs">
                      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                        <p className="font-bold text-slate-900 dark:text-white truncate">{userEmail}</p>
                        <p className="text-[10px] text-violet-500 font-semibold uppercase">
                          {userRole || 'Logged In Account'}
                        </p>
                      </div>

                      {userRole === 'LIBRARY_OWNER' ? (
                        <Link
                          to="/owner/portal?tab=onboarding"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="block px-4 py-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition font-medium"
                        >
                          Profile &amp; Library Settings
                        </Link>
                      ) : (
                        <Link
                          to="/dashboard"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="block px-4 py-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          Student Dashboard
                        </Link>
                      )}

                      <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>

                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 font-bold transition cursor-pointer flex items-center justify-between"
                      >
                        <span>Sign Out</span>
                        <span className="text-[10px] text-rose-400">Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Drawer (Slide-Over Sidebar matching screenshot) */}
      {isOpen && (
        <div className="md:hidden">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-72 sm:w-80 bg-[#0c1327] border-r border-slate-800 text-slate-100 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-800/80">
              <Link to="/" onClick={() => setIsOpen(false)} className="flex items-center gap-2">
                <img src="/eduglobin_logo.png" alt="EduGlobin" className="h-8 w-8 object-cover rounded-full" />
                <span className="text-lg font-black tracking-tight font-headers">
                  <span className="text-white">Edu</span>
                  <span className="text-[#0f62fe]">Glob</span>
                  <span className="relative inline-block text-[#0f62fe]">
                    ı<span className="absolute -top-[2px] left-[2px] w-1.5 h-1.5 bg-[#ff9900] rounded-full"></span>
                  </span>
                  <span className="text-[#0f62fe]">n</span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 border-b border-slate-800/80 bg-slate-900/40 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-violet-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-md shadow-violet-600/30">
                {userEmail ? userEmail.charAt(0).toUpperCase() : (isGuest ? 'G' : 'S')}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-white truncate">
                  {userRole === 'STUDENT' ? 'Student' : userRole === 'LIBRARY_OWNER' ? 'Library Owner' : userRole === 'SUPER_ADMIN' ? 'Super Admin' : (userEmail ? 'User' : 'Student')}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {userEmail || 'student@eduglobin.com'}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1 font-medium text-xs sm:text-sm">
              {!isGuest && (
                <>
                  <Link
                    to="/dashboard"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-[#1d2745] text-white font-extrabold border-l-4 border-violet-500 shadow-sm transition"
                  >
                    <span className="text-base">🏠</span>
                    <span>Dashboard</span>
                  </Link>

                  <Link
                    to="/search"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3.5 py-3 rounded-2xl text-slate-300 hover:text-white hover:bg-slate-800/60 transition"
                  >
                    <span className="text-base">🔍</span>
                    <span>Find Libraries</span>
                  </Link>

                  <Link
                    to="/recommend"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3.5 py-3 rounded-2xl text-slate-300 hover:text-white hover:bg-slate-800/60 transition"
                  >
                    <span className="text-base">⭐</span>
                    <span>Recommender</span>
                  </Link>
                </>
              )}

              <Link
                to="/dashboard?tab=bookings"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3.5 py-3 rounded-2xl text-slate-300 hover:text-white hover:bg-slate-800/60 transition"
              >
                <span className="text-base">📅</span>
                <span>My Bookings</span>
              </Link>

              <Link
                to="/dashboard?tab=passes"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3.5 py-3 rounded-2xl text-slate-300 hover:text-white hover:bg-slate-800/60 transition"
              >
                <span className="text-base">📄</span>
                <span>Active Passes</span>
              </Link>

              <Link
                to="/dashboard?tab=wallet"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3.5 py-3 rounded-2xl text-slate-300 hover:text-white hover:bg-slate-800/60 transition"
              >
                <span className="text-base">👛</span>
                <span>Spendings &amp; Wallet</span>
              </Link>

              <Link
                to="/dashboard?tab=privacy"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3.5 py-3 rounded-2xl text-slate-300 hover:text-white hover:bg-slate-800/60 transition"
              >
                <span className="text-base">⚙️</span>
                <span>Settings</span>
              </Link>

              <div className="my-3 border-t border-slate-800/80" />

              <Link
                to="/about"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
              >
                <span className="text-base">❓</span>
                <span>About Us</span>
              </Link>

              <Link
                to="/"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
              >
                <span className="text-base">🏢</span>
                <span>About EduGlobin</span>
              </Link>

              <a
                href="mailto:support@eduglobin.com"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
              >
                <span className="text-base">💬</span>
                <span>Give Feedback</span>
              </a>

              {!isGuest && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    handleSignOut();
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-rose-500 hover:bg-rose-500/10 font-extrabold transition cursor-pointer text-left"
                >
                  <span className="text-base">🚪</span>
                  <span>Sign Out</span>
                </button>
              )}
            </div>

            <div className="p-4 border-t border-slate-800/80 bg-gradient-to-br from-violet-950/40 to-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-violet-600/20 text-violet-400 flex items-center justify-center text-xl shrink-0 border border-violet-500/30">
                  📚
                </div>
                <div>
                  <h4 className="text-xs font-black text-white font-headers">A Better Place to Study</h4>
                  <p className="text-[10px] text-slate-400 italic">Discover. Book. Study. Grow.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
