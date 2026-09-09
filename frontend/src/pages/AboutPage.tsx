import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#070b14] text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-300">
      <Navbar />

      {/* Decorative Background Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute w-[600px] h-[600px] rounded-full bg-violet-600/10 dark:bg-violet-600/15 blur-3xl -top-40 -left-20"></div>
        <div className="absolute w-[500px] h-[500px] rounded-full bg-blue-600/10 dark:bg-blue-600/15 blur-3xl top-1/3 -right-20"></div>
      </div>

      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-20">
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* TOP HERO & WHY EDUGLOBIN SECTION                                    */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <section className="text-center space-y-6 pt-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200 dark:border-violet-800/80 shadow-sm">
            <span>✨ About EduGlobin</span>
            <span>·</span>
            <span>India's Smart Study Space Ecosystem</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white font-headers max-w-4xl mx-auto leading-tight">
            Empowering Aspirants with <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">Guaranteed Desks</span> & Silent Sanctuaries.
          </h1>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            EduGlobin transforms the unstructured reading room market into verified, high-productivity study spaces with real-time seat locking, safety verification, and zero hassle.
          </p>

          {/* ── TOP SECTION: WHY EDUGLOBIN? ── */}
          <div className="pt-10 space-y-6">
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-headers">
                Why EduGlobin?
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                The core advantages built specifically for competitive exam aspirants and modern library partners.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left pt-4">
              {/* Feature 1 */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800/80 shadow-sm hover:shadow-md transition">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-2xl mb-4">
                  ⚡
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                  Zero Double-Bookings
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Our generalized Redis distributed lock engine guarantees that when you select desk A1 or B3, it is held exclusively for you during checkout. No overlaps, ever.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800/80 shadow-sm hover:shadow-md transition">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center text-2xl mb-4">
                  🛡️
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                  Girls Safety Standards
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Every listed study space features an audited Girls Safety Score, CCTV-monitored reading halls, and dedicated women-only cabins with verified safety criteria.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800/80 shadow-sm hover:shadow-md transition">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center text-2xl mb-4">
                  🪑
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                  Choose Your Exact Desk
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Don't rely on random seat allocations. View interactive floor layouts, identify charging sockets, select morning/night shifts, and reserve your favourite corner.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800/80 shadow-sm hover:shadow-md transition">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl mb-4">
                  🤖
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                  AI Study Solver & Matcher
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Intelligent recommendations based on your target examination (UPSC, JEE, NEET, CA, SSC), budget constraints, preferred AC zones, and commute radius.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800/80 shadow-sm hover:shadow-md transition">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-2xl mb-4">
                  📱
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                  Digital Pass & UPI Check-in
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Instant tamper-proof cryptographic QR gate passes on your phone. For walk-ins, scan the front-desk dynamic UPI QR for immediate session top-ups.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800/80 shadow-sm hover:shadow-md transition">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-2xl mb-4">
                  🔒
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                  DPDP Privacy Compliance
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  India DPDP Act compliant. Student Aadhaar documents and government IDs are automatically masked with irreversible hashes to protect student personal data.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* ALL SECTIONS: COMPLETE PLATFORM PILLARS                             */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <section className="space-y-12">
          <div className="text-center space-y-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              The Platform Ecosystem
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-headers">
              Comprehensive Features for All Users
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Pillar 1: For Students */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1220] p-8 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold text-lg">
                  🎓
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">For Students & Aspirants</h3>
                  <p className="text-xs text-slate-500">Your dedicated study companion</p>
                </div>
              </div>

              <ul className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span><strong>Geospatial Finder</strong>: Find nearby silent reading rooms with real-time distance calculations and verified photos.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span><strong>2-Step Physical Desk Booking</strong>: Select your exact shift (Morning/Afternoon/Evening/Night) and desk (A1 to D5).</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span><strong>Student Dashboard</strong>: Access active passes, booking history, wallet refunds, and instant 1-click rebooking.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span><strong>Free Community Desks</strong>: Zero-fee study space access for verified low-income aspirants.</span>
                </li>
              </ul>

              <div className="pt-2">
                <Link
                  to="/student"
                  className="inline-flex items-center gap-2 text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline"
                >
                  Explore Student Access →
                </Link>
              </div>
            </div>

            {/* Pillar 2: For Library Owners */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1220] p-8 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
                  🏢
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">For Library Partners & Owners</h3>
                  <p className="text-xs text-slate-500">A comprehensive study hub ERP</p>
                </div>
              </div>

              <ul className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-2.5">
                  <span className="text-blue-500 font-bold">✓</span>
                  <span><strong>Interactive Seat Locker</strong>: Real-time visual matrix indicating online booked, walk-in occupied, and vacant desks.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-blue-500 font-bold">✓</span>
                  <span><strong>Student CRM & KYC Intake</strong>: Register walk-ins with DPDP compliant Aadhaar masking and instant desk allocation.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-blue-500 font-bold">✓</span>
                  <span><strong>Fee Dual-Ledger & WhatsApp</strong>: Track monthly fees owed and trigger 1-click personalized WhatsApp payment reminders.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-blue-500 font-bold">✓</span>
                  <span><strong>Dynamic Walk-In UPI QR</strong>: Direct counter ticketing where students scan to pay directly to your UPI ID.</span>
                </li>
              </ul>

              <div className="pt-2">
                <Link
                  to="/owner"
                  className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Explore Owner ERP Portal →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* JOIN US SECTION (HIGH IMPACT CTA)                                   */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-violet-900/10 via-white to-blue-900/10 dark:from-violet-950/40 dark:via-[#0c1220] dark:to-blue-950/40 p-8 sm:p-12 shadow-sm space-y-8 text-center">
          <div className="max-w-2xl mx-auto space-y-3">
            <span className="px-3.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-violet-600 text-white shadow-sm">
              Get Started Today
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white font-headers">
              Join the EduGlobin Movement
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Whether you are preparing for India's toughest competitive examinations or running a dedicated study sanctuary, EduGlobin is built for you.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto text-left pt-2">
            {/* Join as Student */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#12192c] border border-slate-200 dark:border-slate-800/80 shadow-md flex flex-col justify-between space-y-4">
              <div>
                <span className="text-2xl mb-2 block">🎒</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Join as a Student</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Browse top-rated libraries, preview physical desk layouts, and reserve your dedicated daily or monthly cabin pass.
                </p>
              </div>

              <Link
                to="/student"
                className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-extrabold text-center transition shadow-md shadow-violet-500/25"
              >
                Sign Up / Book a Desk →
              </Link>
            </div>

            {/* Join as Owner */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#12192c] border border-slate-200 dark:border-slate-800/80 shadow-md flex flex-col justify-between space-y-4">
              <div>
                <span className="text-2xl mb-2 block">🏢</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Join as a Library Partner</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  List your study space, fill unoccupied seats with online aspirants, automate dues via WhatsApp, and digitize your desk roster.
                </p>
              </div>

              <Link
                to="/owner/signup"
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold text-center transition shadow-md shadow-blue-500/25"
              >
                Onboard Your Library →
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
