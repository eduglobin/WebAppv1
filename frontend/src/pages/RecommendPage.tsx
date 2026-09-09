import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import LocationPicker from '../components/LocationPicker';

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

export default function RecommendPage() {
  const { t } = useTranslation();
  
  // Wizard steps: 1: Budget/Location, 2: Priorities/Seating, 3: Exams/Amenities, 4: Scored Results
  const [step, setStep] = useState<number>(1);

  // Preference fields state
  const [lat, setLat] = useState<number>(22.6892);
  const [lng, setLng] = useState<number>(75.8636);
  const [locationLabel, setLocationLabel] = useState<string>('Bhawarkua, Indore, Indore');
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [maxMonthlyPrice, setMaxMonthlyPrice] = useState<number>(1800);
  
  const [acRequired, setAcRequired] = useState<boolean>(false);
  const [girlsOnlyOnly, setGirlsOnlyOnly] = useState<boolean>(false);
  const [minSafetyScore, setMinSafetyScore] = useState<number>(80);
  const [seatingType, setSeatingType] = useState<string>('CHAIR');
  
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  // Results state
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const handleLocationSelect = (selectedLat: number, selectedLng: number, label: string) => {
    setLat(selectedLat);
    setLng(selectedLng);
    setLocationLabel(label);
  };

  const toggleExam = (exam: string) => {
    setSelectedExams(prev => 
      prev.includes(exam) ? prev.filter(e => e !== exam) : [...prev, exam]
    );
  };

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities(prev => 
      prev.includes(amenity) ? prev.filter(a => a !== amenity) : [...prev, amenity]
    );
  };

  const handleSubmit = async () => {
    setLoading(true);
    setStep(4);
    try {
      const params = new URLSearchParams();
      params.append('lat', lat.toString());
      params.append('lng', lng.toString());
      params.append('radiusKm', radiusKm.toString());
      params.append('maxMonthlyPrice', maxMonthlyPrice.toString());
      params.append('minSafetyScore', minSafetyScore.toString());
      params.append('acRequired', acRequired.toString());
      params.append('girlsOnlyOnly', girlsOnlyOnly.toString());
      params.append('sortBy', 'RELEVANCE');
      
      if (seatingType) params.append('seatingType', seatingType);
      selectedExams.forEach(exam => params.append('examFocus', exam));
      selectedAmenities.forEach(amenity => params.append('amenities', amenity));

      const response = await axios.get(`${API_BASE}/api/v1/libraries/search?${params.toString()}`);
      if (response.data && response.data.success) {
        setLibraries(response.data.data);
      }
    } catch (e) {
      console.error('Error fetching recommendations:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setLibraries([]);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col transition-colors duration-300">
      <Navbar />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-12 flex flex-col justify-center">
        
        {/* Step Indicator Header (Hide on Results screen) */}
        {step < 4 && (
          <div className="mb-10 text-center">
            <span className="text-xs font-semibold text-violet-400 uppercase tracking-widest">AI Solver Wizard</span>
            <h2 className="text-3xl font-bold font-headers text-white mt-1 mb-6">Find Your Best Matching Space</h2>
            
            {/* Step progress bar */}
            <div className="flex justify-between max-w-xs mx-auto items-center relative">
              <div className="absolute left-0 right-0 h-0.5 bg-slate-800 top-1/2 -translate-y-1/2 -z-10"></div>
              <div
                className="absolute left-0 h-0.5 bg-gradient-to-r from-violet-500 to-pink-500 top-1/2 -translate-y-1/2 -z-10 transition-all duration-300"
                style={{ width: `${((step - 1) / 2) * 100}%` }}
              ></div>
              {[1, 2, 3].map(n => (
                <div
                  key={n}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border ${
                    step >= n
                      ? 'bg-gradient-to-r from-violet-600 to-pink-600 border-transparent text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}
                >
                  {n}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 1: BUDGET & LOCATION */}
        {step === 1 && (
          <section className="bg-slate-800/40 border border-slate-850 p-8 rounded-2xl backdrop-blur-md space-y-6 animate-fadeIn">
            <h3 className="text-xl font-bold font-headers text-white mb-2">Step 1: Location & Budget</h3>
            
            <LocationPicker onSelectLocation={handleLocationSelect} initialLabel={locationLabel} />

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                <span>Maximum travel distance</span>
                <span className="text-violet-400 font-bold">{radiusKm} km</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="15"
                step="0.5"
                value={radiusKm}
                onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-violet-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                <span>Monthly Budget Limit</span>
                <span className="text-violet-400 font-bold">₹{maxMonthlyPrice}</span>
              </div>
              <input
                type="range"
                min="200"
                max="3000"
                step="100"
                value={maxMonthlyPrice}
                onChange={(e) => setMaxMonthlyPrice(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-violet-500"
              />
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold text-white shadow-lg hover:shadow-xl transition-all cursor-pointer"
              >
                Next Step
              </button>
            </div>
          </section>
        )}

        {/* STEP 2: PRIORITIES & SEATING */}
        {step === 2 && (
          <section className="bg-slate-800/40 border border-slate-850 p-8 rounded-2xl backdrop-blur-md space-y-6 animate-fadeIn">
            <h3 className="text-xl font-bold font-headers text-white mb-2">Step 2: Comfort & Safety Priorities</h3>

            {/* Core priority toggles */}
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-755 bg-slate-900/60 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={acRequired}
                  onChange={(e) => setAcRequired(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-violet-600 focus:ring-violet-500 w-4 h-4"
                />
                <span className="text-sm font-semibold text-slate-350">Air Conditioning is a must</span>
              </label>

              <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-755 bg-slate-900/60 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={girlsOnlyOnly}
                  onChange={(e) => setGirlsOnlyOnly(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-pink-600 focus:ring-pink-500 w-4 h-4"
                />
                <span className="text-sm font-semibold text-slate-350">Has Girls Section / cabin</span>
              </label>
            </div>

            {/* Safety Score Slider */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                <span>Minimum Girls Safety rating importance</span>
                <span className="text-pink-400 font-bold">{minSafetyScore}+</span>
              </div>
              <input
                type="range"
                min="50"
                max="100"
                step="5"
                value={minSafetyScore}
                onChange={(e) => setMinSafetyScore(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-pink-500"
              />
            </div>

            {/* Seating selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Preferred Seating Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {['CHAIR', 'SOFA', 'MIXED', 'ERGONOMIC'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSeatingType(type)}
                    className={`py-3 rounded-xl border font-bold text-xs transition-all ${
                      seatingType === type
                        ? 'bg-violet-600 border-violet-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-750 hover:text-slate-200'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-5 py-3 rounded-xl border border-slate-750 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold text-white shadow-lg transition-all cursor-pointer"
              >
                Next Step
              </button>
            </div>
          </section>
        )}

        {/* STEP 3: EXAMS & AMENITIES */}
        {step === 3 && (
          <section className="bg-slate-800/40 border border-slate-850 p-8 rounded-2xl backdrop-blur-md space-y-6 animate-fadeIn">
            <h3 className="text-xl font-bold font-headers text-white mb-2">Step 3: What are you preparing for?</h3>

            {/* Exam focus select */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Exam Focus (Multi-select)</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {['UPSC', 'NEET', 'JEE', 'SSC', 'CA', 'STATE_PSC'].map(exam => {
                  const selected = selectedExams.includes(exam);
                  return (
                    <button
                      key={exam}
                      type="button"
                      onClick={() => toggleExam(exam)}
                      className={`py-3 rounded-xl border text-xs font-semibold transition-all ${
                        selected
                          ? 'bg-violet-600/25 border-violet-500/50 text-violet-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-750 hover:text-slate-200'
                      }`}
                    >
                      {exam}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amenities checklist */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Essential Amenities</label>
              <div className="grid grid-cols-2 gap-3 text-sm bg-slate-900/40 p-4 border border-slate-800 rounded-xl">
                {['WIFI', 'CCTV', 'RO_WATER', 'CAFETERIA', 'LOCKER'].map(amenity => {
                  const selected = selectedAmenities.includes(amenity);
                  return (
                    <label key={amenity} className="flex items-center gap-3 cursor-pointer text-slate-350 hover:text-white">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleAmenity(amenity)}
                        className="rounded border-slate-750 bg-slate-900 text-violet-600 focus:ring-violet-500 w-4 h-4"
                      />
                      <span>{amenity}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-5 py-3 rounded-xl border border-slate-750 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold hover:from-violet-500 hover:to-pink-500 shadow-lg hover:shadow-xl transition-all cursor-pointer"
              >
                Find Recommended Spaces
              </button>
            </div>
          </section>
        )}

        {/* STEP 4: RECOMMENDATION RESULTS */}
        {step === 4 && (
          <section className="space-y-8 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold font-headers text-white">Recommended Spaces For You</h3>
                <p className="text-slate-400 text-sm mt-1">Scored deterministically based on your wizard criteria</p>
              </div>
              <button
                onClick={handleReset}
                className="px-4 py-2 text-xs font-bold border border-slate-750 bg-slate-800 text-slate-300 hover:text-white rounded-xl hover:bg-slate-700 transition-all"
              >
                Reset Preferences
              </button>
            </div>

            {loading ? (
              <div className="space-y-6">
                {[1, 2].map(n => (
                  <div key={n} className="h-64 bg-slate-800/25 border border-slate-850 rounded-2xl animate-pulse"></div>
                ))}
              </div>
            ) : libraries.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-slate-850 bg-slate-800/10 text-slate-500">
                No matching libraries found. Expand your parameters and try again.
              </div>
            ) : (
              <div className="space-y-6">
                {libraries.map((lib) => (
                  <article
                    key={lib.id}
                    className="p-6 rounded-2xl bg-slate-800/20 border border-slate-850 hover:border-slate-700/50 hover:bg-slate-800/30 transition-all duration-300 flex flex-col md:flex-row gap-6 justify-between"
                  >
                    <div className="flex-1 space-y-4">
                      {/* Badge and Match Score */}
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded bg-violet-500/15 border border-violet-500/30 text-xs font-bold text-violet-400 uppercase tracking-wide">
                          {Math.round(lib.matchScore * 100)}% MATCH
                        </span>
                        <span className="text-xs text-slate-500">★ {lib.rating ? lib.rating.toFixed(1) : '4.0'} rating ({lib.distanceKm.toFixed(1)} km away)</span>
                      </div>

                      <div>
                        <h4 className="text-xl font-bold text-white font-headers mb-1">{lib.name}</h4>
                        <p className="text-slate-400 text-sm">Indore, {lib.locality || 'Bhawarkua'}</p>
                      </div>

                      {/* Amenities details */}
                      <div className="flex flex-wrap gap-1.5">
                        {lib.acAvailable && (
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xxs font-medium uppercase tracking-wider">AC</span>
                        )}
                        {lib.hasGirlsSection && (
                          <span className="px-2 py-0.5 rounded bg-pink-500/10 text-pink-400 border border-pink-500/20 text-xxs font-medium uppercase tracking-wider">Girls Cabin</span>
                        )}
                        {lib.seatingType && (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-750 text-xxs font-medium uppercase tracking-wider">{lib.seatingType}</span>
                        )}
                      </div>

                      {/* PLACEHOLDER FOR DAY 12 GEMINI EXPLANATION */}
                      <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-850 text-slate-400 text-xs leading-relaxed">
                        <div className="font-bold text-violet-400/90 mb-1 uppercase tracking-widest text-[9px] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse"></span>
                          Solver Reasoning (Day 12 AI Layer)
                        </div>
                        Fits your budget of <strong>₹{maxMonthlyPrice}</strong> ({Math.round(lib.matchScore * 100)}% fit coefficient). Matches your exam goals for <strong>{lib.focusedExams.join(', ')}</strong> and includes critical amenities: {lib.amenities.join(', ')}.
                      </div>
                    </div>

                    {/* Right column: pricing and booking */}
                    <div className="md:w-44 flex flex-col md:justify-between items-end border-t md:border-t-0 md:border-l border-slate-850/60 pt-4 md:pt-0 md:pl-6">
                      <div className="text-right">
                        <span className="block text-slate-500 text-xxs uppercase tracking-wider">Starts at</span>
                        <span className="text-2xl font-bold text-white">₹{lib.monthlyPrice || '800'}</span>
                        <span className="text-xs text-slate-450 block">per month</span>
                      </div>

                      <button className="w-full md:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-sm shadow hover:shadow-lg transition-all mt-4 md:mt-0 cursor-pointer">
                        Book Now
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

      </main>
    </div>
  );
}
