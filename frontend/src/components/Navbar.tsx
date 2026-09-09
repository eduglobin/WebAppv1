import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useTheme } from '../theme/ThemeContext';
import { supabase } from '../lib/supabase';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

export default function Navbar() {
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
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="flex items-center transition-opacity hover:opacity-90 select-none">
              <img src="/eduglobin_logo.png" alt="EduGlobin - Find. Book. Study. Grow." className="h-10 sm:h-11 w-auto object-contain" />
            </Link>
          </div>

          {/* Desktop Nav links */}
          <div className="hidden md:flex items-center space-x-6">
            {/* 1. GUEST NAVBAR */}
            {isGuest && (
              <>
                <Link to="/search" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white font-medium text-sm transition-colors">
                  Finder
                </Link>
                <Link to="/about" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white font-medium text-sm transition-colors">
                  About EduGlobin
                </Link>
              </>
            )}

            {/* 2. STUDENT NAVBAR */}
            {isStudent && (
              <>
                <Link to="/dashboard" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white font-semibold text-sm transition-colors">
                  Dashboard
                </Link>
                <Link to="/dashboard?tab=my-libraries" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white font-medium text-sm transition-colors">
                  My Libraries
                </Link>
                <Link to="/search" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white font-medium text-sm transition-colors">
                  Finder
                </Link>
                <Link to="/recommend" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white font-medium text-sm transition-colors">
                  AI Solver
                </Link>
              </>
            )}

            {/* 3. OWNER NAVBAR */}
            {isOwner && (
              <>
                <Link to="/owner/portal" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white font-semibold text-sm transition-colors">
                  Dashboard / ERP
                </Link>
                <Link to="/about" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white font-medium text-sm transition-colors">
                  About EduGlobin
                </Link>
                <Link to="/owner/portal?tab=onboarding" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white font-medium text-sm transition-colors">
                  Profile &amp; Library Settings
                </Link>
              </>
            )}

            {/* 4. ADMIN NAVBAR */}
            {isAdmin && (
              <>
                <Link to="/admin-portal" className="text-rose-600 dark:text-rose-400 font-bold text-sm transition-colors">
                  Admin Portal
                </Link>
                <Link to="/search" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white font-medium text-sm transition-colors">
                  Finder
                </Link>
              </>
            )}
          </div>

          {/* Desktop Controls & Auth */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Language Toggle */}
            <button
              onClick={handleLanguageToggle}
              className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-bold text-xs"
              title="Change Language"
            >
              {i18n.language === 'en' ? 'हिन्दी' : 'EN'}
            </button>

            {/* Theme Toggle */}
            <button
              onClick={handleThemeToggle}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              title="Toggle Theme"
            >
              {resolvedTheme === 'dark' ? '☀️' : '🌙'}
            </button>

            {/* GUEST: Sign In Button */}
            {isGuest && (
              <Link
                to="/get-started"
                id="nav-signin"
                className="px-5 py-2 rounded-xl bg-[#0f62fe] hover:bg-[#0353e9] text-white text-sm font-semibold shadow-md shadow-[#0f62fe]/20 hover:shadow-lg transition-all cursor-pointer"
              >
                Sign In / Sign Up
              </Link>
            )}

            {/* LOGGED IN: Profile Dropdown + Universal Sign Out Button */}
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
                          ⚙️ Profile &amp; Library Settings
                        </Link>
                      ) : (
                        <Link
                          to="/dashboard"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="block px-4 py-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          📊 Student Dashboard
                        </Link>
                      )}

                      <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>

                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 font-bold transition cursor-pointer flex items-center justify-between"
                      >
                        <span>🚪 Sign Out</span>
                        <span className="text-[10px] text-rose-400">Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mobile hamburger menu */}
          <div className="flex items-center md:hidden space-x-3">
            <button onClick={handleLanguageToggle} className="p-1.5 text-xs text-slate-400 font-bold">
              {i18n.language === 'en' ? 'हिन्दी' : 'EN'}
            </button>
            <button onClick={handleThemeToggle} className="p-1.5 text-slate-400">
              {resolvedTheme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
            >
              {isOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 pt-2 pb-6 space-y-3 text-sm">
          {isGuest && (
            <>
              <Link to="/search" onClick={() => setIsOpen(false)} className="block py-2 text-slate-300 hover:text-white">Finder</Link>
              <Link to="/about" onClick={() => setIsOpen(false)} className="block py-2 text-slate-300 hover:text-white">About EduGlobin</Link>
              <Link to="/get-started" onClick={() => setIsOpen(false)} className="block py-2.5 text-center rounded-xl bg-blue-600 text-white font-bold">Sign In / Sign Up</Link>
            </>
          )}

          {isStudent && (
            <>
              <Link to="/dashboard" onClick={() => setIsOpen(false)} className="block py-2 text-slate-300 hover:text-white">Dashboard</Link>
              <Link to="/search" onClick={() => setIsOpen(false)} className="block py-2 text-slate-300 hover:text-white">Finder</Link>
              <Link to="/recommend" onClick={() => setIsOpen(false)} className="block py-2 text-slate-300 hover:text-white">AI Solver</Link>
              <Link to="/dashboard?tab=bookings" onClick={() => setIsOpen(false)} className="block py-2 text-slate-300 hover:text-white">My Bookings</Link>
              <Link to="/dashboard?tab=passes" onClick={() => setIsOpen(false)} className="block py-2 text-slate-300 hover:text-white">Active Passes</Link>
              <Link to="/dashboard?tab=wallet" onClick={() => setIsOpen(false)} className="block py-2 text-slate-300 hover:text-white">Spendings & Wallet</Link>
              <button onClick={() => { setIsOpen(false); handleSignOut(); }} className="w-full text-left py-2 text-rose-400">Sign Out</button>
            </>
          )}

          {isOwner && (
            <>
              <Link to="/owner/portal" onClick={() => setIsOpen(false)} className="block py-2 text-slate-300 hover:text-white font-medium">Dashboard / ERP</Link>
              <Link to="/about" onClick={() => setIsOpen(false)} className="block py-2 text-slate-300 hover:text-white font-medium">About EduGlobin</Link>
              <Link to="/owner/portal?tab=onboarding" onClick={() => setIsOpen(false)} className="block py-2 text-slate-300 hover:text-white font-medium">Profile &amp; Library Settings</Link>
              <button onClick={() => { setIsOpen(false); handleSignOut(); }} className="w-full text-left py-2 text-rose-400 font-bold">Sign Out</button>
            </>
          )}

          {isAdmin && (
            <>
              <Link to="/admin-portal" onClick={() => setIsOpen(false)} className="block py-2 text-rose-400 font-bold">Admin Portal</Link>
              <Link to="/search" onClick={() => setIsOpen(false)} className="block py-2 text-slate-300 hover:text-white">Finder</Link>
              <button onClick={() => { setIsOpen(false); handleSignOut(); }} className="w-full text-left py-2 text-rose-400">Sign Out</button>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
