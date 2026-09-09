import React, { useState, useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { ThemeProvider } from './theme/ThemeContext';
import './i18n'; // Initialises react-i18next translations

function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Check if app has already loaded in this session to bypass on refresh
    const hasLoaded = sessionStorage.getItem('eduglobin_has_loaded');
    if (hasLoaded) {
      setShowSplash(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowSplash(false);
      sessionStorage.setItem('eduglobin_has_loaded', 'true');
    }, 1800); // 1.8s splash screen transition

    return () => clearTimeout(timer);
  }, []);

  return (
    <ThemeProvider>
      {showSplash ? (
        <div className="fixed inset-0 z-[10000] bg-[#f6f8fc] dark:bg-slate-950 flex flex-col items-center justify-center transition-colors duration-300">
          <div className="flex flex-col items-center justify-center animate-pulse">
            <img src="/logov1.png" alt="EduGlobin Logo" className="h-32 md:h-40 w-auto object-contain mb-4 select-none pointer-events-none" />
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight select-none flex items-center justify-center">
              <span className="text-[#032b85] dark:text-white">Edu</span>
              <span className="text-[#0f62fe] dark:text-[#00b4ff]">Glob</span>
              <span className="relative inline-block text-[#0f62fe] dark:text-[#00b4ff] leading-none">
                ı
                <span className="absolute -top-[5px] left-[3.5px] w-2.5 h-2.5 bg-[#ff9900] rounded-full"></span>
              </span>
              <span className="text-[#0f62fe] dark:text-[#00b4ff]">n</span>
            </h1>
          </div>
        </div>
      ) : (
        <RouterProvider router={router} />
      )}
    </ThemeProvider>
  );
}

export default App;