import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import StudentDashboardPage from './StudentDashboardPage';
import OwnerPortalPage from './OwnerPortalPage';
import AdminPortalPage from './AdminPortalPage';

interface Library {
  id: string;
  name: string;
  distanceKm: number;
  monthlyPrice: number;
  rating: number;
  girlsSafetyScore: number;
  acAvailable: boolean;
  amenities: string[];
  focusedExams: string[];
  seatingType: string;
  hasGirlsSection: boolean;
  locality: string;
  city?: string;
  isFree?: boolean;
  lat: number;
  lng: number;
  matchScore: number;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

export default function LandingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [featuredLibraries, setFeaturedLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const checkAuthAndFeatured = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          try {
            const res = await axios.get(`${API_BASE}/api/v1/me`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (res.data?.success && res.data?.data) {
              setUserRole(res.data.data.role);
            }
          } catch (e) {
            console.warn('Session verification failed on landing page:', e);
          }
        }

        const response = await axios.get(`${API_BASE}/api/v1/libraries/search?sortBy=RATING&limit=3`);
        if (response.data && response.data.success) {
          setFeaturedLibraries(response.data.data);
        }
      } catch (error) {
        console.error('Error fetching featured libraries:', error);
      } finally {
        setLoading(false);
      }
    };
    checkAuthAndFeatured();
  }, []);

  if (userRole === 'STUDENT') return <StudentDashboardPage />;
  if (userRole === 'LIBRARY_OWNER') return <OwnerPortalPage />;
  if (userRole === 'SUPER_ADMIN' || userRole === 'STAFF') return <AdminPortalPage />;

  return (
    <div className="min-h-screen bg-[#f8f8f8] text-neutral-900 font-sans flex flex-col">
      {/* Dark Navbar */}
      <nav className="bg-[#171717] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-white text-black rounded-full flex items-center justify-center font-bold text-xs">E</div>
          <span className="font-semibold text-lg tracking-tight">EduGlobin</span>
        </div>
        <div className="hidden md:flex items-center gap-4 text-sm">
          <Link to="/search" className="hover:text-gray-300 mr-2">Find a library</Link>
          <Link to="/forum" className="hover:text-gray-300 mr-2">Forum</Link>
          <Link to="/student" className="bg-[#ffdb4d] text-black px-4 py-1.5 rounded-full font-medium hover:bg-[#e6c545] transition-colors">
            Student Login
          </Link>
          <Link to="/owner" className="border border-white text-white px-4 py-1.5 rounded-full font-medium hover:bg-white/10 transition-colors">
            Partner Login
          </Link>
        </div>
      </nav>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 md:py-20">
        
        {/* HERO */}
        <div className="max-w-2xl mb-12">
          <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-4 tracking-tight">
            Find a quiet seat to study, <span className="bg-[#ffdb4d] px-2 whitespace-nowrap">near you.</span>
          </h1>
          <p className="text-gray-600 text-lg md:text-xl">
            Self-study libraries for UPSC, JEE, NEET and more. See real prices and live seats, hold one in a minute, pay at the desk.
          </p>
        </div>

        {/* SEARCH BAR */}
        <div className="flex flex-col md:flex-row gap-2 mb-8">
          <div className="flex-1 flex items-center bg-white border border-gray-300 rounded-lg overflow-hidden px-3 py-1 shadow-sm">
            <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input 
              type="text" 
              placeholder="Locality, city or library name" 
              className="flex-1 outline-none py-2 text-gray-800 placeholder-gray-500"
            />
          </div>
          <button className="flex items-center justify-center gap-2 bg-white border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors shadow-sm">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="font-medium text-gray-700">Near me</span>
          </button>
          <button onClick={() => navigate('/search')} className="bg-[#ffdb4d] hover:bg-[#e6c545] text-black font-semibold rounded-lg px-8 py-3 transition-colors shadow-sm">
            Search
          </button>
        </div>

        {/* JOIN/LOGIN OPTIONS */}
        <div className="flex flex-wrap items-center gap-4 mb-10">
          <Link to="/student" className="bg-[#171717] hover:bg-black text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2">
            👨‍🎓 I'm a Student
          </Link>
          <Link to="/owner" className="bg-white hover:bg-gray-50 text-[#171717] border border-gray-300 px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2">
            🏢 I'm a Library Partner
          </Link>
        </div>

        {/* FILTERS */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-16 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Preparing for:</span>
            <div className="flex gap-2">
              {['UPSC', 'MPSC', 'JEE', 'NEET', 'SSC', 'Banking'].map(exam => (
                <button key={exam} className="px-3 py-1 bg-white border border-gray-200 rounded-full hover:bg-gray-50 text-gray-700">
                  {exam}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Popular:</span>
            <div className="flex gap-3 text-gray-700">
              {['Indore', 'Kota', 'Delhi', 'Latur', 'Baramati', 'Patna'].map(city => (
                <a key={city} href={`/search?city=${city}`} className="hover:underline">{city}</a>
              ))}
            </div>
          </div>
        </div>

        {/* FEATURED LIBRARIES */}
        <div className="mb-20">
          <div className="flex justify-between items-end border-b border-gray-300 pb-2 mb-6">
            <h2 className="text-xl font-bold">Libraries for UPSC in Indore</h2>
            <Link to="/search" className="text-sm text-gray-500 hover:underline">Found 43</Link>
          </div>
          
          <div className="grid md:grid-cols-3 gap-4">
            {loading ? (
              [1, 2, 3].map(n => <div key={n} className="h-32 bg-white rounded-lg animate-pulse border border-gray-200"></div>)
            ) : (
              featuredLibraries.map(lib => (
                <Link to={`/libraries/${lib.id}`} key={lib.id} className="bg-white border border-gray-200 p-4 rounded-xl hover:shadow-md transition-shadow block">
                  <h3 className="font-bold text-lg mb-1">{lib.name}</h3>
                  <p className="text-sm text-gray-500 mb-3">{lib.locality || 'Bhawarkua'} • {lib.distanceKm || '1.2'} km • {lib.rating || '4.6'} ({Math.floor(Math.random() * 100 + 10)})</p>
                  <div className="flex gap-2 mb-4">
                    <span className="px-2 py-0.5 text-xs bg-gray-100 border border-gray-200 rounded text-gray-700">UPSC</span>
                    {lib.acAvailable && <span className="px-2 py-0.5 text-xs bg-gray-100 border border-gray-200 rounded text-gray-700">AC</span>}
                    {lib.hasGirlsSection && <span className="px-2 py-0.5 text-xs bg-gray-100 border border-gray-200 rounded text-gray-700">Girls room</span>}
                  </div>
                  <div className="text-sm">
                    <span className="font-bold">₹{lib.monthlyPrice || '800'}</span> / month <span className="text-gray-400 mx-1">•</span> <span className="text-gray-500">14 seats free</span>
                  </div>
                </Link>
              ))
            )}
            
            {/* Fallback mock cards if API returns less than 3 */}
            {featuredLibraries.length < 3 && (
              <>
                <Link to="/search" className="bg-white border border-gray-200 p-4 rounded-xl hover:shadow-md transition-shadow block">
                  <h3 className="font-bold text-lg mb-1">Shanti Library</h3>
                  <p className="text-sm text-gray-500 mb-3">Vijay Nagar • 3.4 km • 4.4 (18)</p>
                  <div className="flex gap-2 mb-4">
                    <span className="px-2 py-0.5 text-xs bg-gray-100 border border-gray-200 rounded text-gray-700">UPSC</span>
                    <span className="px-2 py-0.5 text-xs bg-gray-100 border border-gray-200 rounded text-gray-700">AC</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-bold">₹1,100</span> / month <span className="text-gray-400 mx-1">•</span> <span className="text-gray-500">7 seats free</span>
                  </div>
                </Link>
                <Link to="/search" className="bg-white border border-gray-200 p-4 rounded-xl hover:shadow-md transition-shadow block">
                  <h3 className="font-bold text-lg mb-1">Gyan Deep Reading Hall</h3>
                  <p className="text-sm text-gray-500 mb-3">Bhawarkua • 1.9 km • New</p>
                  <div className="flex gap-2 mb-4">
                    <span className="px-2 py-0.5 text-xs bg-gray-100 border border-gray-200 rounded text-gray-700">MPSC</span>
                    <span className="px-2 py-0.5 text-xs bg-gray-100 border border-gray-200 rounded text-gray-700">Lockers</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-bold">₹700</span> / month <span className="text-gray-400 mx-1">•</span> <span className="text-gray-500">22 seats free</span>
                  </div>
                </Link>
              </>
            )}
          </div>
        </div>

      </main>

      {/* BOTTOM BANNER */}
      <div className="bg-[#171717] text-white px-6 py-12 mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center">
          <div className="mb-6 md:mb-0">
            <h2 className="text-3xl font-bold mb-3">Run your library from one screen.</h2>
            <ul className="text-gray-400 space-y-1 text-sm list-disc pl-5">
              <li>Get your revenue 2 minutes</li>
              <li>Manage and book seats with one login</li>
            </ul>
          </div>
          <Link to="/owner/signup" className="bg-[#ffdb4d] hover:bg-[#e6c545] text-black font-semibold rounded-lg px-8 py-3 transition-colors">
            List your library
          </Link>
        </div>
      </div>
    </div>
  );
}

