import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function RegisterRolePage() {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Background Blobs */}
      <div className="absolute w-96 h-96 rounded-full bg-violet-600/20 blur-3xl -top-12 -left-12"></div>
      <div className="absolute w-96 h-96 rounded-full bg-pink-600/20 blur-3xl -bottom-12 -right-12"></div>

      <div className="z-10 max-w-2xl w-full text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold font-headers mb-4 tracking-tight">
          How will you use <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">EduGlobin</span>?
        </h1>
        <p className="text-slate-400 text-lg mb-12">
          Select your role to continue registration.
        </p>

        <div className="grid md:grid-cols-2 gap-8 text-left">
          {/* Student Card */}
          <Link
            to="/register/student"
            className="group p-8 rounded-2xl bg-slate-800/40 border border-slate-700/50 backdrop-blur-md hover:border-violet-500/50 hover:bg-slate-800/60 transition-all duration-300 flex flex-col justify-between h-64"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-6 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.58 1.162 4.5 2.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.58 1.162-4.5 2.253" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold font-headers mb-2 group-hover:text-violet-400 transition-colors">I'm a Student</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Find public study spaces, filter by pricing/amenities, and book daily or monthly study shifts.
              </p>
            </div>
            <div className="text-xs font-semibold text-violet-400 uppercase tracking-wider flex items-center gap-1 mt-4">
              Get Started
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* Owner Card */}
          <Link
            to="/register/owner"
            className="group p-8 rounded-2xl bg-slate-800/40 border border-slate-700/50 backdrop-blur-md hover:border-pink-500/50 hover:bg-slate-800/60 transition-all duration-300 flex flex-col justify-between h-64"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 mb-6 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold font-headers mb-2 group-hover:text-pink-400 transition-colors">I'm a Library Owner</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                List your library hubs, manage shifts/desk seating layouts, and handle student subscriptions.
              </p>
            </div>
            <div className="text-xs font-semibold text-pink-400 uppercase tracking-wider flex items-center gap-1 mt-4">
              Get Started
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>

        <div className="mt-12 text-slate-500 text-sm">
          Already have an account? <Link to="/login" className="text-slate-400 hover:text-slate-300 underline font-medium">Sign In</Link>
        </div>
      </div>
    </main>
  );
}