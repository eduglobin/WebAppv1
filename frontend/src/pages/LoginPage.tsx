import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import axios from 'axios';
import { useTheme } from '../theme/ThemeContext';

type TabRole = 'student' | 'owner' | 'staff' | 'admin';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

const ROLE_MAP: Record<TabRole, string> = {
  student: 'STUDENT',
  owner: 'LIBRARY_OWNER',
  staff: 'STAFF',
  admin: 'SUPER_ADMIN',
};

const SELF_SIGNUP_TABS: TabRole[] = ['student', 'owner'];

interface LoginPageProps {
  activeTabProp?: TabRole;
  isSignUpProp?: boolean;
  /** When true, hides the tab switcher and locks to the given role */
  lockedToTab?: boolean;
}

export default function LoginPage({ activeTabProp, isSignUpProp, lockedToTab = false }: LoginPageProps = {}) {
  const { t, i18n } = useTranslation();
  const { resolvedTheme, setTheme, theme } = useTheme();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabRole>(activeTabProp ?? 'student');
  const [isSignUp, setIsSignUp] = useState(isSignUpProp ?? false);

  useEffect(() => {
    if (activeTabProp) {
      setActiveTab(activeTabProp);
    }
  }, [activeTabProp]);

  useEffect(() => {
    if (isSignUpProp !== undefined) {
      setIsSignUp(isSignUpProp);
    }
  }, [isSignUpProp]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meData, setMeData] = useState<Record<string, string> | null>(null);

  // Student Onboarding Info
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'FEMALE' | 'MALE' | 'OTHER'>('MALE');
  const [targetExam, setTargetExam] = useState('UPSC');
  const [city, setCity] = useState('');

  // Prefill email and mode if passed via URL parameters (e.g. from guest checkout email gate)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    const modeParam = params.get('mode');
    if (emailParam) setEmail(emailParam);
    if (modeParam === 'signup') setIsSignUp(true);
    else if (modeParam === 'login') setIsSignUp(false);
  }, []);

  // Check if session already exists on load
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        try {
          const response = await axios.get(`${API_BASE}/api/v1/me`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (response.data?.success && response.data?.data) {
            const role = response.data.data.role;
            setMeData({
              id:    response.data.data.userId,
              email: response.data.data.email,
              role:  role,
            });

            // Instant auto-redirect to respective portal
            if (role === 'LIBRARY_OWNER') {
              navigate('/owner/portal');
            } else if (role === 'STUDENT') {
              const returnTo = new URLSearchParams(window.location.search).get('returnTo');
              if (returnTo) {
                navigate(decodeURIComponent(returnTo));
              } else {
                navigate('/dashboard');
              }
            } else if (role === 'SUPER_ADMIN' || role === 'STAFF') {
              if (['5174', '5175'].includes(window.location.port)) {
                navigate('/admin-portal');
              } else {
                // Try 5175 first (may be fallback port), then 5174
                window.location.href = 'http://localhost:5175/admin-portal';
              }
            }
          }
        } catch (e) {
          // session invalid/expired on backend
          await supabase.auth.signOut();
        }
      }
    };
    checkSession();
  }, [navigate]);

  // Show all tabs in the hidden staff portal, only the active role tab elsewhere
  const allTabs: { key: TabRole; label: string }[] = [
    { key: 'student', label: t('login.tabs.student') },
    { key: 'owner',   label: t('login.tabs.owner') },
    { key: 'staff',   label: t('login.tabs.staff') },
    { key: 'admin',   label: t('login.tabs.admin') },
  ];
  const tabs = lockedToTab ? allTabs.filter(tab => tab.key === activeTab) : allTabs;

  const switchTab = (tab: TabRole) => {
    setActiveTab(tab);
    setIsSignUp(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let session;

      if (isSignUp) {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role: ROLE_MAP[activeTab],
              preferred_language: i18n.language,
              preferred_theme: theme.toUpperCase(),
              full_name: fullName,
              phone: phone,
              gender: gender,
              target_exam: targetExam,
              city: city,
            },
          },
        });
        if (signUpErr) throw signUpErr;
        session = data.session;

        if (!session) {
          // Attempt direct sign-in in case email auto-confirm is active on Supabase
          const { data: signInData } = await supabase.auth.signInWithPassword({ email, password });
          session = signInData?.session || null;
        }

        if (!session) {
          setError('Account created! Please check your email to confirm, then sign in.');
          setLoading(false);
          return;
        }

        // Provision role + onboarding details in backend profiles
        try {
          await axios.post(
            `${API_BASE}/api/v1/auth/register`,
            {
              role: ROLE_MAP[activeTab],
              fullName,
              phone,
              gender,
              targetExam,
              city,
            },
            { headers: { Authorization: `Bearer ${session.access_token}` } }
          );

          // Sign in fresh so the JWT receives the newly assigned app_metadata.role
          const { data: refreshData } = await supabase.auth.signInWithPassword({ email, password });
          if (refreshData?.session) {
            session = refreshData.session;
          }
        } catch (regErr: any) {
          console.warn('Backend profile registration notification:', regErr);
        }

      } else {
        const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) throw signInErr;
        session = data.session;
      }

      if (!session) {
        setError(t('errors.generic'));
        return;
      }

      // Verify role with Spring backend
      const expectedRole = ROLE_MAP[activeTab];
      let serverRole = expectedRole;
      let userId = session.user?.id;
      let userEmail = session.user?.email || email;

      try {
        const response = await axios.get(`${API_BASE}/api/v1/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        const apiResponse = response.data;
        if (apiResponse?.success && apiResponse?.data) {
          if (apiResponse.data.role && apiResponse.data.role !== 'UNKNOWN' && apiResponse.data.role !== 'authenticated') {
            serverRole = apiResponse.data.role;
          }
          if (apiResponse.data.userId) userId = apiResponse.data.userId;
          if (apiResponse.data.email) userEmail = apiResponse.data.email;
        }
      } catch (meErr) {
        console.warn('Backend /me verification note (proceeding with session role):', meErr);
      }

      setMeData({
        id:    userId || '',
        email: userEmail,
        role:  serverRole,
      });

      // Navigate to destination
      if (serverRole === 'LIBRARY_OWNER') {
        navigate('/owner/portal');
        return;
      } else if (serverRole === 'STUDENT') {
        const returnTo = new URLSearchParams(window.location.search).get('returnTo');
        if (returnTo) {
          navigate(decodeURIComponent(returnTo));
        } else {
          navigate('/dashboard');
        }
        return;
      } else if (serverRole === 'SUPER_ADMIN' || serverRole === 'STAFF') {
        if (['5174', '5175'].includes(window.location.port)) {
          navigate('/admin-portal');
        } else {
          window.location.href = 'http://localhost:5175/admin-portal';
        }
        return;
      } else {
        // Fallback navigation for logged in user
        const returnTo = new URLSearchParams(window.location.search).get('returnTo');
        if (returnTo) {
          navigate(decodeURIComponent(returnTo));
        } else {
          navigate('/dashboard');
        }
        return;
      }
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? '';
      if (msg.toLowerCase().includes('invalid login') || msg.toLowerCase().includes('invalid credentials')) {
        setError(t('errors.invalidCredentials'));
      } else if (msg.toLowerCase().includes('suspended')) {
        setError(t('errors.accountSuspended'));
      } else {
        setError(msg || t('errors.generic'));
      }
    } finally {
      setLoading(false);
    }
  };


  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?role=${activeTab}`,
        },
      });
      if (oauthErr) throw oauthErr;
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || t('errors.generic'));
    }
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const toggleLang = () => {
    const next = i18n.language === 'en' ? 'hi' : 'en';
    i18n.changeLanguage(next);
    localStorage.setItem('eduglobin_lang', next);
  };

  return (
    <div className="min-h-screen bg-[#f6f8fc] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#eef2f9] via-white to-[#f6f8fc] dark:bg-slate-950 dark:from-indigo-950 dark:via-slate-950 dark:to-slate-950 flex items-center justify-center p-4 font-sans transition-colors duration-300">

      {/* Background visual graphics matching mock-up */}
      <div className="hidden lg:block absolute bottom-0 left-0 w-80 h-80 opacity-20 dark:opacity-40 pointer-events-none transition-opacity">
        <svg viewBox="0 0 200 200" fill="none" className="w-full h-full text-indigo-400">
          <circle cx="50" cy="150" r="30" fill="currentColor" opacity="0.1" />
          <path d="M20,180 L80,180" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>

      {/* Top-right controls */}
      <div className="fixed top-4 right-4 flex gap-2 z-50">
        <button
          onClick={toggleLang}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-200/60 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300/40 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white/80 dark:hover:text-white dark:border-white/10 backdrop-blur transition-all shadow-sm"
        >
          🌐 {i18n.language === 'en' ? 'हिन्दी' : 'English'}
        </button>

        <button
          onClick={toggleTheme}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-200/60 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300/40 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white/80 dark:hover:text-white dark:border-white/10 backdrop-blur transition-all shadow-sm"
        >
          {resolvedTheme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      <div className="w-full max-w-[500px] md:max-w-[520px] relative z-10">
        {/* Logo / Brand */}
        <div className="text-center mb-6">
          {/* Brand Logo */}
          <div className="inline-flex items-center justify-center mb-0.5">
            <img src="/logov1.png" alt="EduGlobin Logo" className="h-24 w-auto object-contain select-none pointer-events-none" />
          </div>
          
          {/* Two-tone text and orange dot i */}
          <h1 className="text-4xl font-extrabold tracking-tight transition-colors select-none flex items-center justify-center">
            <span className="text-[#032b85] dark:text-white">Edu</span>
            <span className="text-[#0f62fe] dark:text-[#00b4ff]">Glob</span>
            <span className="relative inline-block text-[#0f62fe] dark:text-[#00b4ff] leading-none">
              ı
              <span className="absolute -top-[5px] left-[3.5px] w-2 h-2 bg-[#ff9900] rounded-full"></span>
            </span>
            <span className="text-[#0f62fe] dark:text-[#00b4ff]">n</span>
          </h1>

          {/* Tagline with side dividers */}
          <div className="flex items-center justify-center gap-3 mt-2 text-slate-500 dark:text-white/40 text-xs font-semibold select-none">
            <div className="w-8 h-[1px] bg-slate-300 dark:bg-[#00b4ff]/80"></div>
            <span>{t('tagline')}</span>
            <div className="w-8 h-[1px] bg-slate-300 dark:bg-[#00b4ff]/80"></div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200/80 dark:bg-[#111322] dark:border-white/10 shadow-2xl rounded-3xl p-7 transition-colors">

          {/* Tab Switcher — hidden when locked to a single role */}
          {!lockedToTab ? (
            <div className="flex rounded-2xl bg-slate-100 dark:bg-white/5 p-1.5 gap-1 mb-6 transition-colors">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  id={`tab-${tab.key}`}
                  onClick={() => switchTab(tab.key)}
                  className={`flex-1 py-2 px-1 rounded-xl text-xs font-bold transition-all duration-300 ${
                    activeTab === tab.key
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/20'
                      : 'text-slate-500 hover:text-slate-800 dark:text-white/40 dark:hover:text-white/80'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-600/10 border border-indigo-100 dark:border-indigo-500/20 text-xs font-bold text-indigo-700 dark:text-indigo-400">
                  {activeTab === 'student' ? '🎓' : '🏛️'} {tabs[0]?.label}
                </span>
                <a href="/" className="text-xs text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60 transition-colors">
                  ← Back
                </a>
              </div>
            </div>
          )}

          {/* Success panel */}
          {meData ? (
            <div className="space-y-5">
              <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400 font-bold">
                <span className="text-2xl">✅</span>
                <span className="text-lg">{t('me.loggedInAs')}</span>
              </div>
              <div className="bg-slate-50 border border-slate-200/60 dark:bg-white/5 dark:border-white/10 rounded-2xl p-5 space-y-3.5 text-sm transition-colors">
                <div className="flex justify-between text-slate-500 dark:text-white/60">
                  <span>{t('me.yourEmail')}</span>
                  <span className="text-slate-900 dark:text-white font-semibold">{meData.email}</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-white/60">
                  <span>{t('me.yourRole')}</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{meData.role}</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-white/60">
                  <span>{t('me.yourId')}</span>
                  <span className="text-slate-400 dark:text-white/30 text-xs font-mono truncate max-w-[150px]">{meData.id}</span>
                </div>
              </div>

              {/* Role-Specific Direct Portal CTAs */}
              {meData.role === 'LIBRARY_OWNER' && (
                <Link
                  to="/owner/portal"
                  className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold text-center block transition shadow-md shadow-violet-500/20"
                >
                  Enter Owner Portal & Onboarding Wizard →
                </Link>
              )}
              {meData.role === 'STUDENT' && (
                <Link
                  to="/dashboard"
                  className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold text-center block transition shadow-md shadow-violet-500/20"
                >
                  Enter Student Dashboard →
                </Link>
              )}
              {(meData.role === 'SUPER_ADMIN' || meData.role === 'STAFF') && (
                <Link
                  to="/admin-portal"
                  className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold text-center block transition shadow-md shadow-rose-500/20"
                >
                  Enter Admin Portal →
                </Link>
              )}

              <button
                onClick={async () => { await supabase.auth.signOut(); setMeData(null); setEmail(''); setPassword(''); }}
                className="w-full py-2.5 rounded-xl bg-slate-200/60 hover:bg-slate-200 text-slate-700 hover:text-slate-900 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white/70 dark:hover:text-white text-xs font-semibold transition-all shadow-sm"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <>
              {/* Form Title */}
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white transition-colors">
                  {isSignUp ? t('login.welcomeNew') : t('login.welcomeBack')}
                </h2>
                <p className="text-xs text-slate-500 dark:text-white/40 mt-1 transition-colors">
                  {isSignUp 
                    ? (i18n.language.startsWith('hi') ? 'शुरू करने के लिए अपना खाता बनाएं' : 'Create your account to get started') 
                    : (i18n.language.startsWith('hi') ? 'अपने खाते में आगे बढ़ने के लिए लॉग इन करें' : 'Log in to continue to your account')
                  }
                </p>
              </div>

              {/* Notice text for provisioned roles */}
              {!SELF_SIGNUP_TABS.includes(activeTab) && (
                <div className="bg-slate-50 border border-slate-200/60 dark:bg-white/5 dark:border-white/5 rounded-xl p-3.5 mb-5 text-center transition-colors">
                  <p className="text-xs text-slate-600 dark:text-white/60 font-medium leading-relaxed">{t('login.contactAdmin')}</p>
                </div>
              )}

              {/* Login/Signup Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-white/50 mb-1.5 transition-colors">Full Name</label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 placeholder-slate-400 dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. Rahul Sharma"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-white/50 mb-1.5 transition-colors">Phone Number</label>
                        <input
                          type="tel"
                          required
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 placeholder-slate-400 dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="9876543210"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-white/50 mb-1.5 transition-colors">Gender *</label>
                        <select
                          value={gender}
                          onChange={e => setGender(e.target.value as any)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 dark:bg-[#15192c] dark:border-white/10 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="MALE">Male ♂</option>
                          <option value="FEMALE">Female ♀</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                    </div>

                    {activeTab === 'student' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-white/50 mb-1.5 transition-colors">Target Exam</label>
                          <select
                            value={targetExam}
                            onChange={e => setTargetExam(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 dark:bg-[#15192c] dark:border-white/10 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="UPSC">UPSC / Civil Services</option>
                            <option value="NEET">NEET / Medical</option>
                            <option value="JEE">JEE / Engineering</option>
                            <option value="GATE">GATE / PSU</option>
                            <option value="CA">CA / CS / Finance</option>
                            <option value="SSC">SSC / Railway</option>
                            <option value="BANKING">Banking / IBPS</option>
                            <option value="OTHER">Other Exams</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-white/50 mb-1.5 transition-colors">City / Locality</label>
                          <input
                            type="text"
                            required
                            value={city}
                            onChange={e => setCity(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 placeholder-slate-400 dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="e.g. Indore"
                          />
                        </div>
                      </div>
                    )}

                    {activeTab !== 'student' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-white/50 mb-1.5 transition-colors">City / Locality</label>
                        <input
                          type="text"
                          required
                          value={city}
                          onChange={e => setCity(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 placeholder-slate-400 dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="e.g. Indore (Bhawarkua)"
                        />
                      </div>
                    )}
                  </>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-white/50 mb-1.5 transition-colors">{t('login.emailLabel')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-white/30">
                      {/* Envelope icon */}
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                      </svg>
                    </div>
                    <input
                      id={`email-${activeTab}`}
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-slate-800 placeholder-slate-400 dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      placeholder="admin@eduglobin.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-white/50 mb-1.5 transition-colors">{t('login.passwordLabel')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-white/30">
                      {/* Lock icon */}
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                      </svg>
                    </div>
                    <input
                      id={`password-${activeTab}`}
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-11 py-3 text-slate-800 placeholder-slate-400 dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      placeholder="•••••••••••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:text-white/30 dark:hover:text-white/60 transition-colors"
                    >
                      {/* Eye / Eye slash icon */}
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember me & Forgot password row */}
                <div className="flex items-center justify-between text-xs font-semibold">
                  <label className="flex items-center gap-2 text-slate-500 dark:text-white/50 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-white dark:border-white/10 dark:bg-white/5"
                    />
                    <span>{t('login.rememberMe')}</span>
                  </label>
                  <button type="button" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                    {t('login.forgotPassword')}
                  </button>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl px-4 py-3">
                    {error}
                  </div>
                )}

                {/* Sign In Button */}
                <button
                  id={`submit-${activeTab}`}
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <span>
                    {loading
                      ? (isSignUp ? t('login.signingUp') : t('login.signingIn'))
                      : (isSignUp ? t('login.signUp') : t('login.signIn'))
                    }
                  </span>
                  {!loading && (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  )}
                </button>

                {/* Sign-up toggle for self-serve tabs */}
                {SELF_SIGNUP_TABS.includes(activeTab) && (
                  <p className="text-center text-slate-400 dark:text-white/40 text-xs pt-1 transition-colors">
                    {isSignUp ? t('login.backToLogin').split('?')[0] + '? ' : t('login.orSignUp') + ' '}
                    <button
                      type="button"
                      id={`toggle-signup-${activeTab}`}
                      onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
                      className="text-indigo-600 dark:text-indigo-400 font-bold underline-offset-2 hover:underline transition-colors"
                    >
                      {isSignUp ? t('login.signIn') : t('login.createAccount')}
                    </button>
                  </p>
                )}
              </form>

              {/* Social Login Section (Google OAuth) - Only for Student / Owner */}
              {SELF_SIGNUP_TABS.includes(activeTab) && (
                <div className="mt-6 space-y-4">
                  <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-white/10"></div>
                    </div>
                    <span className="relative px-3 bg-white dark:bg-[#111322] text-xs font-bold text-slate-400 dark:text-white/30 transition-colors uppercase tracking-wider">
                      {t('login.orContinueWith')}
                    </span>
                  </div>

                  <div className="flex justify-center gap-3">
                    {/* Google OAuth Button */}
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      className="w-12 h-12 flex items-center justify-center rounded-xl bg-white border border-slate-200 hover:bg-slate-50 dark:bg-white/[0.05] dark:border-white/10 dark:hover:bg-white/[0.1] transition-all shadow-sm"
                      title={t('login.continueWithGoogle')}
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6-4.53z" fill="#EA4335"/>
                      </svg>
                    </button>

                    {/* Microsoft Button (Mocked Layout) */}
                    <button
                      type="button"
                      className="w-12 h-12 flex items-center justify-center rounded-xl bg-white border border-slate-200 hover:bg-slate-50 dark:bg-white/[0.05] dark:border-white/10 dark:hover:bg-white/[0.1] transition-all opacity-50 cursor-not-allowed shadow-sm"
                      title="Microsoft Sign-in (Disabled)"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 0h11v11H0z" fill="#F25022"/>
                        <path d="M12 0h11v11H12z" fill="#7FBA00"/>
                        <path d="M0 12h11v11H0z" fill="#00A4EF"/>
                        <path d="M12 12h11v11H12z" fill="#FFB900"/>
                      </svg>
                    </button>

                    {/* Apple Button (Mocked Layout) */}
                    <button
                      type="button"
                      className="w-12 h-12 flex items-center justify-center rounded-xl bg-white border border-slate-200 hover:bg-slate-50 dark:bg-white/[0.05] dark:border-white/10 dark:hover:bg-white/[0.1] transition-all opacity-50 cursor-not-allowed shadow-sm"
                      title="Apple Sign-in (Disabled)"
                    >
                      <svg className="w-5 h-5 text-slate-800 dark:text-white" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.57 2.95-1.39z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <p className="text-center text-slate-400 dark:text-white/20 text-xs mt-6 transition-colors">
          © 2026 EduGlobin · All Rights Reserved
        </p>
      </div>
    </div>
  );
}
