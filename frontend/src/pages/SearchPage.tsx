import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import LibraryMap from '../components/LibraryMap';
import LibraryCard from '../components/LibraryCard';
import StudentSidebar from '../components/StudentSidebar';

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
  lat: number;
  lng: number;
  matchScore: number;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

type SearchMode = 'GPS' | 'CITY';

export default function SearchPage() {
  const { t, i18n } = useTranslation();
  const isHi = i18n.language?.startsWith('hi');
  const navigate = useNavigate();

  // ── Search Mode ──────────────────────────────────────────────────────────
  const [searchMode, setSearchMode] = useState<SearchMode>('GPS');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cityInput, setCityInput] = useState('');

  // ── GPS Location ─────────────────────────────────────────────────────────
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locationLabel, setLocationLabel] = useState<string>('');
  const [gpsStatus, setGpsStatus] = useState<'IDLE' | 'DETECTING' | 'GRANTED' | 'DENIED'>('IDLE');

  // ── Filters ───────────────────────────────────────────────────────────────
  const [radiusKm, setRadiusKm] = useState<number>(20);
  const [maxMonthlyPrice, setMaxMonthlyPrice] = useState<number>(2500);
  const [minSafetyScore, setMinSafetyScore] = useState<number>(70);
  const [acRequired, setAcRequired] = useState<boolean>(false);
  const [girlsOnlyOnly, setGirlsOnlyOnly] = useState<boolean>(false);
  const [seatingType, setSeatingType] = useState<string>('');
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>('RELEVANCE');

  // ── Results ───────────────────────────────────────────────────────────────
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState<boolean>(false);

  // ── GPS Detection ─────────────────────────────────────────────────────────
  const detectGpsLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus('DENIED');
      return;
    }
    setGpsStatus('DETECTING');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLat(latitude);
        setLng(longitude);
        setLocationLabel('📍 Current Device Location (GPS)');
        setGpsStatus('GRANTED');
      },
      (error) => {
        console.warn('GPS denied:', error.message);
        setGpsStatus('DENIED');
        setLat(null);
        setLng(null);
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  };

  // ── Fetch Libraries ───────────────────────────────────────────────────────
  const fetchLibraries = async () => {
    setLoading(true);
    setHasSearched(true);

    try {
      const params = new URLSearchParams();

      if (searchQuery.trim()) {
        params.append('query', searchQuery.trim());
      }

      if (searchMode === 'GPS') {
        if (lat !== null && lng !== null) {
          params.append('lat', lat.toString());
          params.append('lng', lng.toString());
          params.append('radiusKm', radiusKm.toString());
        }
      } else {
        // City-based search
        if (cityInput.trim()) {
          params.append('city', cityInput.trim());
          params.append('radiusKm', '9999'); // broad radius for city search
        }
      }

      params.append('maxMonthlyPrice', maxMonthlyPrice.toString());
      params.append('minSafetyScore', minSafetyScore.toString());
      params.append('acRequired', acRequired.toString());
      params.append('girlsOnlyOnly', girlsOnlyOnly.toString());
      if (seatingType) params.append('seatingType', seatingType);
      if (sortBy) params.append('sortBy', sortBy);
      selectedExams.forEach(exam => params.append('examFocus', exam));

      const response = await axios.get(`${API_BASE}/api/v1/libraries/search?${params.toString()}`);
      if (response.data?.success) {
        setLibraries((response.data.data || []).map((l: any) => ({
          ...l,
          isFree: l.isFree !== undefined ? l.isFree : (l.is_free || l.monthlyPrice === 0 || l.monthly_price === 0)
        })));
      } else {
        setLibraries([]);
      }
    } catch (e) {
      console.error('Search error:', e);
      setLibraries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleHubSelect = (hubLat: number, hubLng: number, name: string) => {
    setLat(hubLat);
    setLng(hubLng);
    setLocationLabel(name);
    setGpsStatus('GRANTED');
    setSearchMode('GPS');
  };

  const toggleExam = (exam: string) => {
    setSelectedExams(prev =>
      prev.includes(exam) ? prev.filter(e => e !== exam) : [...prev, exam]
    );
  };

  const canSearch =
    searchQuery.trim().length >= 1 ||
    (searchMode === 'GPS' && gpsStatus === 'GRANTED' && lat !== null) ||
    (searchMode === 'CITY' && cityInput.trim().length >= 2);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="h-screen bg-[#f8fafc] dark:bg-[#070b14] text-slate-900 dark:text-slate-100 flex overflow-hidden transition-colors duration-300">
      <StudentSidebar activeItemId="search" isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* TOP HEADER */}
        <header className="bg-white dark:bg-[#0c1220] border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center gap-4 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center w-full sm:w-auto gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-800">
              ☰
            </button>
            <div className="flex-1 sm:w-80 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchLibraries()}
                placeholder="Search libraries, areas, or landmarks..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-full text-sm focus:ring-2 focus:ring-violet-500 transition-all"
              />
            </div>
          </div>
          
          <div className="flex w-full sm:w-auto items-center gap-3 sm:ml-auto">
            <div className="relative flex-1 sm:w-48">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">📍</span>
              <input
                type="text"
                value={cityInput}
                onChange={e => {
                  setCityInput(e.target.value);
                  setSearchMode('CITY');
                }}
                onKeyDown={e => e.key === 'Enter' && fetchLibraries()}
                placeholder="Indore"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-full text-sm focus:ring-2 focus:ring-violet-500 transition-all"
              />
            </div>
            <button onClick={fetchLibraries} className="p-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-full transition-colors flex-shrink-0 shadow-md">
              🔍
            </button>
          </div>
        </header>

        {/* SCROLLABLE MAIN */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
          
          {/* HERO BANNER */}
          <div className="mb-8 p-6 rounded-3xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-indigo-900/30 border border-indigo-100 dark:border-indigo-800 flex flex-col md:flex-row items-center justify-between">
            <div>
              <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">FIND YOUR PERFECT STUDY SPACE</p>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white font-headers">
                Search Libraries in <span className="text-blue-600 dark:text-blue-400">{cityInput || 'Indore'}</span>
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-lg">
                Discover verified libraries, compare facilities, and book your seat in seconds. A focused mind, a brighter future.
              </p>
            </div>
            <div className="hidden md:block text-5xl">
              👨‍💻
            </div>
          </div>

          {/* HORIZONTAL FILTERS BAR */}
          <div className="flex flex-wrap items-center gap-3 mb-6 bg-white dark:bg-[#0c1220] p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-1.5 px-3 py-1.5 border-r border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200">
              <span className="text-violet-600">⚙️</span> Filters
            </div>
            
            {searchMode === 'GPS' && (
              <button onClick={() => setRadiusKm(radiusKm === 5 ? 15 : 5)} className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-2">
                <span>📍 Distance:</span> <span className="text-violet-600">{radiusKm} km</span>
              </button>
            )}
            
            <button onClick={() => setMaxMonthlyPrice(maxMonthlyPrice === 2500 ? 1000 : 2500)} className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-2">
              <span>💰 Price:</span> <span className="text-violet-600">≤ ₹{maxMonthlyPrice}</span>
            </button>

            <button onClick={() => setAcRequired(!acRequired)} className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 border ${acRequired ? 'border-sky-500 bg-sky-50 text-sky-700' : 'bg-slate-100 border-transparent hover:bg-slate-200 text-slate-700'}`}>
              ❄️ AC {acRequired ? '✓' : 'Any'}
            </button>
            
            <button onClick={() => setGirlsOnlyOnly(!girlsOnlyOnly)} className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 border ${girlsOnlyOnly ? 'border-pink-500 bg-pink-50 text-pink-700' : 'bg-slate-100 border-transparent hover:bg-slate-200 text-slate-700'}`}>
              🩷 Girls Safe {girlsOnlyOnly ? '✓' : ''}
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            
            {/* RESULTS LIST */}
            <div className="flex-1 flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 dark:text-slate-200">
                  {loading ? 'Searching...' : `${libraries.length} libraries found`}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-semibold uppercase">Sort by</span>
                  <select 
                    value={sortBy} 
                    onChange={e => setSortBy(e.target.value)}
                    className="text-sm font-bold bg-transparent border-none focus:ring-0 cursor-pointer"
                  >
                    <option value="RELEVANCE">Best Match</option>
                    <option value="DISTANCE">Nearest First</option>
                    <option value="PRICE_ASC">Price Low to High</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                  {[1,2,3].map(i => <div key={i} className="h-40 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse"></div>)}
                </div>
              ) : libraries.length === 0 && hasSearched ? (
                <div className="py-12 text-center text-slate-500">
                   No libraries found for your criteria. Try adjusting filters or city.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                  {libraries.map(lib => (
                    <LibraryCard key={lib.id} library={lib} matchExplanation={sortBy === 'RELEVANCE' ? `${Math.round(lib.matchScore * 100)}% Match` : undefined} />
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT SIDE (MAP & SUGGESTIONS) */}
            <div className="w-full lg:w-[350px] xl:w-[400px] flex-shrink-0 flex flex-col gap-6">
              
              {/* Map Preview */}
              <div className="bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm h-80 flex flex-col relative group">
                {lat !== null && lng !== null ? (
                   <LibraryMap center={{ lat, lng }} radiusKm={radiusKm} libraries={libraries} />
                ) : (
                   <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800/50 p-6 text-center">
                      <span className="text-3xl mb-2">📍</span>
                      <p className="text-sm font-bold text-slate-700">Location not enabled</p>
                      <button onClick={detectGpsLocation} className="mt-3 px-4 py-2 bg-white rounded-lg shadow text-xs font-bold text-violet-600">
                        Enable GPS Map
                      </button>
                   </div>
                )}
                {/* Search In This Area overlay button */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={fetchLibraries} className="px-4 py-2 bg-slate-900/90 text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-2 backdrop-blur-sm">
                     <span>📍</span> Search in this area
                   </button>
                </div>
              </div>

              {/* Popular Areas */}
              <div className="bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white">Popular Areas in {cityInput || 'Indore'}</h3>
                  <button className="text-xs font-bold text-violet-600">View All</button>
                </div>
                <div className="space-y-3">
                  {[
                    { name: 'Vijay Nagar', count: 12 },
                    { name: 'Palasia', count: 8 },
                    { name: 'Bhawarkua', count: 10 },
                    { name: 'Geeta Bhawan', count: 6 },
                    { name: 'Scheme 78', count: 5 }
                  ].map((area, idx) => (
                    <button 
                      key={idx}
                      onClick={() => {
                        setCityInput(area.name);
                        setSearchMode('CITY');
                        fetchLibraries();
                      }} 
                      className="w-full flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">📍</span>
                        <span className="text-sm text-slate-700 group-hover:text-violet-600 transition-colors font-medium">{area.name}</span>
                      </div>
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{area.count} libraries</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Study Pass Promo */}
              <div className="bg-gradient-to-r from-amber-100 to-orange-50 rounded-3xl p-5 border border-amber-200 flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow">
                 <div>
                   <h4 className="font-extrabold text-amber-900 flex items-center gap-2">
                     <span className="text-xl">👑</span> Get a Study Pass
                   </h4>
                   <p className="text-xs text-amber-700 mt-1">Unlock discounts & priority booking.</p>
                 </div>
                 <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-amber-600 shadow-sm font-bold">→</span>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
