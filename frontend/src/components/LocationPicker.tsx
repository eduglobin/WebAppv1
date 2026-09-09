import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

interface LocationItem {
  villageOrArea: string;
  tehsil: string;
  district: string;
  state: string;
  lat: number;
  lng: number;
}

interface LocationPickerProps {
  onSelectLocation: (lat: number, lng: number, label: string) => void;
  initialLabel?: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

export default function LocationPicker({ onSelectLocation, initialLabel = '' }: LocationPickerProps) {
  const [query, setQuery] = useState(initialLabel);
  const [suggestions, setSuggestions] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; item: LocationItem | null }>({
    open: false,
    item: null,
  });

  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<any>(null);

  useEffect(() => {
    setQuery(initialLabel);
  }, [initialLabel]);

  // Handle outside clicks to close autocomplete dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/api/v1/location/search?q=${encodeURIComponent(searchQuery)}`);
      if (response.data && response.data.success) {
        setSuggestions(response.data.data);
        setShowDropdown(true);
      }
    } catch (e) {
      console.error('Error fetching locations:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 300);
  };

  const handleSelectSuggestion = (item: LocationItem) => {
    const label = item.villageOrArea 
      ? `${item.villageOrArea}, ${item.tehsil}, ${item.district}`
      : `${item.tehsil}, ${item.district}, ${item.state}`;
    setQuery(label);
    setShowDropdown(false);
    onSelectLocation(item.lat, item.lng, label);
  };

  const handleFetchGpsLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        let detectedItem: LocationItem = {
          villageOrArea: 'Bhawarkua',
          tehsil: 'Indore',
          district: 'Indore',
          state: 'Madhya Pradesh',
          lat: latitude,
          lng: longitude,
        };

        if (googleApiKey) {
          try {
            const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${googleApiKey}`;
            const res = await axios.get(url);
            if (res.data && res.data.results && res.data.results.length > 0) {
              const components = res.data.results[0].address_components;
              let area = '';
              let city = '';
              let state = '';
              
              for (const comp of components) {
                if (comp.types.includes('sublocality') || comp.types.includes('neighborhood')) {
                  area = comp.long_name;
                } else if (comp.types.includes('locality')) {
                  city = comp.long_name;
                } else if (comp.types.includes('administrative_area_level_1')) {
                  state = comp.long_name;
                }
              }
              
              detectedItem = {
                villageOrArea: area || 'Detected Hub',
                tehsil: city,
                district: city,
                state: state,
                lat: latitude,
                lng: longitude,
              };
            }
          } catch (err) {
            console.error('Google Reverse Geocoding failed, falling back to mock details:', err);
          }
        }

        setConfirmModal({ open: true, item: detectedItem });
        setGpsLoading(false);
      },
      (error) => {
        console.error('GPS Geolocation error:', error);
        alert('Failed to get GPS location. Please type manually.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleConfirmGps = () => {
    if (confirmModal.item) {
      const item = confirmModal.item;
      const label = item.villageOrArea 
        ? `${item.villageOrArea}, ${item.tehsil}, ${item.district}`
        : `${item.tehsil}, ${item.district}, ${item.state}`;
      setQuery(label);
      onSelectLocation(item.lat, item.lng, label);
    }
    setConfirmModal({ open: false, item: null });
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        Search Location (Village / Tehsil / Hub)
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="e.g. Bhawarkua, Indore or Talwandi..."
            className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
          />
          {loading && (
            <span className="absolute right-3 top-3.5 text-xs text-slate-500 animate-spin">⟳</span>
          )}

          {showDropdown && suggestions.length > 0 && (
            <ul className="absolute z-20 w-full mt-2 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
              {suggestions.map((item, idx) => {
                const label = item.villageOrArea 
                  ? `${item.villageOrArea}, ${item.tehsil}`
                  : `${item.tehsil}, ${item.district}`;
                return (
                  <li
                    key={idx}
                    onClick={() => handleSelectSuggestion(item)}
                    className="px-4 py-3 hover:bg-slate-900 cursor-pointer text-sm text-slate-300 hover:text-white flex flex-col transition-colors border-b border-slate-900/60 last:border-b-0"
                  >
                    <span className="font-semibold">{label}</span>
                    <span className="text-xs text-slate-500">{item.district}, {item.state}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={handleFetchGpsLocation}
          disabled={gpsLoading}
          className="px-4 py-3 rounded-xl border border-slate-750 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700/80 transition-colors flex items-center justify-center disabled:opacity-50"
          title="Use GPS Coordinates"
        >
          {gpsLoading ? (
            <span className="animate-spin text-sm">⟳</span>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      </div>

      {confirmModal.open && confirmModal.item && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl relative">
            <h3 className="text-xl font-bold font-headers text-white mb-2">Confirm Live Location</h3>
            <p className="text-slate-400 text-sm mb-5">
              We detected your coordinates. Please confirm if this is the correct location match:
            </p>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 text-slate-300 font-semibold mb-6 flex flex-col">
              <span>{confirmModal.item.villageOrArea || 'Detected Location'}</span>
              <span className="text-xs text-slate-500 font-normal">{confirmModal.item.district}, {confirmModal.item.state}</span>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmModal({ open: false, item: null })}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmGps}
                className="px-4 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-500 font-semibold text-white shadow"
              >
                Yes, Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
