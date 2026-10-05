import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { api } from '../lib/api';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import StudentSidebar from '../components/StudentSidebar';

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
  const { i18n } = useTranslation();
  const isHi = i18n.language?.startsWith('hi');
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'bookings' | 'passes' | 'wallet' | 'books' | 'libraries' | 'privacy' | 'active' | 'complaints'>('dashboard');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['dashboard', 'bookings', 'passes', 'wallet', 'books', 'libraries', 'privacy', 'active', 'complaints'].includes(tab)) {
      setActiveTab(tab as any);
    }
  }, [searchParams]);
  const [bookings, setBookings] = useState<StudentBooking[]>([]);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock variables for UI redesign
  const profile = { name: "Student", full_name: "Student User", avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" };
  const userEmail = "student@example.com";
  const getGreeting = () => "Welcome back";
  const savedLibraries: any[] = [];
  const complaints: any[] = [];
  const formatTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDate = (d: string) => new Date(d).toLocaleDateString();
  const setSelectedBooking = (b: any) => {};
  const setShowTimelineModal = (v: boolean) => {};
  const setShowExtensionModal = (v: boolean) => {};
  const setVisitorLibId = (v: string) => {};

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

  const [reservedPass, setReservedPass] = useState<any | null>(null);

  const handleReservedCheckOut = async () => {
    if (!reservedPass?.enrollment_id) return;
    const confirmCheckOut = window.confirm('Are you sure you want to check out for today? Your monthly seat remains reserved for you, but will be marked vacant for the rest of today.');
    if (!confirmCheckOut) return;
    try {
      const { data } = await api.post('/api/v1/partner/private-libraries/reserved-attendance/check-out', {
        enrollmentId: reservedPass.enrollment_id
      });
      if (data?.success || data?.status === 'CHECKED_OUT') {
        alert('✓ Self check-out successful! Seat marked vacant for today.');
        fetchDashboard();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to check out.');
    }
  };

  const fetchDashboard = async () => {
    try {
      const [dashRes, walletRes, txRes, loansRes, visitRes, statsRes, vReqRes, pVacRes, logsRes, allLibsRes, resPassRes] = await Promise.allSettled([
        api.get('/api/v1/student/dashboard'),
        api.get('/api/v1/students/me/wallet'),
        api.get('/api/v1/students/me/wallet/transactions'),
        api.get('/api/v1/students/me/book-loans'),
        api.get('/api/v1/students/me/circulation-visits/active'),
        api.get('/api/v1/students/me/stats'),
        api.get('/api/v1/students/me/visitor-requests'),
        api.get('/api/v1/students/me/pending-vacate-requests'),
        api.get('/api/v1/students/me/data-access-log'),
        api.get('/api/v1/libraries/all'),
        api.get('/api/v1/student/reserved-pass')
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
      if (resPassRes.status === 'fulfilled' && resPassRes.value.data) {
        setReservedPass(resPassRes.value.data?.enrollment_id ? resPassRes.value.data : null);
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

  // ── Sidebar open/close state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Near-me library search state
  const [nearbyLibraries, setNearbyLibraries] = useState<any[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [searchCity, setSearchCity] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [locationGranted, setLocationGranted] = useState(false);

  const fetchNearby = async (lat?: number, lng?: number, city?: string) => {
    setNearbyLoading(true);
    try {
      const params: any = {};
      if (lat && lng) { params.lat = lat; params.lng = lng; }
      else if (city) { params.city = city; }
      const { data } = await api.get('/api/v1/libraries/search', { params });
      if (data?.data?.libraries) setNearbyLibraries(data.data.libraries.slice(0, 8));
      else if (Array.isArray(data?.data)) setNearbyLibraries(data.data.slice(0, 8));
    } catch { setNearbyLibraries(allLibraries.slice(0, 8)); }
    finally { setNearbyLoading(false); }
  };

  // On mount: try GPS, fall back to registered city
  useEffect(() => {
    if (allLibraries.length > 0 && nearbyLibraries.length === 0) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setLocationGranted(true);
            fetchNearby(pos.coords.latitude, pos.coords.longitude);
          },
          () => {
            // GPS denied – show all libs
            setNearbyLibraries(allLibraries.slice(0, 8));
          },
          { timeout: 4000 }
        );
      } else {
        setNearbyLibraries(allLibraries.slice(0, 8));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allLibraries]);

  const handleUseLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationGranted(true);
        fetchNearby(pos.coords.latitude, pos.coords.longitude);
      },
      () => alert('Location access denied. Please enable it from browser settings.')
    );
  };

  const navigate = useNavigate();
  const handleSearch = () => {
    if (searchQuery.trim() || searchCity.trim()) {
      const q = searchQuery.trim() || searchCity.trim();
      navigate(`/search?q=${encodeURIComponent(q)}`);
    } else {
      navigate('/search');
    }
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (isHi) {
      if (h < 12) return 'शुभ प्रभात';
      if (h < 17) return 'शुभ दोपहर';
      return 'शुभ संध्या';
    }
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className="min-h-screen bg-[#f6f8fc] dark:bg-[#07090f] text-slate-800 dark:text-slate-100 flex flex-col transition-colors duration-300">
      <Navbar onToggleSidebar={() => setSidebarOpen(prev => !prev)} />

      <div className="flex flex-1 overflow-hidden">
        <StudentSidebar activeItemId={activeTab} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-y-auto relative">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        
        {/* HEADER / WELCOME SECTION */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#ffdb4d] opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
          
          <div className="relative z-10 flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-gray-100 border-2 border-white shadow-sm flex items-center justify-center text-2xl font-bold text-gray-400 overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                profile?.full_name?.charAt(0) || userEmail?.charAt(0)?.toUpperCase() || 'S'
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">{getGreeting()},</p>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                {profile?.full_name || userEmail?.split('@')[0] || 'Student'}
              </h1>
            </div>
          </div>
          
          <div className="relative z-10 grid grid-cols-2 gap-3 w-full md:w-auto">
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 min-w-[120px]">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Bookings</div>
              <div className="text-2xl font-black text-gray-900">{bookings.length}</div>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 min-w-[120px]">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Libraries</div>
              <div className="text-2xl font-black text-gray-900">{savedLibraries.length}</div>
            </div>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2">
          {[
            { id: 'active', label: 'Dashboard', icon: '⚡' },
            { id: 'libraries', label: 'My Libraries', icon: '📚' },
            { id: 'books', label: 'Circulation', icon: '📖' },
            { id: 'complaints', label: 'Support', icon: '🎧' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-gray-900 text-white shadow-md'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB CONTENTS */}
        <div className="mt-6">
          
          {/* DASHBOARD TAB (Active Bookings) */}
          {activeTab === 'active' && (
            <div className="space-y-6">
              
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Current Passes & Bookings</h2>
                <button 
                  onClick={() => navigate('/search')}
                  className="text-sm font-bold text-gray-900 underline decoration-2 decoration-[#ffdb4d] underline-offset-4 hover:text-black transition"
                >
                  Book New Pass →
                </button>
              </div>

              {loading ? (
                <div className="py-20 flex justify-center"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div></div>
              ) : bookings.length === 0 ? (
                <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm">
                  <div className="text-5xl mb-4">🪑</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">No Active Bookings</h3>
                  <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">You don't have any upcoming or active library passes. Secure your study space now.</p>
                  <button onClick={() => navigate('/search')} className="bg-[#ffdb4d] hover:bg-[#e6c545] text-black font-semibold rounded-xl px-8 py-3 transition shadow-sm">
                    Explore Libraries
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {bookings.map((booking: any) => {
                    const isPassed = new Date(booking.end_time) < new Date();
                    const isActive = booking.status === 'CONFIRMED' && !isPassed;
                    
                    return (
                      <div key={booking.booking_id} className={`bg-white rounded-3xl p-6 border ${isActive ? 'border-[#ffdb4d] shadow-sm' : 'border-gray-200'} relative overflow-hidden group`}>
                        {isActive && <div className="absolute top-0 right-0 w-16 h-16 bg-[#ffdb4d] opacity-10 rounded-bl-full"></div>}
                        
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider mb-2 ${
                              booking.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' :
                              booking.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                              booking.status === 'CANCELLED' ? 'bg-rose-100 text-rose-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {booking.status === 'CONFIRMED' ? '✨ Confirmed' : booking.status}
                            </span>
                            <h3 className="text-lg font-black text-gray-900 leading-tight">{booking.library_name || 'Library'}</h3>
                          </div>
                        </div>

                        <div className="space-y-3 mb-6 bg-gray-50 rounded-2xl p-4 border border-gray-100">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500 font-medium">Pass Type</span>
                            <span className="font-bold text-gray-900">{booking.pass_type}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500 font-medium">Desk Code</span>
                            <span className="font-black text-gray-900 bg-white border border-gray-200 px-2 py-0.5 rounded">{booking.seat_code || 'TBD'}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500 font-medium">Time</span>
                            <span className="font-bold text-gray-900">{formatTime(booking.start_time)} - {formatTime(booking.end_time)}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <button 
                            onClick={() => { setSelectedBooking(booking); setShowTimelineModal(true); }}
                            className="py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 transition"
                          >
                            View Timeline
                          </button>
                          <button 
                            onClick={() => { setSelectedBooking(booking); setShowExtensionModal(true); }}
                            disabled={!isActive || booking.pass_type === 'MONTHLY'}
                            className={`py-2.5 rounded-xl text-sm font-bold transition ${
                              (!isActive || booking.pass_type === 'MONTHLY') 
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                : 'bg-gray-900 text-white hover:bg-black shadow-sm'
                            }`}
                          >
                            Extend Time
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* MY LIBRARIES TAB */}
          {activeTab === 'libraries' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-gray-900">Saved Libraries</h2>
              </div>
              
              {loading ? (
                <div className="py-20 flex justify-center"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div></div>
              ) : savedLibraries.length === 0 ? (
                <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm">
                  <div className="text-5xl mb-4">🏫</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">No Saved Libraries</h3>
                  <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">Libraries you interact with will appear here for quick access.</p>
                  <button onClick={() => navigate('/search')} className="bg-[#ffdb4d] hover:bg-[#e6c545] text-black font-semibold rounded-xl px-8 py-3 transition shadow-sm">
                    Search Libraries
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {savedLibraries.map((lib: any) => (
                    <div key={lib.library_id} className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900 mb-1">{lib.library_name}</h3>
                          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <span className="w-2 h-2 rounded-full bg-[#ffdb4d]"></span>
                            {lib.library_category || 'Public Library'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm font-medium text-gray-600 flex justify-between items-center">
                        <span>Associated Profile Status</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${lib.is_claimed ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-700'}`}>
                          {lib.is_claimed ? '✓ Verified' : 'Pending'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => navigate(`/library/${lib.library_id}`)}
                          className="py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 transition text-center"
                        >
                          View Details
                        </button>
                        <button 
                          onClick={() => { setVisitorLibId(lib.library_id); setShowDashboardVisitorModal(true); }}
                          className="py-2.5 rounded-xl bg-[#ffdb4d] text-black text-sm font-bold hover:bg-[#e6c545] transition text-center"
                        >
                          Visitor Pass
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CIRCULATION TAB */}
          {activeTab === 'books' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Borrowed Materials</h2>
              
              {loading ? (
                <div className="py-20 flex justify-center"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div></div>
              ) : bookLoans.length === 0 ? (
                <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm">
                  <div className="text-5xl mb-4">📚</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">No Books Borrowed</h3>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto">You haven't checked out any books or laptops from the library circulation desk.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {bookLoans.map((loan: any) => {
                    const isOverdue = loan.status === 'OVERDUE' || (loan.status === 'ISSUED' && new Date(loan.due_at) < new Date());
                    
                    return (
                      <div key={loan.loan_id} className={`bg-white rounded-3xl p-5 border ${isOverdue ? 'border-rose-300 bg-rose-50/30' : 'border-gray-100'} shadow-sm`}>
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="text-base font-bold text-gray-900">{loan.title}</h3>
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isOverdue ? 'bg-rose-100 text-rose-700' : 
                            loan.status === 'RETURNED' ? 'bg-gray-100 text-gray-500' : 
                            'bg-emerald-100 text-emerald-700'
                          }`}>
                            {isOverdue ? 'OVERDUE' : loan.status}
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-500 mb-4 font-medium">{loan.library_name}</p>
                        
                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Issued</span>
                            <span className="font-semibold text-gray-900">{formatDate(loan.issued_at)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Due Date</span>
                            <span className={`font-bold ${isOverdue ? 'text-rose-600' : 'text-gray-900'}`}>{formatDate(loan.due_at)}</span>
                          </div>
                          {loan.returned_at && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Returned</span>
                              <span className="font-semibold text-gray-900">{formatDate(loan.returned_at)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* COMPLAINTS TAB */}
          {activeTab === 'complaints' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Support Tickets</h2>
              
              {loading ? (
                <div className="py-20 flex justify-center"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div></div>
              ) : complaints.length === 0 ? (
                <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm">
                  <div className="text-5xl mb-4">💬</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">No Support Tickets</h3>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto">You haven't reported any issues. If you need help, you can report issues directly from the library page.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {complaints.map((comp: any) => (
                    <div key={comp.id} className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <span className="px-2 py-1 bg-gray-100 rounded text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                          {comp.category || 'General'}
                        </span>
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                          comp.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700' : 
                          comp.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' : 
                          'bg-rose-100 text-rose-700'
                        }`}>
                          {comp.status || 'PENDING'}
                        </span>
                      </div>
                      
                      <h3 className="text-base font-bold text-gray-900 mb-1">{comp.subject}</h3>
                      <p className="text-sm text-gray-500 mb-4 line-clamp-2">{comp.description}</p>
                      
                      <div className="text-xs font-semibold text-gray-400">
                        {formatDate(comp.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>


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
                      {allLibraries.filter((l: any) => l.allowVisitorPasses !== false && l.allow_visitor_passes !== false).map(l => (
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
                      {myLibraries.filter((l: any) => l.allowVisitorPasses !== false && l.allow_visitor_passes !== false).map(l => (
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
                      {Array.from(new Map(bookings.map(b => [b.library_id || b.library_name, b])).values()).filter((b: any) => b.allowVisitorPasses !== false && b.allow_visitor_passes !== false).map((b: any) => (
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
