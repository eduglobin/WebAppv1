import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

export default function ProtectedRoute({ 
  children, 
  allowedRole 
}: { 
  children: React.ReactNode, 
  allowedRole?: 'STUDENT' | 'LIBRARY_OWNER' | 'ADMIN' 
}) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasRole, setHasRole] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          if (mounted) {
            setIsAuthenticated(false);
            setLoading(false);
          }
          return;
        }

        if (mounted) setIsAuthenticated(true);

        if (allowedRole) {
          try {
            const res = await axios.get(`${API_BASE}/api/v1/me`, {
              headers: { Authorization: `Bearer ${session.access_token}` }
            });
            const userRole = res.data?.data?.role;
            if (mounted) setHasRole(userRole === allowedRole);
          } catch (err) {
            if (mounted) setHasRole(false);
          }
        } else {
          if (mounted) setHasRole(true);
        }
      } catch (err) {
        if (mounted) setIsAuthenticated(false);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [allowedRole]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to respective login pages based on requested route
    if (location.pathname.startsWith('/owner')) {
      return <Navigate to="/owner" replace />;
    }
    return <Navigate to="/student" replace />;
  }

  if (allowedRole && !hasRole) {
    // If authenticated but wrong role, redirect to home
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
