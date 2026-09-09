import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';

export default function RoleSelectPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-[#f6f8fc] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#eef2f9] via-white to-[#f6f8fc] dark:bg-slate-950 dark:from-indigo-950 dark:via-slate-950 dark:to-slate-950 text-slate-800 dark:text-slate-100 flex flex-col relative overflow-hidden transition-colors duration-300">
      <Navbar />

      {/* Decorative blobs */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-[#0f62fe]/5 dark:bg-[#0f62fe]/10 blur-3xl -top-20 -left-20 pointer-events-none"></div>
      <div className="absolute w-[500px] h-[500px] rounded-full bg-violet-600/5 dark:bg-violet-600/10 blur-3xl bottom-20 -right-20 pointer-events-none"></div>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">

        {/* Brand header */}
        <div className="mb-10 flex flex-col items-center">
          <img
            src="/logov1.png"
            alt="EduGlobin Logo"
            className="h-20 w-auto object-contain mb-3 select-none pointer-events-none"
          />
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight select-none flex items-center justify-center">
            <span className="text-[#032b85] dark:text-white">Edu</span>
            <span className="text-[#0f62fe] dark:text-[#00b4ff]">Glob</span>
            <span className="relative inline-block text-[#0f62fe] dark:text-[#00b4ff] leading-none font-sans">
              ı
              <span className="absolute -top-[4px] left-[2.5px] w-1.5 h-1.5 bg-[#ff9900] rounded-full"></span>
            </span>
            <span className="text-[#0f62fe] dark:text-[#00b4ff]">n</span>
          </h1>
          <p className="mt-2 text-xs font-bold text-slate-400 dark:text-white/40 uppercase tracking-widest">
            {t('tagline')}
          </p>
        </div>

        {/* Prompt */}
        <p className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white mb-2">
          Who are you?
        </p>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-10">
          Choose your role to continue
        </p>

        {/* Role cards */}
        <div className="flex flex-col sm:flex-row gap-5 max-w-xl w-full mx-auto">

          {/* Student */}
          <Link
            to="/student"
            id="role-student"
            className="group flex-1 flex flex-col items-center gap-4 p-8 rounded-3xl
              bg-white dark:bg-slate-900/60
              border-2 border-[#0f62fe]/20 dark:border-[#00b4ff]/15
              hover:border-[#0f62fe] dark:hover:border-[#00b4ff]
              hover:shadow-2xl hover:shadow-[#0f62fe]/15 dark:hover:shadow-[#00b4ff]/10
              hover:-translate-y-1
              transition-all duration-300 cursor-pointer"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#0f62fe]/10 dark:bg-[#00b4ff]/10 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform duration-300">
              🎓
            </div>
            <div>
              <p className="font-extrabold text-xl text-slate-800 dark:text-white group-hover:text-[#0f62fe] dark:group-hover:text-[#00b4ff] transition-colors">
                I'm a Student
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Find & book your perfect study space
              </p>
            </div>
            <div className="mt-auto w-full py-2.5 rounded-xl bg-[#0f62fe]/0 group-hover:bg-[#0f62fe] border border-[#0f62fe]/30 group-hover:border-transparent text-[#0f62fe] group-hover:text-white text-sm font-bold transition-all duration-300 text-center">
              Sign In / Sign Up →
            </div>
          </Link>

          {/* Library Owner */}
          <Link
            to="/owner"
            id="role-owner"
            className="group flex-1 flex flex-col items-center gap-4 p-8 rounded-3xl
              bg-white dark:bg-slate-900/60
              border-2 border-violet-400/20 dark:border-violet-500/15
              hover:border-violet-600 dark:hover:border-violet-400
              hover:shadow-2xl hover:shadow-violet-600/15
              hover:-translate-y-1
              transition-all duration-300 cursor-pointer"
          >
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform duration-300">
              🏛️
            </div>
            <div>
              <p className="font-extrabold text-xl text-slate-800 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                I'm a Library Owner
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                List and manage your library
              </p>
            </div>
            <div className="mt-auto w-full py-2.5 rounded-xl bg-violet-500/0 group-hover:bg-violet-600 border border-violet-400/30 group-hover:border-transparent text-violet-600 group-hover:text-white text-sm font-bold transition-all duration-300 text-center">
              Sign In / Sign Up →
            </div>
          </Link>
        </div>

        {/* Back */}
        <Link to="/" className="mt-10 text-xs text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60 transition-colors">
          ← Back to Home
        </Link>
      </main>
    </div>
  );
}
