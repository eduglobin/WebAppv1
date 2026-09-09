import React from 'react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';

interface LibraryMapProps {
  center: { lat: number; lng: number };
  radiusKm: number;
  libraries: any[];
}

export default function LibraryMap({ center, radiusKm, libraries }: LibraryMapProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Render a visual radar map mockup if Google Maps API key is not configured
  if (!apiKey) {
    return (
      <div className="w-full h-full bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center p-6 relative overflow-hidden text-center min-h-[400px]">
        {/* Grid and Radar lines */}
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-25"></div>
        <div className="absolute rounded-full border border-violet-500/10 w-96 h-96 animate-pulse"></div>
        <div className="absolute rounded-full border border-pink-500/5 w-[500px] h-[500px]"></div>

        <div className="z-10 max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600/10 to-pink-600/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mx-auto mb-5 text-xl">
            ??
          </div>
          <h4 className="text-xl font-bold text-white mb-2 font-headers">Radar Map Active</h4>
          <p className="text-slate-400 text-sm mb-4 leading-relaxed">
            Google Maps API is not configured. Visualizing search radius of <strong className="text-violet-400">{radiusKm} km</strong> around:
          </p>
          <div className="bg-slate-900/80 backdrop-blur p-3 rounded-xl border border-slate-800 text-xs text-slate-400 font-mono mb-4 flex justify-around">
            <span>Lat: {center.lat.toFixed(4)}</span>
            <span className="text-slate-700">|</span>
            <span>Lng: {center.lng.toFixed(4)}</span>
          </div>
          <div className="mt-4 py-2 px-4 rounded-full bg-slate-800/40 border border-slate-800 inline-flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="text-xs text-emerald-400 font-semibold">{libraries.length} Libraries in Range</span>
          </div>
        </div>
      </div>
    );
  }

  // If API Key is configured, render the live Google Map
  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-800 min-h-[400px] bg-slate-950">
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={{ lat: center.lat, lng: center.lng }}
          defaultZoom={14}
          gestureHandling="cooperative"
          disableDefaultUI={true}
          style={{ width: '100%', height: '100%' }}
        >
          {/* User Location marker */}
          <AdvancedMarker position={{ lat: center.lat, lng: center.lng }} title="Search Center">
            <div className="w-5 h-5 rounded-full bg-violet-600 border-2 border-white ring-4 ring-violet-600/30 animate-pulse"></div>
          </AdvancedMarker>

          {/* Scored library pins */}
          {libraries.map((lib) => (
            <AdvancedMarker
              key={lib.id}
              position={{ lat: lib.lat, lng: lib.lng }}
              title={lib.name}
            >
              <Pin
                background={lib.rating >= 4.5 ? '#10b981' : lib.rating >= 3.8 ? '#f59e0b' : '#ef4444'}
                borderColor="#020617"
                glyphColor="#fff"
              />
            </AdvancedMarker>
          ))}
        </Map>
      </APIProvider>
    </div>
  );
}
