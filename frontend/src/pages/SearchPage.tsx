import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import LibraryMap from '../components/LibraryMap';
import LibraryCard from '../components/LibraryCard';

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
  const { t } = useTranslation();
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

  return (
    <div className="min-h-screen bg-[#f4f6fb] dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col transition-colors duration-300">
      <Navbar />

      {/* ── TOP SEARCH BANNER (Name & Semantic AI Search) ── */}
      <div className="bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 text-white py-8 px-4 sm:px-6 lg:px-8 border-b border-violet-800/40 shadow-inner">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="text-center space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold font-headers text-white flex items-center justify-center gap-2">
              <span>🏛️</span>
              <span>Find Libraries &amp; Verified Study Spaces</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Search by library name, locality, or natural description (e.g. <em>"Saraswati Library"</em>, <em>"AC reading hall for UPSC in Bhawarkua"</em>)
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchLibraries();
            }}
            className="flex flex-col sm:flex-row gap-2 bg-white/10 p-2 rounded-2xl border border-white/20 backdrop-blur-md shadow-xl"
          >
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base">🔎</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search library name, exam (UPSC/NEET), locality, or features..."
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold text-sm outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-sm shadow-lg shadow-violet-600/30 transition cursor-pointer shrink-0 flex items-center justify-center gap-2"
            >
              {loading ? 'Searching…' : '🔍 Search'}
            </button>
          </form>

          {/* Quick Search Tag Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs pt-1">
            <span className="text-slate-400 font-bold uppercase text-[10px]">Popular Searches:</span>
            {[
              { label: '🎯 Nearest First', sort: 'DISTANCE', query: '' },
              { label: '📚 Saraswati Library', sort: 'RELEVANCE', query: 'Saraswati' },
              { label: '❄️ AC + UPSC Focus', sort: 'RELEVANCE', query: 'AC UPSC' },
              { label: '🩷 Girls Safe Wing', sort: 'RELEVANCE', query: 'Girls Safe' },
              { label: '💰 Free Study Pass', sort: 'RELEVANCE', query: 'Free' },
            ].map((pill, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (pill.query !== undefined) setSearchQuery(pill.query);
                  if (pill.sort) setSortBy(pill.sort);
                  setTimeout(() => fetchLibraries(), 50);
                }}
                className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold transition cursor-pointer text-xs"
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-6">

        {/* ── LEFT SIDEBAR ─────────────────────────────────────────────── */}
        <section className="w-full md:w-80 flex-shrink-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl h-fit space-y-5 shadow-sm">
          
          {/* Header */}
          <div>
            <h2 className="text-xl font-bold font-headers text-slate-900 dark:text-white">Search Filters</h2>
            <p className="text-xs text-slate-400 mt-0.5">Find real verified study spaces</p>
          </div>

          {/* ── Search Mode Tabs ─────────────────────────────────────── */}
          <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1 gap-1">
            <button
              onClick={() => setSearchMode('GPS')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                searchMode === 'GPS'
                  ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              📍 Near Me
            </button>
            <button
              onClick={() => setSearchMode('CITY')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                searchMode === 'CITY'
                  ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              🏙️ By City
            </button>
          </div>

          {/* ── GPS Mode ─────────────────────────────────────────────── */}
          {searchMode === 'GPS' && (
            <div className="space-y-3">
              {/* GPS Status indicator */}
              <div className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold ${
                gpsStatus === 'GRANTED'
                  ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                  : gpsStatus === 'DENIED'
                  ? 'border-red-300 bg-red-50 dark:bg-red-950/20 text-red-600'
                  : gpsStatus === 'DETECTING'
                  ? 'border-violet-300 bg-violet-50 dark:bg-violet-950/20 text-violet-600'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500'
              }`}>
                {gpsStatus === 'GRANTED' ? (
                  <><span className="w-2 h-2 rounded-full bg-emerald-500"></span><span>{locationLabel || 'GPS Location Active'}</span></>
                ) : gpsStatus === 'DETECTING' ? (
                  <><span className="w-2 h-2 rounded-full bg-violet-500 animate-ping"></span><span>Detecting location…</span></>
                ) : gpsStatus === 'DENIED' ? (
                  <><span>❌</span><span>GPS denied — try a hub below</span></>
                ) : (
                  <><span>📍</span><span>Location not set</span></>
                )}
              </div>

              <button
                onClick={detectGpsLocation}
                disabled={gpsStatus === 'DETECTING'}
                className="w-full py-2.5 px-3 rounded-xl border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30 hover:bg-violet-100 dark:hover:bg-violet-950/50 text-violet-700 dark:text-violet-400 text-xs font-bold flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                🎯 {gpsStatus === 'DETECTING' ? 'Detecting GPS…' : 'Use My Current GPS Location'}
              </button>

              {/* Popular Hubs */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Popular Study Hubs</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { name: 'Mukherjee Nagar', lat: 28.7107, lng: 77.2064 },
                    { name: 'Bhawarkua, Indore', lat: 22.6892, lng: 75.8636 },
                    { name: 'Talwandi, Kota', lat: 25.1763, lng: 75.8434 },
                    { name: 'Sikar', lat: 27.6094, lng: 75.1398 },
                    { name: 'Boring Road, Patna', lat: 25.6093, lng: 85.1376 },
                  ].map((hub) => (
                    <button
                      key={hub.name}
                      onClick={() => handleHubSelect(hub.lat, hub.lng, hub.name)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition ${
                        locationLabel === hub.name
                          ? 'border-violet-500 bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-violet-400'
                      }`}
                    >
                      {hub.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── City Mode ─────────────────────────────────────────────── */}
          {searchMode === 'CITY' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Enter City Name
              </label>
              <input
                type="text"
                value={cityInput}
                onChange={e => setCityInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && canSearch && fetchLibraries()}
                placeholder="e.g. Indore, Kota, Delhi, Patna…"
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-violet-500 transition placeholder-slate-400"
              />
              <p className="text-[10px] text-slate-400">Shows all approved libraries in that city</p>
            </div>
          )}

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* ── Radius Slider (GPS mode only) ─────────────────────────── */}
          {searchMode === 'GPS' && (
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                <span>Search Radius</span>
                <span className="text-violet-600 dark:text-violet-400 font-bold">{radiusKm} KM</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="50"
                step="0.5"
                value={radiusKm}
                onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
                className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-violet-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>0.5 km</span><span>25 km</span><span>50 km</span>
              </div>
            </div>
          )}

          {/* ── Price Slider ─────────────────────────────────────────── */}
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              <span>Max Monthly Price</span>
              <span className="text-violet-600 dark:text-violet-400 font-bold">₹{maxMonthlyPrice}</span>
            </div>
            <input
              type="range"
              min="200"
              max="5000"
              step="100"
              value={maxMonthlyPrice}
              onChange={(e) => setMaxMonthlyPrice(parseInt(e.target.value))}
              className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-violet-600"
            />
          </div>

          {/* ── Safety Slider ─────────────────────────────────────────── */}
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              <span>Min Safety Score</span>
              <span className="text-pink-600 dark:text-pink-400 font-bold">{minSafetyScore}+</span>
            </div>
            <input
              type="range"
              min="50"
              max="100"
              step="5"
              value={minSafetyScore}
              onChange={(e) => setMinSafetyScore(parseInt(e.target.value))}
              className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-pink-600"
            />
          </div>

          {/* ── Toggles ─────────────────────────────────────────────── */}
          <div className="space-y-2.5">
            <label className="flex items-center gap-3 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={acRequired}
                onChange={(e) => setAcRequired(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 text-violet-600 w-4 h-4"
              />
              <span>Air Conditioning (AC)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={girlsOnlyOnly}
                onChange={(e) => setGirlsOnlyOnly(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 text-pink-600 w-4 h-4"
              />
              <span>Girls Only Section</span>
            </label>
          </div>

          {/* ── Seating Type ─────────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Seating Type</label>
            <div className="flex flex-wrap gap-1.5">
              {['', 'CHAIR', 'SOFA', 'MIXED', 'ERGONOMIC'].map(type => (
                <button
                  key={type}
                  onClick={() => setSeatingType(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    seatingType === type
                      ? 'bg-violet-600 border-violet-500 text-white shadow'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-violet-400'
                  }`}
                >
                  {type || 'ANY'}
                </button>
              ))}
            </div>
          </div>

          {/* ── Exam Focus ─────────────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Focused Exams</label>
            <div className="flex flex-wrap gap-1.5">
              {['UPSC', 'NEET', 'JEE', 'SSC', 'CA', 'STATE_PSC'].map(exam => {
                const selected = selectedExams.includes(exam);
                return (
                  <button
                    key={exam}
                    onClick={() => toggleExam(exam)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      selected
                        ? 'bg-violet-100 dark:bg-violet-950/40 border-violet-400 dark:border-violet-600 text-violet-700 dark:text-violet-300'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-400'
                    }`}
                  >
                    {exam}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── SEARCH BUTTON ─────────────────────────────────────────── */}
          <button
            onClick={fetchLibraries}
            disabled={!canSearch || loading}
            className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 ${
              canSearch && !loading
                ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-500/30 cursor-pointer'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span><span>Searching…</span></>
            ) : (
              <><span>🔍</span><span>Search Libraries</span></>
            )}
          </button>
          {!canSearch && (
            <p className="text-[10px] text-center text-slate-400">
              {searchMode === 'GPS' ? 'Allow GPS or select a hub above to search' : 'Enter a city name to search'}
            </p>
          )}

        </section>

        {/* ── RIGHT COLUMN: RESULTS ────────────────────────────────────────── */}
        <section className="flex-1 flex flex-col gap-5">

          {/* Toolbar */}
          {hasSearched && !loading && (
            <div className="flex items-center justify-between bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {libraries.length} {libraries.length === 1 ? 'space' : 'spaces'} found
                </span>
                <span className="text-xs text-violet-500 font-mono">
                  {searchMode === 'GPS' ? `(within ${radiusKm} km)` : `in ${cityInput}`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider">Sort</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 focus:outline-none focus:border-violet-500 font-bold"
                  >
                    <option value="RELEVANCE">🧠 Best Match (Semantic)</option>
                    <option value="DISTANCE">🎯 Nearest First</option>
                    <option value="NAME">🏷️ Library Name (A → Z)</option>
                    <option value="PRICE_ASC">💰 Price: Low → High</option>
                    <option value="RATING">⭐ Rating: High → Low</option>
                  </select>
                </div>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >List</button>
                  <button
                    onClick={() => setViewMode('map')}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      viewMode === 'map' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >Map</button>
                </div>
              </div>
            </div>
          )}

          {/* ── States ──────────────────────────────────────────────── */}
          {!hasSearched ? (
            /* Initial welcome state */
            <div className="flex-1 p-12 text-center rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 shadow-sm flex flex-col items-center justify-center space-y-5">
              <div className="w-20 h-20 rounded-full bg-violet-100 dark:bg-violet-600/10 border-2 border-violet-300 dark:border-violet-700 flex items-center justify-center text-4xl">
                🏛️
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Find Real Verified Libraries</h3>
                <p className="text-sm text-slate-500 max-w-sm mx-auto">
                  {searchMode === 'GPS'
                    ? 'Allow GPS access or pick a hub, then click Search to discover study spaces near you.'
                    : 'Enter your city name and click Search to see all verified study spaces in that city.'}
                </p>
              </div>
              <button
                onClick={fetchLibraries}
                disabled={!canSearch}
                className={`px-6 py-3 rounded-xl font-bold text-sm transition ${
                  canSearch ? 'bg-violet-600 hover:bg-violet-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                }`}
              >
                🔍 {canSearch ? 'Search Now' : searchMode === 'GPS' ? 'Allow GPS First' : 'Enter City First'}
              </button>
            </div>
          ) : loading ? (
            <div className="grid md:grid-cols-2 gap-5">
              {[1, 2, 3, 4].map(n => (
                <div key={n} className="h-56 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : viewMode === 'map' && lat !== null && lng !== null ? (
            <div className="flex-1 min-h-[500px]">
              <LibraryMap center={{ lat, lng }} radiusKm={radiusKm} libraries={libraries} />
            </div>
          ) : libraries.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 shadow-sm space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-500 flex items-center justify-center text-2xl">
                🔍
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  No Verified Libraries Found
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Only authentic libraries listed by owners and approved by administration are shown.{' '}
                  {searchMode === 'GPS' && `Try increasing the radius beyond ${radiusKm} km.`}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center pt-1">
                {searchMode === 'GPS' && (
                  <button
                    onClick={() => { setRadiusKm(Math.min(50, radiusKm + 10)); }}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    Expand to {Math.min(50, radiusKm + 10)} km →
                  </button>
                )}
                <button
                  onClick={() => setSearchMode('CITY')}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition"
                >
                  🏙️ Try City Search
                </button>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-5">
              {libraries.map((lib) => (
                <LibraryCard
                  key={lib.id}
                  library={lib}
                  matchExplanation={sortBy === 'RELEVANCE' ? `${Math.round(lib.matchScore * 100)}% Match` : undefined}
                />
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
