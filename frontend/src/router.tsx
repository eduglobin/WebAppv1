import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import RootLayout from './components/RootLayout';
import LandingPage from './pages/LandingPage';
import RoleSelectPage from './pages/RoleSelectPage';
import LoginPage from './pages/LoginPage';
import SearchPage from './pages/SearchPage';
import RecommendPage from './pages/RecommendPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import LibraryDetailPage from './pages/LibraryDetailPage';
import AdminPortalPage from './pages/AdminPortalPage';
import StudentDashboardPage from './pages/StudentDashboardPage';
import BookingConfirmationPage from './pages/BookingConfirmationPage';
import OwnerPortalPage from './pages/OwnerPortalPage';
import AboutPage from './pages/AboutPage';

const ADMIN_PORTS = ['5174', '5175'];

function AdminPortalRoute() {
  // Hide Admin Portal on public student/owner port 5173
  if (!ADMIN_PORTS.includes(window.location.port)) {
    return <Navigate to="/" replace />;
  }
  return <AdminPortalPage />;
}

function UserOnlyLayout() {
  // On dedicated admin port (5174 or 5175), show ONLY the Admin Portal (no user app layout or user pages)
  if (ADMIN_PORTS.includes(window.location.port)) {
    return <AdminPortalPage />;
  }
  return <RootLayout />;
}

export const router = createBrowserRouter([
  // ── Admin portal: strictly on port 5174 ────────────
  { path: '/admin-portal', element: <AdminPortalRoute /> },

  {
    path: '/',
    element: <UserOnlyLayout />,
    children: [
      { path: '', element: <LandingPage /> },
      { path: 'about', element: <AboutPage /> },

      // ── Role selection page ───────────────────────────────────────────
      { path: 'get-started', element: <RoleSelectPage /> },

      // ── Public student auth (locked to student tab) ───────────────────
      { path: 'student',        element: <LoginPage activeTabProp="student" lockedToTab /> },
      { path: 'student/signup', element: <LoginPage activeTabProp="student" isSignUpProp={true} lockedToTab /> },

      // ── Public owner auth (locked to owner tab) ───────────────────────
      { path: 'owner',        element: <LoginPage activeTabProp="owner" lockedToTab /> },
      { path: 'owner/signup', element: <LoginPage activeTabProp="owner" isSignUpProp={true} lockedToTab /> },

      // ── Legacy redirects ──────────────────────────────────────────────
      { path: 'login',            element: <Navigate to="/student" replace /> },
      { path: 'register',         element: <Navigate to="/get-started" replace /> },
      { path: 'register/student', element: <Navigate to="/student/signup" replace /> },
      { path: 'register/owner',   element: <Navigate to="/owner/signup" replace /> },
      { path: 'staff-portal',     element: <Navigate to="/admin-portal" replace /> },

      // ── App pages ─────────────────────────────────────────────────────
      { path: 'search',        element: <SearchPage /> },
      { path: 'recommend',     element: <RecommendPage /> },
      { path: 'library/:id',   element: <LibraryDetailPage /> },
      { path: 'library/:id/book', element: <LibraryDetailPage /> },
      { path: 'libraries/:id', element: <LibraryDetailPage /> },
      { path: 'libraries/:id/book', element: <LibraryDetailPage /> },
      { path: 'booking/:bookingId/confirmed', element: <BookingConfirmationPage /> },
      { path: 'dashboard',     element: <StudentDashboardPage /> },
      { path: 'owner/portal',  element: <OwnerPortalPage /> },
      { path: 'owner/dashboard', element: <OwnerPortalPage /> },
      { path: 'owner/onboarding', element: <OwnerPortalPage /> },
      { path: 'auth/callback', element: <AuthCallbackPage /> },
    ]
  }
]);