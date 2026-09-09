import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { api } from '../lib/api';
import Navbar from '../components/Navbar';

interface StudentBooking {
  id: string;
  booking_reference: string;
  pass_type: string;
  amount_paid: number;
  locker_fee: number;
  valid_from: string;
  valid_until: string;
  checked_in_at?: string;
  completed_at?: string;
  actual_hours?: number;
  status: string;
  owner_confirmation_status: string;
  qr_payload_hash: string;
  seat_code: string;
  locker_code?: string;
  library_name: string;
  library_id?: string;
  locality?: string;
  city?: string;
  dispute_resolution_status?: string;
}

interface WalletData {
  balance: number;
  fineOwed: number;
  hasOutstandingFine: boolean;
  fineNotice?: string | null;
}

interface WalletTx {
  id: string;
  delta: number;
  reason: string;
  reference_booking_id?: string;
  created_at: string;
}

export default function StudentDashboardPage() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'bookings' | 'passes' | 'wallet' | 'books' | 'libraries' | 'privacy'>('bookings');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['bookings', 'passes', 'wallet', 'books', 'libraries', 'privacy'].includes(tab)) {
      setActiveTab(tab as any);
    }
  }, [searchParams]);
  const [bookings, setBookings] = useState<StudentBooking[]>([]);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [disputingId, setDisputingId] = useState<string | null>(null);
  const [vacateTokenMap, setVacateTokenMap] = useState<Record<string, string>>({});
  const [generatingTokenId, setGeneratingTokenId] = useState<string | null>(null);

  const [studentStats, setStudentStats] = useState<any | null>(null);
  const [visitorRequests, setVisitorRequests] = useState<any[]>([]);
  const [pendingVacateRequests, setPendingVacateRequests] = useState<any[]>([]);
  const [dataAccessLogs, setDataAccessLogs] = useState<any[]>([]);
  const [rebookCheckMap, setRebookCheckMap] = useState<Record<string, any>>({});
  const [checkingRebookId, setCheckingRebookId] = useState<string | null>(null);

  // New Visitor Pass Request from Dashboard State
  const [showDashboardVisitorModal, setShowDashboardVisitorModal] = useState(false);
  const [dashVisitorLibId, setDashVisitorLibId] = useState('');
  const [dashVisitorPurpose, setDashVisitorPurpose] = useState('CIRCULATION');
  const [dashVisitorLoading, setDashVisitorLoading] = useState(false);
  const [allLibraries, setAllLibraries] = useState<any[]>([]);

  const [vacatingSelfId, setVacatingSelfId] = useState<string | null>(null);
  const [selectedTimelineId, setSelectedTimelineId] = useState<string | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [bookLoans, setBookLoans] = useState<any[]>([]);
  const [myLibraries, setMyLibraries] = useState<any[]>([]);
  const [librariesLoading, setLibrariesLoading] = useState(false);

  // Top-Up / Session Extension Modal State
  const [topupBooking, setTopupBooking] = useState<StudentBooking | null>(null);
  const [topupMinutes, setTopupMinutes] = useState<number>(60);
  const [topupLoading, setTopupLoading] = useState<boolean>(false);
  const [topupAlternatives, setTopupAlternatives] = useState<any | null>(null);
  const [selectedAltSeatId, setSelectedAltSeatId] = useState<string | null>(null);

  const handleOpenTopup = async (b: StudentBooking) => {
    setTopupBooking(b);
    setTopupMinutes(60);
    setSelectedAltSeatId(null);
    setTopupLoading(true);
    try {
      const [altRes, extRes] = await Promise.allSettled([
        api.get(`/api/v1/bookings/${b.id}/topup-alternatives`),
        api.get(`/api/v1/bookings/${b.id}/extend-options`)
      ]);
      if (altRes.status === 'fulfilled' && altRes.value.data?.success) {
        setTopupAlternatives(altRes.value.data.data);
      } else {
        setTopupAlternatives(null);
      }
      if (extRes.status === 'fulfilled' && extRes.value.data?.success && extRes.value.data.data) {
        if (extRes.value.data.data.recommendedExtensionMinutes) {
          setTopupMinutes(extRes.value.data.data.recommendedExtensionMinutes);
        }
      }
    } catch {
      setTopupAlternatives(null);
    } finally {
      setTopupLoading(false);
    }
  };

  const handleConfirmTopup = async () => {
    if (!topupBooking) return;
    setTopupLoading(true);
    try {
      const { data } = await api.post(`/api/v1/bookings/${topupBooking.id}/topup`, {
        additionalMinutes: topupMinutes,
        newSeatId: selectedAltSeatId || undefined,
        paymentMethod: 'WALLET'
      });
      if (data?.success) {
        alert(`⚡ Session successfully extended by ${topupMinutes} minutes!`);
        setTopupBooking(null);
        fetchDashboard();
      } else {
        alert(data?.message || 'Failed to extend session.');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || err.response?.data?.error || 'Error extending session. Check maximum 6h limit.');
    } finally {
      setTopupLoading(false);
    }
  };

  const handleGenerateVacateToken = async (bookingId: string) => {
    setGeneratingTokenId(bookingId);
    try {
      const { data } = await api.post(`/api/v1/bookings/${bookingId}/vacate-token`, {});
      if (data?.success) {
        setVacateTokenMap(prev => ({ ...prev, [bookingId]: data.data.vacateToken }));
      } else {
        alert(data?.message || 'Unable to generate token. Is your seat IN_USE?');
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error generating vacate token.');
    } finally {
      setGeneratingTokenId(null);
    }
  };

  const handleVacateSelf = async (bookingId: string) => {
    const confirmVacate = window.confirm('Are you sure you want to self-vacate this session now? Your seat will be immediately released.');
    if (!confirmVacate) return;

    setVacatingSelfId(bookingId);
    try {
      const { data } = await api.post(`/api/v1/bookings/${bookingId}/vacate-self`, {});
      if (data?.success) {
        alert('✅ Self-vacate completed! Your seat is now vacant and available.');
        fetchDashboard();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || e.response?.data?.error || 'Failed to self-vacate.');
    } finally {
      setVacatingSelfId(null);
    }
  };

  const handleViewTimeline = async (bookingId: string) => {
    setSelectedTimelineId(bookingId);
    setLoadingTimeline(true);
    try {
      const { data } = await api.get(`/api/v1/bookings/${bookingId}/timeline`);
      if (data?.success) {
        setTimelineEvents(data.data || []);
      }
    } catch (e) {
      setTimelineEvents([]);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const [activeCirculationVisit, setActiveCirculationVisit] = useState<any | null>(null);

  const handleStudentRequestExit = async (visitorId: string) => {
    try {
      const { data } = await api.post(`/api/v1/students/me/circulation-visits/${visitorId}/request-exit`, {});
      if (data?.success) {
        alert('Exit request submitted! Owner has received approval notification with your Institute ID.');
        fetchDashboard();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to submit exit request.');
    }
  };

  const handleRespondVacateRequest = async (requestId: string, decision: 'ACCEPT' | 'DECLINE') => {
    try {
      const { data } = await api.post(`/api/v1/bookings/vacate-requests/${requestId}/respond`, { decision });
      if (data?.success) {
        alert(decision === 'ACCEPT' ? '✅ You accepted the vacate request and released your seat.' : 'Declined vacate request.');
        fetchDashboard();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to respond to vacate request.');
    }
  };

  const handleRebookCheck = async (b: StudentBooking) => {
    setCheckingRebookId(b.id);
    try {
      const { data } = await api.get(`/api/v1/students/me/bookings/${b.id}/rebook-check`);
      if (data?.success && data.data) {
        setRebookCheckMap(prev => ({ ...prev, [b.id]: data.data }));
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error checking rebook availability.');
    } finally {
      setCheckingRebookId(null);
    }
  };

  const handleDashboardVisitorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dashVisitorLibId) {
      alert('Please select a library.');
      return;
    }
    setDashVisitorLoading(true);
    try {
      const { data } = await api.post(`/api/v1/students/me/libraries/${dashVisitorLibId}/visitor-passes`, {
        purpose: dashVisitorPurpose
      });
      if (data?.success) {
        alert('✓ Visitor pass request submitted! Awaiting owner/warden approval.');
        setShowDashboardVisitorModal(false);
        fetchDashboard();
      } else {
        alert(data?.message || 'Failed to submit visitor pass request.');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error submitting visitor pass request.');
    } finally {
      setDashVisitorLoading(false);
    }
  };

  const fetchDashboard = async () => {
    try {
      const [dashRes, walletRes, txRes, loansRes, visitRes, statsRes, vReqRes, pVacRes, logsRes, allLibsRes] = await Promise.allSettled([
        api.get('/api/v1/student/dashboard'),
        api.get('/api/v1/students/me/wallet'),
        api.get('/api/v1/students/me/wallet/transactions'),
        api.get('/api/v1/students/me/book-loans'),
        api.get('/api/v1/students/me/circulation-visits/active'),
        api.get('/api/v1/students/me/stats'),
        api.get('/api/v1/students/me/visitor-requests'),
        api.get('/api/v1/students/me/pending-vacate-requests'),
        api.get('/api/v1/students/me/data-access-log'),
        api.get('/api/v1/libraries/all')
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value.data?.success) {
        setBookings(dashRes.value.data.data.bookings || []);
      }
      if (walletRes.status === 'fulfilled' && walletRes.value.data?.success) {
        setWallet(walletRes.value.data.data);
      }
      if (txRes.status === 'fulfilled' && txRes.value.data?.success) {
        setTransactions(txRes.value.data.data);
      }
      if (loansRes.status === 'fulfilled' && loansRes.value.data?.success) {
        setBookLoans(loansRes.value.data.data || []);
      }
      if (visitRes.status === 'fulfilled' && visitRes.value.data?.success) {
        const vData = visitRes.value.data.data;
        if (vData && vData.visitor_id) {
          setActiveCirculationVisit(vData);
        } else {
          setActiveCirculationVisit(null);
        }
      }
      if (statsRes.status === 'fulfilled' && statsRes.value.data?.success) {
        setStudentStats(statsRes.value.data.data);
      }
      if (vReqRes.status === 'fulfilled' && vReqRes.value.data?.success) {
        setVisitorRequests(vReqRes.value.data.data || []);
      }
      if (pVacRes.status === 'fulfilled' && pVacRes.value.data?.success) {
        setPendingVacateRequests(pVacRes.value.data.data || []);
      }
      if (logsRes.status === 'fulfilled' && logsRes.value.data?.success) {
        setDataAccessLogs(logsRes.value.data.data || []);
      }
      if (allLibsRes.status === 'fulfilled' && allLibsRes.value.data?.success) {
        const libs = allLibsRes.value.data.data?.libraries || allLibsRes.value.data.data || [];
        if (Array.isArray(libs)) {
          setAllLibraries(libs);
        }
      }
    } catch (e) {
      console.error('Error fetching dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleCancel = async (bookingId: string) => {
    const reason = prompt('Please state the reason for cancellation:');
    if (reason === null) return;
    if (!reason.trim()) {
      alert('Cancellation reason is required.');
      return;
    }

    setCancellingId(bookingId);
    try {
      const { data } = await api.post(`/api/v1/bookings/${bookingId}/cancel`, { reason });
      if (data?.success) {
        alert(`Booking cancelled. Refund: ₹${data.data.refundAmount} (${data.data.refundPct}%)`);
        fetchDashboard();
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Could not cancel booking.');
    } finally {
      setCancellingId(null);
    }
  };

  const handleDispute = async (bookingId: string) => {
    const reason = prompt('Please explain why this cancellation was fraudulent or incorrect:');
    if (reason === null) return;
    if (!reason.trim()) {
      alert('Dispute details are required.');
      return;
    }

    setDisputingId(bookingId);
    try {
      const { data } = await api.post(`/api/v1/bookings/${bookingId}/dispute`, { reason });
      if (data?.success) {
        alert(data.data.message);
        fetchDashboard();
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to file dispute.');
    } finally {
      setDisputingId(null);
    }
  };

  const totalHoursStudied = bookings.reduce((acc, b) => {
    if (!b.valid_from || !b.valid_until) return acc + 3;
    const start = new Date(b.valid_from).getTime();
    const end = new Date(b.valid_until).getTime();
    const diffHours = Math.max(1, Math.round((end - start) / (1000 * 60 * 60)));
    return acc + (isNaN(diffHours) ? 3 : diffHours);
  }, 0);

  const upcomingBookings = bookings.filter(b => (b.status === 'BOOKED' || b.status === 'IN_USE') && new Date(b.valid_until) >= new Date());
  const pastBookings = bookings.filter(b => b.status === 'COMPLETED' || ((b.status === 'BOOKED' || b.status === 'IN_USE') && new Date(b.valid_until) < new Date()));
  const cancelledBookings = bookings.filter(b => b.status === 'CANCELLED');

  return (
    <div className="min-h-screen bg-[#f6f8fc] dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col transition-colors duration-300">
      <Navbar />

      <main className="flex-1 max-w-[1500px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Total Study Hours Tracker */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-headers text-slate-900 dark:text-white">
              Student Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Manage your study reservations, active passes, and wallet balance
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto">
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                <span className="text-xl">📚</span>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Hours Studied</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white font-mono">{studentStats?.hoursStudied ?? totalHoursStudied}h</span>
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                <span className="text-xl">🪙</span>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Coins Balance</span>
                  <span className="text-sm font-black text-amber-500 font-mono">₹{studentStats?.coinsBalance ?? wallet?.balance ?? 0}</span>
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                <span className="text-xl">🔥</span>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Study Streak</span>
                  <span className="text-sm font-black text-orange-500 font-mono">{studentStats?.currentStreak ?? 1} Days</span>
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                <span className="text-xl">🏛️</span>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Libraries Used</span>
                  <span className="text-sm font-black text-violet-500 font-mono">{studentStats?.librariesCount ?? 1}</span>
                </div>
              </div>
            </div>

            <Link
              to="/search"
              className="px-5 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-md shadow-violet-500/20"
            >
              + Book a New Seat
            </Link>
          </div>
        </div>

        {/* Owner Vacate Request Banner */}
        {pendingVacateRequests.length > 0 && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border-2 border-rose-500/30 text-slate-900 dark:text-white space-y-2 shadow-md">
            {pendingVacateRequests.map(req => (
              <div key={req.request_id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <span className="px-2.5 py-0.5 text-xxs font-extrabold rounded-full bg-rose-600 text-white uppercase tracking-wider">
                    ⚠️ Owner Vacate Request
                  </span>
                  <p className="text-xs font-bold mt-1">
                    {req.library_name} requests you to vacate Seat {req.seat_code}.
                  </p>
                  <p className="text-xxs text-slate-500">Expires at {new Date(req.expires_at).toLocaleTimeString()}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRespondVacateRequest(req.request_id, 'ACCEPT')}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    ✓ Accept &amp; Leave
                  </button>
                  <button
                    onClick={() => handleRespondVacateRequest(req.request_id, 'DECLINE')}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
                  >
                    ✕ Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Outstanding Fine Notice */}
        {wallet?.hasOutstandingFine && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-3 shadow-sm">
            <div>
              <strong className="font-semibold block mb-0.5">Outstanding Cancellation Fine</strong>
              {wallet.fineNotice}
            </div>
          </div>
        )}

        {/* Tabs Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 mb-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all shrink-0 ${
              activeTab === 'bookings'
                ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            My Bookings ({bookings.length})
          </button>

          <button
            onClick={() => setActiveTab('libraries')}
            className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all shrink-0 ${
              activeTab === 'libraries'
                ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            My Libraries &amp; Seats ({Array.from(new Set(bookings.map(b => b.library_name))).filter(Boolean).length})
          </button>

          <button
            onClick={() => setActiveTab('passes')}
            className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'passes'
                ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <span>My Active Passes</span>
            {upcomingBookings.length > 0 && (
              <span className="px-2 py-0.5 text-xxs font-bold rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400">
                {upcomingBookings.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('wallet')}
            className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'wallet'
                ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Wallet & Ledger {wallet ? `(₹${wallet.balance})` : ''}
          </button>

          <button
            onClick={() => setActiveTab('books')}
            className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'books'
                ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <span>My Books</span>
            {bookLoans.filter(l => l.status === 'ISSUED' || l.status === 'OVERDUE').length > 0 && (
              <span className="px-2 py-0.5 text-xxs font-bold rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                {bookLoans.filter(l => l.status === 'ISSUED' || l.status === 'OVERDUE').length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('libraries');
              if (myLibraries.length === 0) {
                setLibrariesLoading(true);
                api.get('/api/v1/students/me/my-libraries')
                  .then((r: any) => setMyLibraries(r.data?.data || []))
                  .catch(() => {})
                  .finally(() => setLibrariesLoading(false));
              }
            }}
            className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'libraries'
                ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <span>🏛️ My Libraries</span>
            {myLibraries.length > 0 && (
              <span className="px-2 py-0.5 text-xxs font-bold rounded-full bg-teal-500/15 text-teal-600 dark:text-teal-400">
                {myLibraries.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('privacy')}
            className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all shrink-0 ${
              activeTab === 'privacy'
                ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            🔐 Privacy &amp; Activity Log
          </button>
        </div>

        {/* TAB 1: MY BOOKINGS */}
        {activeTab === 'bookings' && (
          <div className="space-y-8">
            {/* Visitor Pass Requests Section */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold font-headers text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>🎟️</span>
                    <span>40-Min Circulation Visitor Passes</span>
                  </h3>
                  <p className="text-xs text-slate-500">Quick counter visits for book borrow/return or enquiries without a study desk.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const libId = bookings[0]?.library_id || (myLibraries.length > 0 ? myLibraries[0]?.library_id : '');
                    if (libId) setDashVisitorLibId(libId);
                    setShowDashboardVisitorModal(true);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-md shadow-violet-500/20 transition cursor-pointer flex items-center gap-1"
                >
                  + Request Visitor Pass
                </button>
              </div>

              {visitorRequests.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400">
                  No active or past visitor pass requests. Click "+ Request Visitor Pass" above to visit any library counter.
                </div>
              ) : (
                <div className="grid gap-3">
                  {visitorRequests.map(v => (
                    <div key={v.request_id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">{v.library_name}</span>
                          <span className="text-slate-400">· {v.locality || v.city}</span>
                        </div>
                        <p className="text-slate-500 mt-0.5">Purpose: <strong className="text-slate-700 dark:text-slate-300">{v.purpose}</strong> · {new Date(v.check_in_at).toLocaleDateString()}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xxs font-extrabold uppercase tracking-wider ${
                        v.status === 'ACTIVE' || v.status === 'ACCEPTED'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : v.status === 'REJECTED' || v.status === 'DECLINED'
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      }`}>
                        {v.status === 'ACTIVE' ? '✓ ACCEPTED' : v.status === 'PENDING_APPROVAL' ? '⏳ PENDING' : v.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* ACTIVE CIRCULATION DESK VISIT CARD */}
            {activeCirculationVisit && (
              <div className="p-5 rounded-3xl bg-violet-600/10 border-2 border-violet-500/30 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xxs uppercase tracking-wider font-extrabold px-2.5 py-1 rounded-full bg-violet-600 text-white">
                      Desk Visitor Active
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1 font-headers">
                      {activeCirculationVisit.library_name} — Circulation Desk
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Visiting for: <strong className="uppercase text-violet-600 dark:text-violet-400">{activeCirculationVisit.purpose}</strong> (Issue/Reissue/Return)
                    </p>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-xs font-bold text-slate-400 block">Institute ID</span>
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                      {activeCirculationVisit.institute_id_number || 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap justify-between items-center pt-2 border-t border-violet-500/20 text-xs">
                  <div className="font-mono text-slate-600 dark:text-slate-300">
                    ⏱️ Time Present: <strong>{Math.round(activeCirculationVisit.elapsed_minutes || 0)} mins</strong> / 40 mins limit
                  </div>

                  {activeCirculationVisit.status === 'EXIT_REQUESTED' ? (
                    <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold text-xxs border border-amber-500/30 animate-pulse">
                      ⌛ Exit Request Pending Owner Approval (ID: {activeCirculationVisit.institute_id_number})
                    </span>
                  ) : (
                    <button
                      onClick={() => handleStudentRequestExit(activeCirculationVisit.visitor_id)}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-500/20 transition cursor-pointer"
                    >
                      🚪 Request Desk Exit
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Upcoming Section */}
            <div>
              <h2 className="text-base font-bold font-headers text-slate-800 dark:text-white mb-3">
                Upcoming & Active Reservations
              </h2>
              {upcomingBookings.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/30 text-slate-400 text-xs">
                  No upcoming reservations. Search and reserve a desk to see it here!
                </div>
              ) : (
                <div className="grid gap-4">
                  {upcomingBookings.map(b => (
                    <BookingRow
                      key={b.id}
                      booking={b}
                      onCancel={handleCancel}
                      onDispute={handleDispute}
                      onVacateSelf={handleVacateSelf}
                      onViewTimeline={handleViewTimeline}
                      cancellingId={cancellingId}
                      disputingId={disputingId}
                      vacatingSelfId={vacatingSelfId}
                      onTopup={handleOpenTopup}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Past Section */}
            {pastBookings.length > 0 && (
              <div>
                <h2 className="text-base font-bold font-headers text-slate-800 dark:text-white mb-3">
                  Completed Sessions
                </h2>
                <div className="grid gap-4">
                  {pastBookings.map(b => (
                    <BookingRow
                      key={b.id}
                      booking={b}
                      onViewTimeline={handleViewTimeline}
                      onRebookCheck={handleRebookCheck}
                      rebookInfo={rebookCheckMap[b.id]}
                      checkingRebookId={checkingRebookId}
                      isPast
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Cancelled Section */}
            {cancelledBookings.length > 0 && (
              <div>
                <h2 className="text-base font-bold font-headers text-slate-800 dark:text-white mb-3">
                  Cancelled Bookings & Disputes
                </h2>
                <div className="grid gap-4">
                  {cancelledBookings.map(b => (
                    <BookingRow
                      key={b.id}
                      booking={b}
                      onDispute={handleDispute}
                      onViewTimeline={handleViewTimeline}
                      disputingId={disputingId}
                      isCancelled
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: MY LIBRARIES & SEATS HISTORY */}
        {activeTab === 'libraries' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white font-headers">
                    My Libraries &amp; Assigned Seats Directory
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Your institutional &amp; partner library reservations grouped by venue with seat numbers and validity history.
                  </p>
                </div>

                <span className="px-3 py-1 rounded-full text-xs font-bold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                  {Array.from(new Set(bookings.map(b => b.library_name))).filter(Boolean).length} Joined Libraries
                </span>
              </div>

              {bookings.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                  <p>You haven't reserved any library seats yet.</p>
                  <Link to="/search" className="inline-block mt-2 px-4 py-2 rounded-xl bg-violet-600 text-white font-bold text-xs">
                    Find Nearby Libraries →
                  </Link>
                </div>
              ) : (
                <div className="grid gap-6">
                  {Object.entries(
                    bookings.reduce((acc: any, b) => {
                      const libName = b.library_name || 'Partner Library';
                      if (!acc[libName]) acc[libName] = [];
                      acc[libName].push(b);
                      return acc;
                    }, {})
                  ).map(([libName, libBookings]: [string, any]) => (
                    <div key={libName} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div>
                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                              {libName}
                            </h4>
                            <p className="text-[11px] text-slate-500">
                              {libBookings[0]?.locality || 'City Facility'} · {libBookings[0]?.city || 'Location'}
                            </p>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          {libBookings.length} Total Bookings
                        </span>
                      </div>

                      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {libBookings.map((b: StudentBooking) => (
                          <div key={b.id} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="px-2 py-0.5 rounded font-mono font-black text-xs bg-violet-500/15 text-violet-600 dark:text-violet-400">
                                Desk {b.seat_code || 'A1'}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                b.status === 'BOOKED' || b.status === 'IN_USE' ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                              }`}>
                                {b.status}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                              Ref: <code className="font-mono font-bold text-slate-900 dark:text-white">{b.booking_reference}</code>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {b.valid_from ? new Date(b.valid_from).toLocaleDateString() : 'Active'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MY PASSES (QR FIRST FOR PHYSICAL ENTRY) */}
        {activeTab === 'passes' && (
          <div>
            <div className="mb-4">
              <p className="text-xs text-slate-500">
                Present this QR code to the library front desk scanner for immediate check-in.
              </p>
            </div>

            {upcomingBookings.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/30 text-slate-400 text-xs">
                You have no active check-in passes right now.
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {upcomingBookings.map(b => (
                  <div
                    key={b.id}
                    className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center text-center"
                  >
                    <div className="mb-2">
                      <span className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
                        {b.library_name}
                      </span>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        Seat {b.seat_code}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {b.locker_code ? `Locker: ${b.locker_code} · ` : ''}Valid until: {new Date(b.valid_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <div className="p-3 bg-white rounded-2xl border border-slate-100 shadow-md my-4">
                      <QRCodeCanvas value={b.qr_payload_hash} size={180} level="H" />
                    </div>

                    <div className="mt-2 font-mono font-bold text-sm tracking-wider text-slate-700 dark:text-slate-300">
                      {b.booking_reference}
                    </div>

                    {/* Vacate Token Section — only for IN_USE bookings */}
                    {b.status === 'IN_USE' && (
                      <div className="mt-4 w-full">
                        {vacateTokenMap[b.id] ? (
                          <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-center space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-rose-500">Vacate Token</p>
                            <p className="text-3xl font-extrabold font-mono tracking-[0.3em] text-rose-600 dark:text-rose-400">
                              {vacateTokenMap[b.id]}
                            </p>
                            <p className="text-xs text-slate-500">Share this code with the library owner to vacate your seat.</p>
                            <button
                              onClick={() => setVacateTokenMap(prev => { const n = {...prev}; delete n[b.id]; return n; })}
                              className="text-xs text-slate-400 hover:text-slate-700 mt-1 underline"
                            >Hide</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleGenerateVacateToken(b.id)}
                            disabled={generatingTokenId === b.id}
                            className="w-full py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-bold transition disabled:opacity-50"
                          >
                            {generatingTokenId === b.id ? 'Generating…' : '🔑 Generate Vacate Token (Offline Backup)'}
                          </button>
                        )}
                      </div>
                    )}

                    <Link
                      to={`/booking/${b.id}/confirmed`}
                      className="mt-4 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      View Full Ticket & Offline Options →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: WALLET & LEDGER */}
        {activeTab === 'wallet' && (
          <div className="space-y-6">
            {/* Balance Card */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Current Student Balance
                </span>
                <div className="text-3xl font-bold font-mono mt-1 text-slate-900 dark:text-white">
                  ₹{wallet?.balance ?? 0}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Automatic refund credits and cancellation penalty ledger
                </p>
              </div>

              {wallet?.hasOutstandingFine && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
                  <strong>Pending Fine:</strong> ₹{wallet.fineOwed} (reconciled at checkout)
                </div>
              )}
            </div>

            {/* Transactions History */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">
                Transaction History
              </h3>
              {transactions.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/30 text-slate-400 text-xs">
                  No wallet transactions recorded yet.
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">Reason</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {transactions.map(tx => (
                        <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                            {tx.reason.replace(/_/g, ' ')}
                          </td>
                          <td className={`p-3 font-mono font-bold ${tx.delta >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {tx.delta >= 0 ? `+₹${tx.delta}` : `-₹${Math.abs(tx.delta)}`}
                          </td>
                          <td className="p-3 text-slate-400">
                            {new Date(tx.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: MY BOOKS (MODULE 34) */}
        {activeTab === 'books' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>📚</span> Physical Library Books & Circulation
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  View books borrowed from your enrolled libraries, due dates, and return history.
                </p>
              </div>
            </div>

            {bookLoans.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-400 space-y-2">
                <span className="text-4xl block">📖</span>
                <p className="font-semibold text-sm">No Physical Book Loans Found</p>
                <p className="text-xs">Visit your library counter to borrow physical books or renew existing ones.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bookLoans.map((loan: any) => {
                  const isOverdue = loan.status === 'OVERDUE' || (loan.status === 'ISSUED' && new Date(loan.due_at) < new Date());
                  const isReturned = loan.status === 'RETURNED';

                  return (
                    <div
                      key={loan.loan_id}
                      className={`p-5 rounded-2xl border transition shadow-sm space-y-3 bg-white dark:bg-slate-900 ${
                        isOverdue
                          ? 'border-rose-500/40 dark:border-rose-500/30 bg-rose-50/30 dark:bg-rose-950/10'
                          : isReturned
                          ? 'border-slate-200 dark:border-slate-800 opacity-75'
                          : 'border-emerald-500/30 dark:border-emerald-500/20'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xxs font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 tracking-wider">
                            {loan.category || 'General'}
                          </span>
                          <h3 className="font-bold text-base text-slate-900 dark:text-white mt-1">
                            {loan.title}
                          </h3>
                          <p className="text-xs text-slate-500">Author: {loan.author || 'Unknown'} · Code: {loan.book_code}</p>
                        </div>
                        <span
                          className={`text-xxs font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                            isOverdue
                              ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                              : isReturned
                              ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isOverdue ? '⚠️ Overdue' : isReturned ? '✓ Returned' : '● Active Loan'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-800/80">
                        <div>
                          <span className="text-slate-400 text-xxs uppercase block font-semibold">Library</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{loan.library_name}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-xxs uppercase block font-semibold">Due Date</span>
                          <span className={`font-bold ${isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>
                            {new Date(loan.due_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xxs text-slate-400 pt-1">
                        <span>Issued: {new Date(loan.issued_at).toLocaleDateString()}</span>
                        <span>Reissues: {loan.reissue_count || 0}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: MY LIBRARIES — Booking & Visit History Across All Libraries */}
        {activeTab === 'libraries' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>🏛️</span> My Library History
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  All libraries you have booked or enrolled in, with your visit history.
                </p>
              </div>
            </div>

            {librariesLoading ? (
              <div className="py-16 text-center text-slate-400 text-sm">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                Loading your library history…
              </div>
            ) : myLibraries.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-400 space-y-2">
                <span className="text-4xl block">🏛️</span>
                <p className="font-semibold text-sm">No Library History Yet</p>
                <p className="text-xs">Book a study seat at any EduGlobin library to see your history here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myLibraries.map((lib: any) => {
                  const statusColorMap: Record<string, string> = {
                    IN_USE:    'text-emerald-500',
                    BOOKED:    'text-violet-500',
                    COMPLETED: 'text-slate-400',
                    CANCELLED: 'text-rose-400',
                  };
                  const lastStatus = lib.last_status || 'COMPLETED';
                  const statusColor = statusColorMap[lastStatus] || 'text-slate-400';

                  return (
                    <div
                      key={lib.library_id}
                      className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 hover:border-violet-300 dark:hover:border-violet-700 transition-colors"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-base text-slate-900 dark:text-white truncate">{lib.library_name}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {[lib.locality, lib.city, lib.state].filter(Boolean).join(', ')}
                          </p>
                        </div>
                        <span className={`text-xxs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 ${statusColor} shrink-0`}>
                          {lastStatus}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Bookings</span>
                          <span className="font-extrabold text-slate-800 dark:text-slate-200 text-lg">{lib.total_bookings || 0}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Last Seat</span>
                          <span className="font-bold font-mono text-slate-700 dark:text-slate-300 text-sm">{lib.last_seat_code || '—'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Last Visit</span>
                          <span className="font-semibold text-slate-600 dark:text-slate-400 text-xs">
                            {lib.last_booking_at
                              ? new Date(lib.last_booking_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
                              : '—'}
                          </span>
                        </div>
                      </div>

                      {lib.has_profile && (
                        <div className="flex items-center gap-1.5 text-xxs text-teal-600 dark:text-teal-400">
                          <span>✓</span>
                          <span className="font-semibold">Profile enrolled at this library</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: PRIVACY & DPDP DATA ACCESS LOG */}
        {activeTab === 'privacy' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white font-headers flex items-center gap-2">
                  <span>🔐</span> DPDP Cross-Library Data Access Audit Log
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Under the Digital Personal Data Protection (DPDP) Act, you have the right to know every instance where your profile, government ID, or contact details were accessed by library partners or automated KYC systems.
                </p>
              </div>

              {dataAccessLogs.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No data access logs recorded.
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">Accessed At</th>
                        <th className="p-3">Accessing Facility / Entity</th>
                        <th className="p-3">Role / Service</th>
                        <th className="p-3">Data Category</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {dataAccessLogs.map((log, i) => (
                        <tr key={log.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="p-3 text-slate-400 font-mono text-xxs">
                            {new Date(log.accessed_at).toLocaleString()}
                          </td>
                          <td className="p-3 font-semibold text-slate-900 dark:text-white">
                            {log.library_name}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-xxs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {log.accessed_by_role}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-300 font-medium">
                            {log.data_type}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Module 39: Single Immutable Booking Timeline Modal */}
        {selectedTimelineId && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 relative">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                    📜 Single Immutable Event Log
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">Server Audit Trail · Module 39</p>
                </div>
                <button
                  onClick={() => setSelectedTimelineId(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {loadingTimeline ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading server timeline events…</div>
              ) : timelineEvents.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">No event audit trail recorded for this booking.</div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                  {timelineEvents.map((evt, idx) => (
                    <div key={idx} className="flex items-start gap-3 relative">
                      <div className="w-3 h-3 rounded-full bg-violet-600 mt-1 flex-shrink-0" />
                      {idx < timelineEvents.length - 1 && (
                        <div className="absolute left-[5px] top-4 w-0.5 h-full bg-slate-200 dark:bg-slate-800 -z-0" />
                      )}
                      <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 flex-1 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{evt.action}</span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {new Date(evt.event_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xxs text-slate-500 font-mono">{evt.source} · Actor: {evt.actor_role}</p>
                        {evt.detail && (
                          <div className="text-xxs font-mono bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 overflow-x-auto">
                            {evt.detail}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {/* Session Extension / Top-Up Modal (Student Gap Closure #4 & #5) */}
        {topupBooking && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    ⚡ Extend Session (Top-Up)
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {topupBooking.library_name} · Current Seat: {topupBooking.seat_code}
                  </p>
                </div>
                <button
                  onClick={() => setTopupBooking(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-xs text-violet-700 dark:text-violet-300">
                <span>⏱️ Current Session End: <strong>{new Date(topupBooking.valid_until).toLocaleTimeString()}</strong></span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Policy ceiling: Maximum 6 hours (360 minutes) total session duration.
                </p>
              </div>

              {/* Extension Duration Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-2">
                  Select Additional Duration:
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[30, 60, 120].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setTopupMinutes(mins)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        topupMinutes === mins
                          ? 'border-violet-600 bg-violet-600 text-white shadow-md shadow-violet-500/20'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-violet-400'
                      }`}
                    >
                      +{mins >= 60 ? `${mins / 60}h` : `${mins}m`} ({mins} min)
                    </button>
                  ))}
                </div>
              </div>

              {/* Seat Availability / Alternatives */}
              {topupAlternatives && (
                <div className="space-y-3">
                  {(topupAlternatives.allowed || topupAlternatives.canExtendSameSeat) ? (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                      <span>✓ Current seat ({topupBooking.seat_code}) is available for continuous study!</span>
                    </div>
                  ) : ((topupAlternatives.availableNow && topupAlternatives.availableNow.length > 0) || (topupAlternatives.alternatives && topupAlternatives.alternatives.length > 0)) ? (
                    <div className="space-y-2">
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                        ⚠️ Current seat is booked after your slot. Choose an available alternative desk:
                      </p>
                      <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto">
                        {(topupAlternatives.availableNow || topupAlternatives.alternatives || []).map((alt: any) => (
                          <button
                            key={alt.id || alt.seat_id}
                            type="button"
                            onClick={() => setSelectedAltSeatId(alt.id || alt.seat_id)}
                            className={`p-2 text-xs font-mono font-bold rounded-lg border transition ${
                              selectedAltSeatId === (alt.id || alt.seat_id)
                                ? 'bg-violet-600 text-white border-violet-600'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-violet-400'
                            }`}
                          >
                            {alt.seatCode || alt.seat_code}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : topupAlternatives.message ? (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
                      {topupAlternatives.message}
                    </div>
                  ) : null}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTopupBooking(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={topupLoading}
                  onClick={handleConfirmTopup}
                  className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-md shadow-violet-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {topupLoading ? 'Extending…' : `Confirm +${topupMinutes}m Extension`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: REQUEST VISITOR PASS FROM DASHBOARD ── */}
        {showDashboardVisitorModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-violet-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-violet-600 text-white">
                    🎟️ Request Visitor Pass
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white font-headers mt-1">
                    40-Minute Circulation Visit
                  </h3>
                </div>
                <button
                  onClick={() => setShowDashboardVisitorModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleDashboardVisitorSubmit} className="space-y-4 text-xs">
                <div className="p-3 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-800 dark:text-violet-300 text-[11px] leading-relaxed">
                  Enter library counter for book issue/return, enquiry, or document collection without reserving a full desk.
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Select Target Library *
                  </label>
                  {allLibraries.length > 0 ? (
                    <select
                      required
                      value={dashVisitorLibId}
                      onChange={e => setDashVisitorLibId(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-bold text-xs"
                    >
                      <option value="">-- Choose Any Library --</option>
                      {allLibraries.map(l => (
                        <option key={l.id} value={l.id}>{l.name} ({l.city || l.locality || 'Campus'})</option>
                      ))}
                    </select>
                  ) : myLibraries.length > 0 ? (
                    <select
                      required
                      value={dashVisitorLibId}
                      onChange={e => setDashVisitorLibId(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-bold text-xs"
                    >
                      <option value="">-- Choose Library --</option>
                      {myLibraries.map(l => (
                        <option key={l.library_id} value={l.library_id}>{l.library_name} ({l.city})</option>
                      ))}
                    </select>
                  ) : bookings.length > 0 ? (
                    <select
                      required
                      value={dashVisitorLibId}
                      onChange={e => setDashVisitorLibId(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-bold text-xs"
                    >
                      <option value="">-- Choose Library --</option>
                      {Array.from(new Map(bookings.map(b => [b.library_id || b.library_name, b])).values()).map((b: any) => (
                        <option key={b.id} value={b.library_id || b.id}>{b.library_name} ({b.city || 'Campus'})</option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500">
                      Loading available libraries...
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Visit Purpose *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'CIRCULATION', label: '📖 Book Loan / Return' },
                      { id: 'ENQUIRY_INSPECTION', label: '🔍 Facility Enquiry' },
                      { id: 'DOCUMENT_SUBMISSION', label: '📄 Document Drop' },
                      { id: 'GENERAL_VISIT', label: '👥 General Visit' },
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setDashVisitorPurpose(p.id)}
                        className={`p-2.5 rounded-xl border text-left font-bold transition text-xs ${
                          dashVisitorPurpose === p.id
                            ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-violet-400'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDashboardVisitorModal(false)}
                    className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={dashVisitorLoading}
                    className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold shadow-md transition disabled:opacity-50 cursor-pointer"
                  >
                    {dashVisitorLoading ? 'Submitting...' : 'Submit Request →'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

interface BookingRowProps {
  booking: StudentBooking;
  onCancel?: (id: string) => void;
  onDispute?: (id: string) => void;
  onVacateSelf?: (id: string) => void;
  onViewTimeline?: (id: string) => void;
  onTopup?: (booking: StudentBooking) => void;
  onRebookCheck?: (booking: StudentBooking) => void;
  rebookInfo?: any;
  checkingRebookId?: string | null;
  cancellingId?: string | null;
  disputingId?: string | null;
  vacatingSelfId?: string | null;
  isPast?: boolean;
  isCancelled?: boolean;
}

function BookingRow({
  booking,
  onCancel,
  onDispute,
  onVacateSelf,
  onViewTimeline,
  onTopup,
  onRebookCheck,
  rebookInfo,
  checkingRebookId,
  cancellingId,
  disputingId,
  vacatingSelfId,
  isPast,
  isCancelled
}: BookingRowProps) {
  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-slate-900 dark:text-white text-base">
              {booking.library_name}
            </h4>
            <span className="px-2 py-0.5 rounded-full text-xxs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {booking.pass_type}
            </span>
            {booking.dispute_resolution_status && (
              <span className="px-2 py-0.5 rounded-full text-xxs font-bold bg-amber-500/15 text-amber-500 border border-amber-500/20">
                Dispute: {booking.dispute_resolution_status}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500">
            Seat {booking.seat_code} {booking.locker_code ? `· Locker ${booking.locker_code}` : ''} · Ref: <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">{booking.booking_reference}</span>
          </p>

          {/* Dual Duration Display for Past Sessions */}
          {isPast ? (
            <div className="space-y-0.5 pt-1">
              <p className="text-xs text-slate-500 font-mono">
                📅 <strong>Booked:</strong> {new Date(booking.valid_from).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(booking.valid_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(booking.valid_from).toLocaleDateString()})
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                ⏱️ <strong>Actual Usage:</strong> {booking.checked_in_at ? `${new Date(booking.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${booking.completed_at ? new Date(booking.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Vacated'} (${booking.actual_hours ? Math.round(booking.actual_hours * 10) / 10 : 3.0}h actual)` : '3.0h session completed'}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              Valid: {new Date(booking.valid_from).toLocaleDateString()} to {new Date(booking.valid_until).toLocaleString()}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-auto">
          {isPast && onRebookCheck && (
            <button
              onClick={() => onRebookCheck(booking)}
              disabled={checkingRebookId === booking.id}
              className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1"
            >
              {checkingRebookId === booking.id ? 'Checking…' : '🔁 Rebook'}
            </button>
          )}

          {onViewTimeline && (
            <button
              onClick={() => onViewTimeline(booking.id)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Timeline
            </button>
          )}

          <Link
            to={`/booking/${booking.id}/confirmed`}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            View Pass
          </Link>

          {!isPast && !isCancelled && (booking.status === 'BOOKED' || booking.status === 'IN_USE') && onTopup && (
            <button
              onClick={() => onTopup(booking)}
              className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1"
            >
              ⚡ Extend Session
            </button>
          )}

          {!isPast && !isCancelled && onVacateSelf && (booking.status === 'BOOKED' || booking.status === 'IN_USE') && (
            <button
              onClick={() => onVacateSelf(booking.id)}
              disabled={vacatingSelfId === booking.id}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {vacatingSelfId === booking.id ? 'Vacating…' : 'Vacate Now (Self)'}
            </button>
          )}

          {!isPast && !isCancelled && onCancel && (
            <button
              onClick={() => onCancel(booking.id)}
              disabled={cancellingId === booking.id}
              className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-semibold transition cursor-pointer"
            >
              {cancellingId === booking.id ? 'Cancelling…' : 'Cancel'}
            </button>
          )}

          {isCancelled && !booking.dispute_resolution_status && onDispute && (
            <button
              onClick={() => onDispute(booking.id)}
              disabled={disputingId === booking.id}
              className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-semibold transition cursor-pointer"
            >
              {disputingId === booking.id ? 'Filing…' : "Dispute (It Wasn't Me)"}
            </button>
          )}
        </div>
      </div>

      {/* Inline Rebook Availability Banner */}
      {rebookInfo && (
        <div className={`p-3 rounded-xl border text-xs flex justify-between items-center ${
          rebookInfo.sameSeatAvailableNow
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
        }`}>
          <div>
            <p className="font-bold">
              {rebookInfo.sameSeatAvailableNow
                ? `✓ Same Seat (${rebookInfo.seatCode}) is Available Now at ${rebookInfo.libraryName}!`
                : `⚠️ Seat ${rebookInfo.seatCode} is currently occupied at ${rebookInfo.libraryName}.`}
            </p>
            <p className="text-[11px] opacity-80 mt-0.5">
              Suggested times: {rebookInfo.suggestedTimes?.join(', ') || 'Next slots available'}
            </p>
          </div>

          <Link
            to={`/search?libraryId=${rebookInfo.libraryId}&seatId=${rebookInfo.seatId}`}
            className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-sm"
          >
            📅 Book Now
          </Link>
        </div>
      )}
    </div>
  );
}
