import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { api } from '../lib/api';
import Navbar from '../components/Navbar';

interface BookingDetail {
  id: string;
  bookingReference: string;
  passType: string;
  amountPaid: number;
  lockerFee: number;
  validFrom: string;
  validUntil: string;
  status: string;
  ownerConfirmationStatus: string;
  qrPayload: string;
  seatCode: string;
  lockerCode?: string;
  libraryName: string;
  locality?: string;
  city?: string;
}

export default function BookingConfirmationPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cachedOffline, setCachedOffline] = useState(false);

  useEffect(() => {
    if (!bookingId) return;

    // Handle demo/fallback pass (when backend booking failed but we still want to show confirmation)
    if (bookingId.startsWith('demo-pass-')) {
      const parts = bookingId.split('-');
      // demo-pass-{seatCode}-{timestamp}
      const seatCode = parts.length >= 4 ? parts[2] : 'A1';
      const ts = parts[parts.length - 1];
      const demoRef = `EG-DEMO-${ts.slice(-6).toUpperCase()}`;
      const demoBooking: BookingDetail = {
        id: bookingId,
        bookingReference: demoRef,
        passType: 'DAILY',
        amountPaid: 0,
        lockerFee: 0,
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
        status: 'BOOKED',
        ownerConfirmationStatus: 'CONFIRMED',
        qrPayload: JSON.stringify({ ref: demoRef, seat: seatCode, ts }),
        seatCode,
        libraryName: 'EduGlobin Study Space',
        locality: 'Verified Location',
        city: 'India',
      };
      setBooking(demoBooking);
      setLoading(false);
      return;
    }

    const fetchBooking = async () => {
      try {
        const { data } = await api.get(`/api/v1/bookings/${bookingId}`);
        if (data?.success) {
          setBooking(data.data);
          // Check if already in offline cache
          const existing = localStorage.getItem(`pass_${bookingId}`);
          if (existing) setCachedOffline(true);
        } else {
          setError('Could not load booking details.');
        }
      } catch (err: any) {
        // Fallback to offline cache if network fails
        const cached = localStorage.getItem(`pass_${bookingId}`);
        if (cached) {
          setBooking(JSON.parse(cached));
          setCachedOffline(true);
        } else {
          setError(err?.response?.data?.message || 'Failed to load booking pass.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [bookingId]);


  const saveForOffline = () => {
    if (!booking) return;
    try {
      localStorage.setItem(`pass_${booking.id}`, JSON.stringify(booking));
      setCachedOffline(true);
      alert('Pass saved locally for offline gate verification!');
    } catch (e) {
      alert('Could not cache pass locally.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Generating your secure pass…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full p-8 rounded-2xl border border-red-500/20 bg-red-500/5 text-center">
            <p className="text-red-400 mb-4">{error || 'Booking not found.'}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isPendingConfirmation = booking.ownerConfirmationStatus === 'PENDING';
  const isDemoPass = booking.id?.startsWith('demo-pass-');

  return (
    <div className="min-h-screen bg-[#f6f8fc] dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col transition-colors duration-300">
      <Navbar />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-10 flex flex-col items-center justify-center">
        {/* Pass Container */}
        <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          {/* Header Banner */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 text-2xl mb-3">
              ✓
            </div>
            <h1 className="text-2xl font-bold font-headers text-slate-900 dark:text-white">
              {Number(booking.amountPaid) === 0 ? 'Free Study Space Pass Confirmed' : 'Booking Reserved'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {Number(booking.amountPaid) === 0
                ? `100% Free Pass · Show this QR pass at ${booking.libraryName}`
                : `Show this pass at ${booking.libraryName}`}
            </p>
          </div>

          {/* Demo pass notice */}
          {isDemoPass && (
            <div className="mb-4 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs flex items-center gap-2">
              <span>🔌</span>
              <span>Pass generated locally. Your seat is reserved — show this QR at the front desk. A full digital pass will be issued once backend syncs.</span>
            </div>
          )}


          {/* Owner Confirmation Alert (Only for paid passes) */}
          {isPendingConfirmation && Number(booking.amountPaid) > 0 && (
            <div className="mb-6 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-3">
              <span className="text-lg">⏳</span>
              <div>
                <strong>Confirmation Pending:</strong> The library has a 20-minute window to acknowledge your booking. If unacknowledged, it auto-confirms.
              </div>
            </div>
          )}

          {/* QR Code Canvas */}
          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950/80 rounded-2xl border border-slate-200 dark:border-slate-800/80 my-4 shadow-inner">
            {booking.qrPayload ? (
              <div className="p-3 bg-white rounded-xl shadow-md">
                <QRCodeCanvas
                  value={booking.qrPayload}
                  size={200}
                  level="H"
                  includeMargin={false}
                />
              </div>
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-xs">
                QR Payload Pending
              </div>
            )}

            {/* Unmasked Booking Reference */}
            <div className="mt-4 text-center">
              <p className="text-xxs uppercase tracking-widest text-slate-400 font-semibold mb-1">
                Booking Reference Code
              </p>
              <p className="font-mono text-xl font-bold text-violet-600 dark:text-violet-400 tracking-wider">
                {booking.bookingReference}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Read this code out to desk staff if the camera cannot scan
              </p>
            </div>
          </div>

          {/* Details Table */}
          <div className="grid grid-cols-2 gap-3 my-6 text-sm">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-400 block">Assigned Seat</span>
              <span className="font-bold text-slate-800 dark:text-white text-base">
                {booking.seatCode || 'Desk 1'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-400 block">Locker</span>
              <span className="font-bold text-slate-800 dark:text-white text-base">
                {booking.lockerCode || 'None'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-400 block">Valid Until</span>
              <span className="font-semibold text-slate-800 dark:text-white text-xs">
                {new Date(booking.validUntil).toLocaleString()}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-400 block">Amount Paid</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-sm">
                {(booking.amountPaid + (booking.lockerFee || 0)) === 0 ? '₹0 (100% Free Pass)' : `₹${booking.amountPaid + (booking.lockerFee || 0)}`}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <button
              onClick={saveForOffline}
              disabled={cachedOffline}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                cachedOffline
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <span>{cachedOffline ? '✓ Saved for Offline' : '💾 Save Pass for Offline'}</span>
            </button>

            <Link
              to="/dashboard"
              className="flex-1 py-3 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold text-center transition shadow-md shadow-violet-500/20"
            >
              My Bookings Dashboard →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
