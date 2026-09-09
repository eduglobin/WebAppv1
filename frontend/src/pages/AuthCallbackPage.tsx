import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

export default function AuthCallbackPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string>('Processing authentication...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Retrieve session tokens from hash or query parameters (handled automatically by Supabase client)
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) throw sessionErr;

        if (!session) {
          setError('No active session found.');
          return;
        }

        const user = session.user;
        const urlParams = new URLSearchParams(window.location.search);
        const selectedRole = urlParams.get('role') || 'student'; // fallback to student

        setStatus('Setting up your profile...');

        // Check if user already exists in public.profiles table
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profileErr) throw profileErr;

        let userRole = profile?.role;

        if (!profile) {
          // New OAuth User - Create profile row in Postgres via direct insert
          // (Since RLS is disabled by default, frontend can safely run insert)
          const targetRole = selectedRole === 'owner' ? 'LIBRARY_OWNER' : 'STUDENT';
          const initialStatus = targetRole === 'LIBRARY_OWNER' ? 'PENDING_APPROVAL' : 'ACTIVE';

          const newProfile = {
            id: user.id,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Google User',
            role: targetRole,
            auth_provider: 'GOOGLE',
            account_status: initialStatus,
            preferred_language: 'en',
            preferred_theme: 'SYSTEM'
          };

          const { error: insertErr } = await supabase
            .from('profiles')
            .insert([newProfile]);

          if (insertErr) throw insertErr;
          userRole = targetRole;

          // Set metadata role in Supabase auth user so the token contains the role claim
          await supabase.auth.updateUser({
            data: { role: targetRole }
          });
        }

        // Call spring backend to verify role validation and complete session authentication
        setStatus('Verifying session authorization...');
        const response = await axios.get(`${API_BASE}/api/v1/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        const serverRole = response.data?.data?.role;
        const expectedRole = userRole;

        if (serverRole !== expectedRole) {
          await supabase.auth.signOut();
          setError(t('errors.roleMismatch'));
          return;
        }

        setStatus('Redirecting you...');
        // Wait a brief moment and redirect back to the home login screen (which will now see the active session)
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);

      } catch (err: unknown) {
        console.error('Callback error:', err);
        setError((err as { message?: string })?.message || t('errors.generic'));
      }
    };

    handleCallback();
  }, [t]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-4 font-sans text-white text-center">
      <div className="w-full max-w-md bg-white/[0.07] backdrop-blur-xl rounded-3xl border border-white/10 p-8 space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-2xl mb-2">
          <span className="text-3xl animate-pulse">⚡</span>
        </div>
        <h1 className="text-2xl font-bold">EduGlobin Auth</h1>
        {error ? (
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-2xl p-4">
              {error}
            </div>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 font-semibold text-sm transition-all"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-white/60 text-sm">{status}</p>
            <div className="flex justify-center">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
