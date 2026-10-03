import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface StudentSidebarProps {
  activeItemId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function StudentSidebar({ activeItemId, isOpen, onClose }: StudentSidebarProps) {
  const { i18n } = useTranslation();
  const isHi = i18n.language?.startsWith('hi');
  const navigate = useNavigate();

  const navItems = [
    { id: 'dashboard', label: isHi ? 'डैशबोर्ड' : 'Dashboard', subLabel: isHi ? 'Dashboard' : 'Home', icon: '🏠', href: '/student?tab=dashboard' },
    { id: 'search',    label: isHi ? 'लाइब्रेरी खोजें' : 'Find Libraries', subLabel: isHi ? 'Find Libraries' : 'Search & Book', icon: '🔍', href: '/search' },
    { id: 'bookings',  label: isHi ? 'मेरी बुकिंग' : 'My Bookings', subLabel: isHi ? 'My Bookings' : 'Seat Reservations', icon: '📅', href: '/student?tab=bookings' },
    { id: 'passes',    label: isHi ? 'बुकिंग और पास' : 'Bookings & Passes', subLabel: isHi ? 'Bookings & Passes' : 'QR Passes', icon: '⚡', href: '/student?tab=bookings' },
    { id: 'wallet',    label: isHi ? 'खर्च और वॉलेट' : 'Spendings & Wallet', subLabel: isHi ? 'Spendings & Wallet' : 'Balance & Fines', icon: '💳', href: '/student?tab=wallet' },
    { id: 'books',     label: isHi ? 'मेरी किताबें' : 'My Books', subLabel: isHi ? 'My Books' : 'Circulation', icon: '📚', href: '/student?tab=books' },
    { id: 'privacy',   label: isHi ? 'सेटिंग्स' : 'Settings', subLabel: isHi ? 'Settings' : 'Privacy & Log', icon: '⚙️', href: '/student?tab=privacy' },
  ];

  return (
    <>
      {/* ── SIDEBAR OVERLAY (mobile) ── */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside className={`
        fixed top-0 left-0 h-full w-72 z-50 flex flex-col
        bg-white dark:bg-[#0e0f1a] text-slate-800 dark:text-white border-r border-slate-200 dark:border-white/10 shadow-2xl lg:shadow-none
        transform transition-transform duration-300
        lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:z-auto lg:w-64 lg:shrink-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-slate-200 dark:border-white/10">
          <Link to="/" className="flex items-center gap-3" onClick={onClose}>
            <img src="/eduglobin_logo.png" alt="EduGlobin" className="w-9 h-9 rounded-full object-cover border-2 border-violet-500" onError={e => { (e.target as any).src = 'https://ui-avatars.com/api/?name=EG&background=7c3aed&color=fff&size=36'; }} />
            <span className="font-black text-lg tracking-tight text-slate-900 dark:text-white">EduGlobin</span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 flex items-center justify-center text-slate-700 dark:text-white text-sm transition"
          >✕</button>
        </div>

        {/* Student profile mini card */}
        <div className="mx-4 my-4 px-4 py-3 rounded-2xl bg-violet-50/80 dark:bg-white/5 border border-violet-100 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-white font-black text-base shadow-sm">
              S
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 dark:text-white text-sm truncate">Student</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">student@eduglobin.com</p>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto py-2">
          {navItems.map(item => {
            const isActive = item.id === activeItemId;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onClose();
                  navigate(item.href);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                  isActive
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-violet-50 dark:hover:bg-white/8 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="text-lg shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold leading-tight truncate">{item.label}</p>
                  <p className={`text-[10px] leading-tight ${isActive ? 'text-violet-200' : 'text-slate-400 dark:text-slate-500'}`}>{item.subLabel}</p>
                </div>
              </button>
            );
          })}

          <div className="border-t border-slate-200 dark:border-white/10 my-3" />

          <button
            onClick={() => { onClose(); navigate('/help'); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-slate-600 dark:text-slate-400 hover:bg-violet-50 dark:hover:bg-white/8 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
          >
            <span className="text-lg shrink-0">❓</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight">{isHi ? 'सहायता' : 'Help & Support'}</p>
              <p className="text-[10px] leading-tight text-slate-400 dark:text-slate-500">{isHi ? 'Help & Support' : 'FAQs, Helpline & Chat'}</p>
            </div>
          </button>
          <button
            onClick={() => { onClose(); navigate('/feedback'); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-slate-600 dark:text-slate-400 hover:bg-violet-50 dark:hover:bg-white/8 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
          >
            <span className="text-lg shrink-0">💬</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight">{isHi ? 'फ़ीडबैक दें' : 'Give Feedback'}</p>
              <p className="text-[10px] leading-tight text-slate-400 dark:text-slate-500">{isHi ? 'Give Feedback' : 'Rate your experience'}</p>
            </div>
          </button>
        </nav>

        {/* Bottom brand card */}
        <div className="mx-4 mb-6 p-4 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 dark:from-violet-900/60 dark:to-indigo-900/40 border border-violet-500/20 text-white">
          <p className="text-sm font-black text-white">{isHi ? 'पढ़ाई का बेहतर ठिकाना' : 'Your Ultimate Study Hub'}</p>
          <p className="text-[10px] text-violet-200 dark:text-violet-300 mt-0.5">Discover. Book. Study. Grow.</p>
          <button
            onClick={() => { import('../lib/supabase').then(({supabase}) => supabase.auth.signOut()); }}
            className="mt-3 w-full py-1.5 rounded-xl bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer"
          >
            🚪 {isHi ? 'साइन आउट / Sign Out' : 'Sign Out'}
          </button>
        </div>
      </aside>
    </>
  );
}
