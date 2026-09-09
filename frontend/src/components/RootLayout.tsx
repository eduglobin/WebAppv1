import React, { useState, useEffect } from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function RootLayout() {
  const location = useLocation();
  const { i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState({ en: '', hi: '' });

  const quotes = [
    {
      en: "Education is the most powerful weapon which you can use to change the world. — Nelson Mandela",
      hi: "शिक्षा सबसे शक्तिशाली हथियार है जिसका उपयोग आप दुनिया को बदलने के लिए कर सकते हैं। — नेल्सन मंडेला"
    },
    {
      en: "The beautiful thing about learning is that no one can take it away from you. — B.B. King",
      hi: "सीखने की सबसे खूबसूरत बात यह है कि इसे आपसे कोई छीन नहीं सकता। — बी.बी. किंग"
    },
    {
      en: "Arise, awake, and stop not till the goal is reached. — Swami Vivekananda",
      hi: "उठो, जागो और तब तक मत रुको जब तक लक्ष्य प्राप्त न हो जाए। — स्वामी विवेकानंद"
    },
    {
      en: "Live as if you were to die tomorrow. Learn as if you were to live forever. — Mahatma Gandhi",
      hi: "ऐसे जिएं जैसे कि आप कल मरने वाले हों। ऐसे सीखें जैसे कि आप हमेशा जीने वाले हों। — महात्मा गांधी"
    },
    {
      en: "Learning is not attained by chance, it must be sought for with ardor and diligence. — Abigail Adams",
      hi: "ज्ञान संयोग से प्राप्त नहीं होता, इसे उत्साह और लगन के साथ खोजना चाहिए। — एबीगैल एडम्स"
    }
  ];

  useEffect(() => {
    // Skip transition screen for initial mount as it is handled by the main Splash Screen
    const isFirstLoad = !sessionStorage.getItem('eduglobin_has_loaded');
    if (isFirstLoad) return;

    setLoading(true);
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    setQuote(randomQuote);

    const timer = setTimeout(() => {
      setLoading(false);
    }, 850); // 850ms transition loading screen

    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    <>
      {loading && (
        <div className="fixed inset-0 z-[9999] bg-[#f6f8fc] dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center transition-all duration-300">
          <div className="w-14 h-14 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mb-8"></div>
          <div className="max-w-xl mx-auto px-6">
            <p className="text-xl md:text-2xl font-headers font-bold text-slate-800 dark:text-white leading-relaxed">
              {i18n.language === 'en' ? quote.en : quote.hi}
            </p>
          </div>
        </div>
      )}
      <div className={loading ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}>
        <Outlet />
      </div>
    </>
  );
}
