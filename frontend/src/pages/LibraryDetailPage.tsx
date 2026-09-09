import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import Navbar from '../components/Navbar';
import { useSeatMapUpdates } from '../hooks/useSeatMapUpdates';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SeatStatus = 'AVAILABLE' | 'LOCKED' | 'BOOKED' | 'IN_USE' | 'MAINTENANCE';

export interface Seat {
  id: string;
  seatCode: string;
  row_idx: number;
  col_idx: number;
  status: SeatStatus;
  is_girls_only?: boolean;
  is_sofa?: boolean;
  is_free?: boolean;
  has_power_socket?: boolean;
  seat_type?: string;
  custom_type_name?: string;
  custom_type_icon?: string;
  dist_to_ac_m?: number;
  dist_to_door_m?: number;
}

interface Shift {
  id: string;
  shift_name: string;
  start_time: string;
  end_time: string;
  daily_price: number;
  monthly_price: number;
  freeCount?: number;
}

interface LibraryInfo {
  id: string;
  name: string;
  city: string;
  locality: string;
  state: string;
  contact_number?: string;
  address?: string;
  email?: string;
  locker_mode: 'NO_LOCKERS' | 'FREE_LOCKERS' | 'PAID_MANAGED';
  seating_type: string;
  isFree?: boolean;
  is_free?: boolean;
  libraryCategory?: string;
  library_category?: string;
  allowedEmailDomain?: string;
  allowed_email_domain?: string;
  total_seats?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour < 12 ? 'AM' : 'PM'}`;
}

const DEFAULT_SHIFTS: Shift[] = [
  { id: '11111111-1111-1111-1111-111111111111', shift_name: 'Morning Slot 1 (6 AM - 9 AM)', start_time: '06:00:00', end_time: '09:00:00', daily_price: 150, monthly_price: 800, freeCount: 5 },
  { id: '22222222-2222-2222-2222-222222222222', shift_name: 'Morning Slot 2 (9 AM - 12 PM)', start_time: '09:00:00', end_time: '12:00:00', daily_price: 150, monthly_price: 800, freeCount: 3 },
  { id: '33333333-3333-3333-3333-333333333333', shift_name: 'Afternoon Slot 1 (12 PM - 3 PM)', start_time: '12:00:00', end_time: '15:00:00', daily_price: 150, monthly_price: 800, freeCount: 4 },
  { id: '44444444-4444-4444-4444-444444444444', shift_name: 'Afternoon Slot 2 (3 PM - 6 PM)', start_time: '15:00:00', end_time: '18:00:00', daily_price: 150, monthly_price: 800, freeCount: 2 },
  { id: '55555555-5555-5555-5555-555555555555', shift_name: 'Evening Slot 1 (6 PM - 9 PM)', start_time: '18:00:00', end_time: '21:00:00', daily_price: 180, monthly_price: 900, freeCount: 6 },
  { id: '66666666-6666-6666-6666-666666666666', shift_name: 'Night Slot 1 (9 PM - 12 AM)', start_time: '21:00:00', end_time: '00:00:00', daily_price: 150, monthly_price: 700, freeCount: 8 },
  { id: '77777777-7777-7777-7777-777777777777', shift_name: 'Night Slot 2 (12 AM - 3 AM)', start_time: '00:00:00', end_time: '03:00:00', daily_price: 120, monthly_price: 600, freeCount: 12 },
  { id: '88888888-8888-8888-8888-888888888888', shift_name: 'Early Morning (3 AM - 6 AM)', start_time: '03:00:00', end_time: '06:00:00', daily_price: 120, monthly_price: 600, freeCount: 15 },
];



export default function LibraryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [library, setLibrary] = useState<LibraryInfo | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [seatLockToken, setSeatLockToken] = useState<string | null>(null);
  const [lockExpiresAt, setLockExpiresAt] = useState<number | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Real-time seat count per shift (replaces dummy freeCount)
  const [shiftFreeSeats, setShiftFreeSeats] = useState<Record<string, number>>({});

  // Emergency VIP Guest Seat Modal State
  const [showEmergencyGuestModal, setShowEmergencyGuestModal] = useState(false);
  const [emergencyGuestSeat, setEmergencyGuestSeat] = useState<Seat | null>(null);
  const [emergencyGuestName, setEmergencyGuestName] = useState('');
  const [emergencyGuestDesignation, setEmergencyGuestDesignation] = useState('');

  const handleEmergencyGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emergencyGuestSeat || !emergencyGuestName.trim() || !emergencyGuestDesignation.trim()) return;
    const seatToBook = emergencyGuestSeat;
    setSelectedSeat(seatToBook);
    setShowEmergencyGuestModal(false);
    handleCheckout({
      isEmergencyGuest: true,
      fullName: emergencyGuestName.trim(),
      collegeEmail: 'guest.emergency@eduglobin.com',
      collegeIdNumber: `EMERGENCY-GUEST-${Date.now().toString().slice(-4)}`,
      degreeProgram: emergencyGuestDesignation.trim(),
      branchDepartment: 'Emergency VIP Guest'
    });
  };

  // Custom time slot mode (for non-Institute libraries)
  const [timeMode, setTimeMode] = useState<'SHIFT' | 'CUSTOM'>('SHIFT');
  const [customStartTime, setCustomStartTime] = useState('');
  const [customDurationMinutes, setCustomDurationMinutes] = useState(120);

  // Real-time STOMP / WebSocket & live polling hook for instant seat status updates
  useSeatMapUpdates(
    library?.id || id,
    activeShift?.id,
    useCallback((update) => {
      if (update.resourceType === 'SEAT') {
        setSeats((prev) =>
          prev.map((seat) =>
            seat.id === update.resourceId ? { ...seat, status: update.status } : seat
          )
        );
      }
    }, []),
    null
  );

  // Timer countdown
  useEffect(() => {
    if (!lockExpiresAt) { setSecondsLeft(null); return; }
    const tick = () => {
      const diff = Math.max(0, Math.floor((lockExpiresAt - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff === 0) {
        setSeatLockToken(null);
        setLockExpiresAt(null);
        setSelectedSeat(null);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockExpiresAt]);

  // Fetch seats for chosen shift from backend
  const fetchSeats = useCallback(async (shiftId: string) => {
    if (!id) return;
    try {
      const { data } = await api.get(`/api/v1/libraries/${id}/seats?shiftId=${shiftId}`);
      const payload = data.data;
      if (payload.library) {
        setLibrary((prev) => ({
          ...prev,
          ...payload.library,
          name: payload.library.name || prev?.name,
          libraryCategory: payload.library.library_category || payload.library.libraryCategory || prev?.libraryCategory,
          library_category: payload.library.library_category || payload.library.libraryCategory || prev?.library_category,
          allowedEmailDomain: payload.library.allowed_email_domain || payload.library.allowedEmailDomain || prev?.allowedEmailDomain,
          allowed_email_domain: payload.library.allowed_email_domain || payload.library.allowedEmailDomain || prev?.allowed_email_domain,
          contact_number: payload.library.contact_number || prev?.contact_number,
          address: payload.library.address || prev?.address,
          isFree: payload.library.is_free ?? prev?.isFree,
        }));
      }
      if (payload.seats && payload.seats.length > 0) {
        setSeats(payload.seats.map((s: any) => ({
          id: s.id,
          seatCode: s.seat_code,
          row_idx: s.row_idx,
          col_idx: s.col_idx,
          status: s.status as SeatStatus,
          is_girls_only: s.is_girls_only,
          is_sofa: s.is_sofa,
          is_free: s.is_free,
          has_power_socket: s.has_power_socket,
          seat_type: s.seat_type,
          custom_type_name: s.custom_type_name,
          custom_type_icon: s.custom_type_icon,
        })));
      }
    } catch (e: any) {
      console.warn('Could not load real seats layout for library:', e);
    }
  }, [id]);

  // Fetch real-time available seat counts for all shifts when library loads
  const fetchShiftFreeCounts = useCallback(async (shiftList: Shift[]) => {
    if (!id || shiftList.length === 0) return;
    const counts: Record<string, number> = {};
    await Promise.allSettled(
      shiftList.map(async (s) => {
        try {
          const { data } = await api.get(`/api/v1/libraries/${id}/seats?shiftId=${s.id}`);
          const seats: any[] = data?.data?.seats || [];
          counts[s.id] = seats.filter((seat: any) => seat.status === 'AVAILABLE').length;
        } catch { counts[s.id] = 0; }
      })
    );
    setShiftFreeSeats(counts);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    // 1. Fetch real library details
    api.get(`/api/v1/libraries/${id}`)
      .then(({ data }) => {
        let libData = data.data;
        if (Array.isArray(libData)) {
          libData = libData[0];
        }
        if (libData) {
          const isLibFree = Boolean(libData.is_free);
          const cat = libData.library_category || libData.libraryCategory || 'INSTITUTE';
          const domain = libData.allowed_email_domain || libData.allowedEmailDomain || 'iitbhilai.ac.in';
          
          setLibrary({
            ...libData,
            name: libData.name || 'IIT Bhilai',
            libraryCategory: cat,
            library_category: cat,
            allowedEmailDomain: domain,
            allowed_email_domain: domain,
            contact_number: libData.contact_number || '+91 98765 43210',
            address: libData.address || `${libData.locality || ''}, ${libData.city || ''}`,
            isFree: isLibFree,
          });
          
          const rawShifts: Shift[] = libData.shifts ?? [];
          let formattedShifts: Shift[] = [];

          if (rawShifts.length > 0) {
            formattedShifts = rawShifts.map((s) => ({
              ...s,
              daily_price: isLibFree ? 0 : Number(s.daily_price || libData.base_desk_price_daily || 0),
              monthly_price: isLibFree ? 0 : Number(s.monthly_price || libData.base_desk_price_monthly || 0),
            }));
          } else {
            const mPrice = isLibFree ? 0 : Number(libData.base_desk_price_monthly || 800);
            const dPrice = isLibFree ? 0 : Number(libData.base_desk_price_daily || Math.round(mPrice / 30));

            formattedShifts = [
              { id: 'shift-morning', shift_name: 'Morning Shift', start_time: '06:00:00', end_time: '12:00:00', daily_price: dPrice, monthly_price: mPrice },
              { id: 'shift-afternoon', shift_name: 'Afternoon Shift', start_time: '12:00:00', end_time: '18:00:00', daily_price: dPrice, monthly_price: mPrice },
              { id: 'shift-evening', shift_name: 'Evening Shift', start_time: '18:00:00', end_time: '00:00:00', daily_price: dPrice, monthly_price: mPrice },
              { id: 'shift-night', shift_name: 'Night Shift', start_time: '00:00:00', end_time: '06:00:00', daily_price: dPrice, monthly_price: mPrice },
            ];
          }

          setShifts(formattedShifts);
          const initialShift = formattedShifts.length > 0 ? formattedShifts[0] : DEFAULT_SHIFTS[0];
          setActiveShift(initialShift);
          if (initialShift) {
            fetchSeats(initialShift.id);
          }
          // Fetch free counts for all shifts in parallel
          fetchShiftFreeCounts(formattedShifts);
        }
      })
      .catch((err) => {
        console.warn('Using fallback library details:', err);
      })
      .finally(() => setLoading(false));
  }, [id, fetchSeats, fetchShiftFreeCounts]);

  // Render real database seats matching owner's layout map identically
  const displayedSeats = useMemo(() => {
    if (seats && seats.length > 0) {
      return [...seats].sort((a, b) => {
        if (a.row_idx !== b.row_idx) return a.row_idx - b.row_idx;
        return a.col_idx - b.col_idx;
      });
    }

    // Fallback while loading (matching owner layout: 6 columns per row)
    const totalCount = library?.total_seats && library.total_seats > 0 ? library.total_seats : 30;
    const generated: Seat[] = [];
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'P'];
    const colsPerRow = 6;
    let seatNum = 0;

    for (let rIdx = 0; rIdx < rows.length && seatNum < totalCount; rIdx++) {
      for (let col = 0; col < colsPerRow && seatNum < totalCount; col++) {
        seatNum++;
        const seatCode = `${rows[rIdx]}${col + 1}`;
        generated.push({
          id: `00000000-0000-0000-0000-${String(seatNum).padStart(12, '0')}`,
          seatCode,
          row_idx: rIdx,
          col_idx: col,
          status: 'AVAILABLE',
          is_girls_only: false,
          is_sofa: false,
          is_free: Boolean(library?.isFree || library?.is_free),
          has_power_socket: true,
          seat_type: 'DESK',
        });
      }
    }
    return generated;
  }, [seats, library]);

  // Enhanced In-Modal Guest Auth Handshake State
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestStep, setGuestStep] = useState<'EMAIL' | 'LOGIN' | 'SIGNUP'>('EMAIL');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [guestFullName, setGuestFullName] = useState('');
  const [guestGender, setGuestGender] = useState<'FEMALE' | 'MALE' | 'OTHER'>('FEMALE');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestChecking, setGuestChecking] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);

  // Check Guest Email & Route to In-Modal Login or Signup Handshake
  const handleGuestEmailCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestEmail.trim()) return;
    setGuestChecking(true);
    setGuestError(null);

    try {
      const { data } = await api.post('/api/v1/auth/check-email', { email: guestEmail.trim() });
      const isRegistered = data?.data?.isRegistered ?? false;
      if (isRegistered) {
        setGuestStep('LOGIN');
      } else {
        setGuestStep('SIGNUP');
      }
    } catch (err: any) {
      setGuestError('Could not verify email address. Please try again.');
    } finally {
      setGuestChecking(false);
    }
  };

  const handleGuestLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestPassword.trim()) return;
    setGuestChecking(true);
    setGuestError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: guestEmail.trim(),
        password: guestPassword.trim(),
      });
      if (error) throw error;
      if (data?.session) {
        setShowGuestModal(false);
        // Automatically continue checkout with logged in user!
        if (selectedSeat) {
          handleCheckout();
        }
      }
    } catch (err: any) {
      setGuestError(err.message || 'Invalid email or password.');
    } finally {
      setGuestChecking(false);
    }
  };

  const handleGuestSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestPassword.trim() || !guestFullName.trim()) return;
    setGuestChecking(true);
    setGuestError(null);

    try {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: guestEmail.trim(),
        password: guestPassword.trim(),
        options: {
          data: {
            full_name: guestFullName.trim(),
            gender: guestGender,
            role: 'STUDENT',
          }
        }
      });
      if (signUpErr) throw signUpErr;

      // If no session yet (email not auto-confirmed), sign in explicitly to get one
      let activeSession = signUpData?.session;
      if (!activeSession) {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: guestEmail.trim(),
          password: guestPassword.trim(),
        });
        if (signInErr) throw signInErr;
        activeSession = signInData?.session ?? null;
      }

      if (!activeSession) {
        setGuestError('Account created! Please check your email to confirm, then sign in to complete booking.');
        setGuestChecking(false);
        return;
      }

      // Register profile with Spring Boot backend using the fresh session token
      try {
        await api.post('/api/v1/auth/register', {
          fullName: guestFullName.trim(),
          role: 'STUDENT',
          phone: guestPhone.trim(),
        });
      } catch (_) {}

      setShowGuestModal(false);
      // Automatically continue checkout with the now-authenticated session
      if (selectedSeat) {
        handleCheckout();
      }
    } catch (err: any) {
      setGuestError(err.message || 'Could not create account.');
    } finally {
      setGuestChecking(false);
    }
  };

  // Seat selection with Guest Auth Gate & Backend Generalized Redis Lock
  const handleSeatSelect = useCallback(async (seat: Seat) => {
    // 1. Guest Check: Must be logged in as student
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setSelectedSeat(seat);
      setShowGuestModal(true);
      return;
    }

    if (seat.status !== 'AVAILABLE') return;

    if (seat.is_girls_only) {
      const currentGender = (instituteForm.gender || 'FEMALE').toUpperCase();
      if (currentGender === 'MALE') {
        alert(
          `🚫 Girls Safety Section Desk:\n\nDesk ${seat.seatCode} is located in the Girls Safety Section and is strictly reserved for female students.\n\nYour profile gender is currently registered as MALE (♂). Please choose an unreserved general study desk.`
        );
        return;
      }
      const confirmFemale = window.confirm(
        `♀️ Girls-Only Reserved Seat:\n\nSeat ${seat.seatCode} is located in the Girls Safety Section and is strictly reserved for female students.\n\nPlease click OK to confirm you are booking for a female student.`
      );
      if (!confirmFemale) return;
    }

    // Release old lock if switching
    if (selectedSeat && selectedSeat.id !== seat.id && seatLockToken) {
      try {
        await api.post('/api/v1/resources/release', {
          resourceType: 'SEAT',
          resourceId: selectedSeat.id,
          lockToken: seatLockToken
        });
      } catch (_) {}
    }

    setSelectedSeat(seat);

    // Call Redis generalized lock engine
    try {
      const { data } = await api.post('/api/v1/resources/lock', {
        resourceType: 'SEAT',
        resourceId: seat.id,
        libraryId: id,
        shiftId: activeShift?.id || shifts[0]?.id || '11111111-1111-1111-1111-111111111111',
      });
      if (data?.data?.lockToken) {
        setSeatLockToken(data.data.lockToken);
        setLockExpiresAt(data.data.expiresAt);
      }
    } catch (err: any) {
      if (err?.response?.status === 409) {
        alert('⚡ That seat was just reserved by another student! Please pick another.');
        setSelectedSeat(null);
      } else {
        // Fallback demo lock for instant local evaluation
        setSeatLockToken(`mock-lock-${seat.id}`);
        setLockExpiresAt(Date.now() + 7 * 60 * 1000);
      }
    }
  }, [activeShift, selectedSeat, seatLockToken, id, navigate]);

  // Institute Student Verification State
  const [showInstituteModal, setShowInstituteModal] = useState(false);
  const [instituteModalStep, setInstituteModalStep] = useState<'CONFIRM_RETURNING' | 'LOOKUP' | 'CASE_A' | 'CASE_B'>('LOOKUP');
  const [lookupIdInput, setLookupIdInput] = useState('');
  const [idLookupLoading, setIdLookupLoading] = useState(false);
  const [rosterInfo, setRosterInfo] = useState<{ isListed: boolean; isClaimed: boolean; studentName?: string; contactNumber?: string; email?: string } | null>(null);
  const [savedProfile, setSavedProfile] = useState<any>(null);

  const [instituteForm, setInstituteForm] = useState({
    collegeEmail: '',
    collegeIdNumber: '',
    fullName: '',
    phone: '',
    studentAge: 20,
    degreeProgram: 'B.Tech',
    branchDepartment: 'Computer Science & Engineering',
    gender: 'FEMALE' as 'FEMALE' | 'MALE' | 'OTHER',
  });
  const [instituteError, setInstituteError] = useState<string | null>(null);

  const handleIdLookup = async (idToSearch?: string) => {
    const searchId = (idToSearch || lookupIdInput || instituteForm.collegeIdNumber).trim();
    if (!searchId) {
      setInstituteError('Please enter your Institute Student ID Number.');
      return;
    }
    setIdLookupLoading(true);
    setInstituteError(null);
    try {
      const { data } = await api.get(`/api/v1/libraries/${id}/check-id?idNumber=${encodeURIComponent(searchId)}`);
      const result = data?.data || { isListed: false, isClaimed: false };
      setRosterInfo(result);
      setInstituteForm(prev => ({
        ...prev,
        collegeIdNumber: searchId,
        collegeEmail: result.email || prev.collegeEmail,
        fullName: result.studentName || prev.fullName,
        phone: result.contactNumber || prev.phone,
      }));
      if (result.isListed) {
        setInstituteModalStep('CASE_A');
      } else {
        setInstituteModalStep('CASE_B');
      }
    } catch (err: any) {
      setRosterInfo({ isListed: false, isClaimed: false });
      setInstituteForm(prev => ({ ...prev, collegeIdNumber: searchId }));
      setInstituteModalStep('CASE_B');
    } finally {
      setIdLookupLoading(false);
    }
  };

  // Flexible Time Slot for Institute Libraries (Student Gap Closure #2, #3, #5)
  const [flexibleStartTime, setFlexibleStartTime] = useState<string>('NOW');
  const [flexibleDurationMinutes, setFlexibleDurationMinutes] = useState<number>(180); // Default 3 hours, max 300m (5h cap)
  const [instituteTimeMode, setInstituteTimeMode] = useState<'PRESET' | 'CUSTOM' | 'SHIFT'>('PRESET');
  const [queueJoining, setQueueJoining] = useState(false);
  const [queueStatusMsg, setQueueStatusMsg] = useState<string | null>(null);

  const handleJoinSeatQueue = async () => {
    if (!id) return;
    setQueueJoining(true);
    setQueueStatusMsg(null);
    try {
      const { data } = await api.post(`/api/v1/libraries/${id}/queue`, {
        libraryId: id,
        seatPreference: 'ANY',
        minDurationMinutes: flexibleDurationMinutes
      });
      if (data.success) {
        setQueueStatusMsg(`🎉 You are #${data.data?.queuePosition || 1} in the seat queue! We will alert you via WhatsApp/Push notification as soon as a desk opens.`);
      } else {
        setQueueStatusMsg(data.message || 'Joined queue successfully.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Joined seat queue! We will notify you as soon as a desk opens.';
      setQueueStatusMsg(`🔔 ${msg}`);
    } finally {
      setQueueJoining(false);
    }
  };

  // Derive live active slot information (handles Institute flexible slot, custom time slot, and fixed daypart shift)
  const getSelectedSlotInfo = useCallback(() => {
    const libCat = (library?.libraryCategory || library?.library_category || 'PRIVATE').toUpperCase();
    const isInstitute = libCat === 'INSTITUTE';

    if (isInstitute) {
      if (instituteTimeMode === 'CUSTOM') {
        const startStr = customStartTime || new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
        const [hh, mm] = (startStr || '').split(':').map(Number);
        const startDate = new Date();
        startDate.setHours(isNaN(hh) ? 0 : hh, isNaN(mm) ? 0 : mm, 0, 0);
        const endDate = new Date(startDate.getTime() + flexibleDurationMinutes * 60000);
        
        const startFormatted = startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        const endFormatted = endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        const durHours = Math.floor(flexibleDurationMinutes / 60);
        const durMins = flexibleDurationMinutes % 60;
        const durLabel = durHours > 0 ? `${durHours}h${durMins > 0 ? ` ${durMins}m` : ''}` : `${durMins}m`;

        return {
          slotLabel: 'Custom Time Slot',
          slotName: `Custom Slot (${durLabel})`,
          timing: `${startFormatted} - ${endFormatted} (${durLabel})`,
          timingShort: `${startFormatted} - ${endFormatted}`,
          price: '100% FREE',
          isFree: true,
          durationMinutes: flexibleDurationMinutes
        };
      } else if (instituteTimeMode === 'PRESET') {
        const now = new Date();
        const endDate = new Date(now.getTime() + flexibleDurationMinutes * 60000);
        const startFormatted = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        const endFormatted = endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        const durHours = Math.floor(flexibleDurationMinutes / 60);
        const durMins = flexibleDurationMinutes % 60;
        const durLabel = durHours > 0 ? `${durHours}h${durMins > 0 ? ` ${durMins}m` : ''}` : `${durMins}m`;

        return {
          slotLabel: 'Flexible Study Slot',
          slotName: `From Now (${durLabel})`,
          timing: `From Now: ${startFormatted} - ${endFormatted} (${durLabel})`,
          timingShort: `${startFormatted} - ${endFormatted}`,
          price: '100% FREE',
          isFree: true,
          durationMinutes: flexibleDurationMinutes
        };
      }
    } else {
      if (timeMode === 'CUSTOM') {
        const startStr = customStartTime || new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
        const [hh, mm] = (startStr || '').split(':').map(Number);
        const startDate = new Date();
        startDate.setHours(isNaN(hh) ? 0 : hh, isNaN(mm) ? 0 : mm, 0, 0);
        const endDate = new Date(startDate.getTime() + customDurationMinutes * 60000);
        
        const startFormatted = startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        const endFormatted = endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        const durHours = Math.floor(customDurationMinutes / 60);
        const durMins = customDurationMinutes % 60;
        const durLabel = durHours > 0 ? `${durHours}h${durMins > 0 ? ` ${durMins}m` : ''}` : `${durMins}m`;
        const isFree = Number(activeShift?.daily_price ?? 0) === 0 || library?.isFree;

        return {
          slotLabel: 'Custom Time Slot',
          slotName: `Custom Slot (${durLabel})`,
          timing: `${startFormatted} - ${endFormatted} (${durLabel})`,
          timingShort: `${startFormatted} - ${endFormatted}`,
          price: isFree ? '100% FREE' : `₹${activeShift?.daily_price || 0}`,
          isFree,
          durationMinutes: customDurationMinutes
        };
      }
    }

    // Default Fixed Daypart Shift
    const isFree = Number(activeShift?.daily_price ?? 0) === 0 || library?.isFree;
    const startFormatted = activeShift ? formatTime(activeShift.start_time || '06:00:00') : '06:00 AM';
    const endFormatted = activeShift ? formatTime(activeShift.end_time || '23:00:00') : '11:00 PM';
    return {
      slotLabel: 'Fixed Daypart Shift',
      slotName: activeShift?.shift_name || (activeShift as any)?.shiftName || 'Standard Shift',
      timing: `${startFormatted} - ${endFormatted}`,
      timingShort: `${startFormatted} - ${endFormatted}`,
      price: isFree ? '100% FREE' : `₹${activeShift?.daily_price || 0}`,
      isFree,
      durationMinutes: undefined
    };
  }, [library, instituteTimeMode, flexibleDurationMinutes, customStartTime, timeMode, customDurationMinutes, activeShift]);

  // Government Library Verification State (Aadhaar / Voter ID)
  const [showGovtModal, setShowGovtModal] = useState(false);
  const [govtForm, setGovtForm] = useState({
    fullName: '',
    aadhaarLast4: '',
    voterIdNumber: '',
    city: '',
    targetExam: 'UPSC',
  });
  const [govtError, setGovtError] = useState<string | null>(null);

  const [isReturningStudent, setIsReturningStudent] = useState(false);

  // Student Grievance & Feedback Desk State
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [complaintCategory, setComplaintCategory] = useState<string>('AC_COOLING');
  const [complaintPriority, setComplaintPriority] = useState<string>('NORMAL');
  const [complaintDescription, setComplaintDescription] = useState('');
  const [complaintIsAnonymous, setComplaintIsAnonymous] = useState(false);
  const [complaintSubmitting, setComplaintSubmitting] = useState(false);
  const [complaintMsg, setComplaintMsg] = useState<string | null>(null);
  const [studentComplaints, setStudentComplaints] = useState<any[]>([]);

  const fetchStudentComplaints = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await api.get('/api/v1/students/me/complaints');
      if (data?.success && Array.isArray(data.data)) {
        setStudentComplaints(data.data.filter((c: any) => c.library_id === id));
      }
    } catch (_) {}
  }, [id]);

  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintDescription.trim() || !id) return;
    setComplaintSubmitting(true);
    setComplaintMsg(null);
    try {
      const { data } = await api.post('/api/v1/complaints', {
        libraryId: id,
        category: complaintCategory,
        priority: complaintPriority,
        description: complaintDescription.trim(),
        isAnonymous: complaintIsAnonymous,
        scope: 'LIBRARY_SPECIFIC'
      });
      if (data?.success) {
        setComplaintMsg('🎉 Complaint submitted! Ticket Code: ' + (data.data?.ticketCode || 'TKT-OK'));
        setComplaintDescription('');
        fetchStudentComplaints();
        setTimeout(() => setComplaintMsg(null), 4000);
      } else {
        setComplaintMsg(data?.message || 'Error submitting complaint.');
      }
    } catch (err: any) {
      setComplaintMsg(err.response?.data?.message || 'Could not submit complaint. Please try again.');
    } finally {
      setComplaintSubmitting(false);
    }
  };

  // Visitor Pass / Circulation Visit Modal State
  const [showVisitorModal, setShowVisitorModal] = useState(false);
  const [visitorPurpose, setVisitorPurpose] = useState('CIRCULATION');
  const [visitorNotes, setVisitorNotes] = useState('');
  const [visitorLoading, setVisitorLoading] = useState(false);
  const [visitorPassResult, setVisitorPassResult] = useState<any | null>(null);

  const handleBookVisitorPass = async () => {
    if (!id) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setShowGuestModal(true);
      return;
    }
    setVisitorLoading(true);
    setVisitorPassResult(null);
    try {
      const { data } = await api.post(`/api/v1/students/me/libraries/${id}/visitor-passes`, {
        purpose: visitorPurpose,
        notes: visitorNotes
      });
      if (data?.success) {
        setVisitorPassResult(data.data);
      } else {
        alert(data?.message || 'Failed to request visitor pass.');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error submitting visitor pass request.');
    } finally {
      setVisitorLoading(false);
    }
  };

  // Pre-fill saved Institute/Govt details if student already filled them before (IRCTC Saved Passenger Identity Model)
  useEffect(() => {
    if (!id) return;
    fetchStudentComplaints();
    api.get(`/api/v1/student/library-profile?libraryId=${id}`)
      .then(({ data }) => {
        if (data?.success && data?.data && (data.data.id || data.data.institute_id_number)) {
          const prof = data.data;
          setSavedProfile(prof);
          setIsReturningStudent(true);
          if (prof.institute_email || prof.institute_id_number) {
            setInstituteForm(prev => ({
              ...prev,
              collegeEmail: prof.institute_email || prev.collegeEmail,
              collegeIdNumber: prof.institute_id_number || prev.collegeIdNumber,
              branchDepartment: prof.branch || prev.branchDepartment,
              gender: prof.gender || prev.gender,
            }));
          }
          if (prof.govt_id_type || prof.govt_id_last4) {
            setGovtForm(prev => ({
              ...prev,
              aadhaarLast4: prof.govt_id_last4 || prev.aadhaarLast4,
            }));
          }
        }
      })
      .catch(() => {});

    // Fetch Supabase session user metadata for gender and email
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const metaGender = (session.user.user_metadata?.gender || '').toUpperCase();
        if (metaGender === 'MALE' || metaGender === 'FEMALE' || metaGender === 'OTHER') {
          setInstituteForm(prev => ({ ...prev, gender: metaGender as any }));
        }
      }
    });

    try {
      const saved = localStorage.getItem('student_institute_info_global') || localStorage.getItem(`student_institute_info_${id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed) {
          setInstituteForm((prev) => ({ ...prev, ...parsed }));
        }
      }
      const savedGovt = localStorage.getItem('student_govt_info_global');
      if (savedGovt) {
        const parsedGovt = JSON.parse(savedGovt);
        if (parsedGovt) setGovtForm((prev) => ({ ...prev, ...parsedGovt }));
      }
    } catch (e) {}
  }, [id]);


  // Checkout Direct Reservation
  const handleCheckout = useCallback(async (overrides?: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setShowGuestModal(true);
      return;
    }

    if (!selectedSeat) {
      alert('Please click on a cabin seat (e.g. A1, A2, B1...) to select it first.');
      return;
    }

    const libCat = (library?.libraryCategory || library?.library_category || 'PRIVATE').toUpperCase();
    const isInstitute = libCat === 'INSTITUTE';
    const isGovernment = libCat === 'GOVERNMENT';

    // ── GIRLS-ONLY SEAT CHECK: Block Male users
    if (selectedSeat?.is_girls_only && (overrides?.gender || instituteForm.gender || '').toUpperCase() === 'MALE') {
      alert('🚫 Girls Safety Section Desk:\n\nCannot reserve a Girls Safety Section desk for a Male student profile. Please select an unreserved general desk.');
      return;
    }

    // ── INSTITUTE: Require college email + student ID with domain matching
    const emailToUse = overrides?.collegeEmail || instituteForm.collegeEmail;
    const idToUse = overrides?.collegeIdNumber || instituteForm.collegeIdNumber;
    const domainToMatch = library?.allowedEmailDomain || library?.allowed_email_domain || '';
    const cleanAllowed = domainToMatch.replace('@', '').toLowerCase().trim();

    if (isInstitute) {
      // If student has a verified/claimed profile for this library and overrides haven't been submitted yet, show 1-Click Returning Modal!
      if (!overrides && (savedProfile?.is_claimed || (savedProfile?.institute_email && savedProfile?.institute_id_number))) {
        setInstituteModalStep('CONFIRM_RETURNING');
        setShowInstituteModal(true);
        setCheckoutLoading(false);
        return;
      }

      const emailDomain = (emailToUse || '').substring((emailToUse || '').indexOf('@') + 1).toLowerCase().trim();

      if (!emailToUse || !idToUse || (cleanAllowed && emailDomain !== cleanAllowed && !emailDomain.endsWith('.' + cleanAllowed))) {
        if (cleanAllowed && emailDomain && emailDomain !== cleanAllowed && !emailDomain.endsWith('.' + cleanAllowed)) {
          setInstituteError(
            `⚠️ Email Domain Verification Failed: This campus library requires a valid @${cleanAllowed} college email address (e.g. student@${cleanAllowed}). Your entry "${emailToUse}" is not allowed.`
          );
        } else {
          setInstituteError('College Email and Student ID are mandatory for Institute library booking.');
        }
        if (!overrides) {
          if (savedProfile?.institute_id_number) {
            setInstituteModalStep('CONFIRM_RETURNING');
          } else {
            setInstituteModalStep('LOOKUP');
          }
        }
        setShowInstituteModal(true);
        setCheckoutLoading(false);
        return;
      }
    }

    if (isInstitute && emailToUse && idToUse) {
      try {
        const toSave = {
          collegeEmail: emailToUse,
          collegeIdNumber: idToUse,
          studentAge: overrides?.studentAge || instituteForm.studentAge,
          degreeProgram: overrides?.degreeProgram || instituteForm.degreeProgram,
          branchDepartment: overrides?.branchDepartment || instituteForm.branchDepartment,
          gender: overrides?.gender || instituteForm.gender,
        };
        localStorage.setItem('student_institute_info_global', JSON.stringify(toSave));
        localStorage.setItem(`student_institute_info_${id}`, JSON.stringify(toSave));
        
        api.post('/api/v1/student/library-profile', {
          libraryId: id,
          libraryCategory: 'INSTITUTE',
          instituteEmail: emailToUse,
          instituteIdNumber: idToUse,
          branch: overrides?.branchDepartment || instituteForm.branchDepartment,
          year: overrides?.degreeProgram || instituteForm.degreeProgram,
          gender: overrides?.gender || instituteForm.gender,
        }).catch(() => {});
      } catch (e) {}
    }

    // ── GOVERNMENT: Require name + Aadhaar last 4 + exam target
    const govtName = overrides?.fullName || govtForm.fullName;
    const govtAadhaar = overrides?.aadhaarLast4 || govtForm.aadhaarLast4;

    if (isGovernment && (!govtName || !govtAadhaar)) {
      setShowGovtModal(true);
      return;
    }

    if (isGovernment && govtName && govtAadhaar) {
      try {
        const toSave = {
          fullName: govtName,
          aadhaarLast4: govtAadhaar,
          voterIdNumber: overrides?.voterIdNumber || govtForm.voterIdNumber,
          city: overrides?.city || govtForm.city,
          targetExam: overrides?.targetExam || govtForm.targetExam,
        };
        localStorage.setItem('student_govt_info_global', JSON.stringify(toSave));
      } catch (e) {}
    }

    setCheckoutLoading(true);
    setCheckoutError(null);

    const isFree = Number(activeShift?.daily_price) === 0 || library?.isFree;
    const paymentNonce = isFree ? 'FREE_PASS' : `test-nonce-${Date.now()}`;

    try {
      const { data } = await api.post('/api/v1/bookings/checkout', {
        seatLockToken: seatLockToken || `token-${selectedSeat.id}`,
        seatId: selectedSeat.id,
        shiftId: activeShift?.id || shifts[0]?.id || '11111111-1111-1111-1111-111111111111',
        libraryId: id,
        passType: 'DAILY',
        paymentNonce,
        // Duration: institute uses flexible slider; others use custom if enabled
        durationMinutes: isInstitute
          ? flexibleDurationMinutes
          : (timeMode === 'CUSTOM' ? customDurationMinutes : undefined),
        // Custom start time
        customStartTime: isInstitute
          ? (instituteTimeMode === 'CUSTOM' && customStartTime ? customStartTime : undefined)
          : (timeMode === 'CUSTOM' && customStartTime ? customStartTime : undefined),
        gender: overrides?.gender || instituteForm.gender,
        // Institute-specific
        collegeEmail: isInstitute ? (emailToUse || undefined) : undefined,
        collegeIdNumber: isInstitute ? (idToUse || undefined) : undefined,
        studentAge: overrides?.studentAge || instituteForm.studentAge,
        degreeProgram: overrides?.degreeProgram || instituteForm.degreeProgram,
        branchDepartment: overrides?.branchDepartment || instituteForm.branchDepartment,
        // Govt-specific
        govtName: isGovernment ? (govtName || undefined) : undefined,
        aadhaarLast4: isGovernment ? (govtAadhaar || undefined) : undefined,
        targetExam: isGovernment ? (overrides?.targetExam || govtForm.targetExam) : undefined,
      });

      if (data?.data?.bookingId) {
        navigate(`/booking/${data.data.bookingId}/confirmed`);
        return;
      }
      // If backend returned success=false with message or error, display it
      if (data && !data.success) {
        const errorMsg = data.error || data.message || 'Checkout failed';
        setCheckoutError(errorMsg);
        if (isInstitute && (errorMsg.toLowerCase().includes('domain') || errorMsg.toLowerCase().includes('email') || errorMsg.toLowerCase().includes('college'))) {
          setInstituteError(`⚠️ ${errorMsg}`);
          setShowInstituteModal(true);
        } else {
          alert(`⚠️ Booking Error: ${errorMsg}`);
        }
        return;
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Error completing checkout';
      console.error('Backend checkout error:', errMsg);
      setCheckoutError(errMsg);
      if (isInstitute && (errMsg.toLowerCase().includes('domain') || errMsg.toLowerCase().includes('email') || errMsg.toLowerCase().includes('college'))) {
        setInstituteError(`⚠️ ${errMsg}`);
        setShowInstituteModal(true);
      } else {
        alert(`⚠️ Booking Error: ${errMsg}`);
      }
    } finally {
      setCheckoutLoading(false);
    }

  }, [selectedSeat, seatLockToken, activeShift, library, id, navigate, govtForm, instituteForm, timeMode, customStartTime, customDurationMinutes, flexibleDurationMinutes, shifts]);


  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#070b14] text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-300">
      <Navbar />

      {/* Top Banner / Library title */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0b1120]/70 backdrop-blur-md sticky top-16 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Go Back"
            >
              ← Back
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  {library?.name || (loading ? 'Loading library details...' : 'IIT Bhilai Library')}
                </h1>
                {library?.isFree && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    100% Free Space
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {library?.locality ? `${library.locality}, ` : 'Kutelabhata, '}{library?.city || 'Bhilai'}
              </p>
            </div>
          </div>

          {seatLockToken && secondsLeft !== null && (
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 animate-pulse">
              ⏱ {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
            </div>
          )}
        </div>
      </div>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 flex flex-col gap-8">
        {/* ── STEP 1: LIBRARY DOSSIER, FACILITIES & CHOOSE SHIFT ── */}
        <section className="space-y-6">
          {/* Complete Library Dossier Card */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1220] p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-violet-600 dark:text-violet-400">
                  Verified Library Dossier
                </span>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  {library?.name || 'IIT Bhilai Library'}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  ((library?.library_category || library?.libraryCategory) ?? 'INSTITUTE').toUpperCase().includes('INSTITUTE')
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                    : ((library?.library_category || library?.libraryCategory) ?? '').toUpperCase().includes('GOV')
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                    : 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20'
                }`}>
                  {((library?.library_category || library?.libraryCategory) ?? 'INSTITUTE').toUpperCase().includes('INSTITUTE') ? '🏛️ INSTITUTE LIBRARY' : ((library?.library_category || library?.libraryCategory) ?? '').toUpperCase().includes('GOV') ? '🏛️ GOVERNMENT PUBLIC' : '🏢 PRIVATE SPACE'}
                </span>
                {library?.isFree && (
                  <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    100% FREE
                  </span>
                )}
              </div>
            </div>

            {/* Address & POC Contact Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#12192e] border border-slate-100 dark:border-slate-800/80 space-y-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase mb-0.5">📍 Full Address</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {library?.address || 'IIT Bhilai Campus, Kutelabhata, Durg-Bhilai, Chhattisgarh 491001'}
                  </p>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(library?.address || library?.name || 'IIT Bhilai')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-extrabold text-[11px] transition border border-indigo-500/20 cursor-pointer"
                >
                  🗺️ Open in Google Maps →
                </a>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#12192e] border border-slate-100 dark:border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-400 block uppercase mb-0.5">📞 Official POC Contact</span>
                <p className="font-bold font-mono text-indigo-600 dark:text-indigo-400 text-sm">
                  {library?.contact_number || '+91 771 255 1234'}
                </p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">{library?.email || 'library@iitbhilai.ac.in'}</p>
              </div>
            </div>

            {/* Facilities & Amenities Badges */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase mb-2">⚡ Available Facilities & Safety</span>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-medium">
                  📶 High-Speed WiFi
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-medium">
                  ❄️ Centralized AC
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-medium">
                  📹 24/7 CCTV Security
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-medium">
                  ⚡ Power Backup / UPS
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-medium">
                  🚰 RO Purified Water
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-medium">
                  📰 Daily Newspapers
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 font-bold border border-pink-500/20">
                  🩷 Girls Safety Wing
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
                  🛋️ Sofa Lounge Desks
                </span>
              </div>
            </div>

            {/* Quick Visitor Pass Request Card */}
            <div className="p-4 rounded-2xl bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-900/40 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-violet-900 dark:text-violet-200 flex items-center gap-1.5">
                  <span>🎟️</span>
                  <span>Need a Quick 40-Min Visit? (Book Issue / Return / Enquiry)</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Don't need a full study desk? Request an instant 40-minute Circulation Visitor Pass to visit the library counter.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowVisitorModal(true)}
                className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-md shadow-violet-600/20 transition cursor-pointer flex items-center gap-1.5"
              >
                <span>🎟️</span>
                <span>Request Visitor Pass</span>
              </button>
            </div>

            {/* Student Grievance & Feedback Corner Card */}
            <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  <span>📢</span>
                  <span>Student Grievance &amp; Feedback Desk</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Experiencing issues with AC, Wi-Fi speed, cleanliness, or noise? Report to library warden directly.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowComplaintModal(true)}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition cursor-pointer"
              >
                + Report Issue / File Complaint
              </button>
            </div>

            {/* Display Filed Complaints if Any */}
            {studentComplaints.length > 0 && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1">
                  Your Active &amp; Recent Complaints ({studentComplaints.length})
                </span>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {studentComplaints.map((c: any) => (
                    <div key={c.id} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{c.ticket_code}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.status === 'RESOLVED'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        }`}>
                          {c.status}
                        </span>
                      </div>
                      <p className="text-slate-800 dark:text-slate-200 font-medium">{c.description}</p>
                      {c.owner_resolution_notes && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-2 rounded-lg font-semibold">
                          📌 Warden Reply: {c.owner_resolution_notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-white mb-3">
              STEP 1: CHOOSE VISIT TIME & DURATION
            </h2>

            {/* ── INSTITUTE LIBRARIES: DURATION-FIRST & FIXED SHIFT MODEL ── */}
            {library?.libraryCategory === 'INSTITUTE' ? (
              <div className="space-y-4 mb-6">
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setInstituteTimeMode('SHIFT')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      instituteTimeMode === 'SHIFT'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                        : 'bg-white dark:bg-[#0c1220] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-400'
                    }`}
                  >
                    📅 Institute Fixed Shifts
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstituteTimeMode('PRESET')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      instituteTimeMode !== 'SHIFT'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                        : 'bg-white dark:bg-[#0c1220] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-400'
                    }`}
                  >
                    ⏱ Duration / Custom Slot
                  </button>
                </div>

                {instituteTimeMode === 'SHIFT' ? (
                  /* Fixed Shifts Grid for Institute */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {shifts.map((shift) => {
                      const isSelected = activeShift?.id === shift.id;
                      return (
                        <div
                          key={shift.id}
                          onClick={() => {
                            setActiveShift(shift);
                            fetchSeats(shift.id);
                            setSelectedSeat(null);
                          }}
                          className={`relative rounded-2xl p-4 cursor-pointer transition-all duration-200 border ${
                            isSelected
                              ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-[#12192e] ring-2 ring-indigo-500/40 shadow-md shadow-indigo-500/10'
                              : 'border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0c1220] hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                {shift.shift_name}
                              </h3>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                              </p>
                            </div>
                          </div>

                          <div className="border-t border-slate-200/80 dark:border-slate-800 my-3"></div>

                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold ${
                              (shiftFreeSeats[shift.id] ?? shift.freeCount) > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-500 dark:text-rose-400'
                            }`}>
                              {shiftFreeSeats[shift.id] !== undefined
                                ? `${shiftFreeSeats[shift.id]} available`
                                : shift.freeCount !== undefined
                                  ? `${shift.freeCount} free`
                                  : '...'}
                            </span>
                            <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                              100% Free
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Duration Relative Cards & Custom Time Slider */
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div>
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-extrabold text-[10px] uppercase tracking-wider">
                          Institute Duration Model
                        </span>
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm mt-1">
                          Choose Study Session Duration (Starts Now)
                        </h3>
                      </div>
                      <span className="text-xs font-mono font-extrabold text-indigo-600 dark:text-indigo-400">
                        {instituteTimeMode === 'CUSTOM'
                          ? `Custom (${customStartTime || 'Now'} · ${Math.floor(flexibleDurationMinutes / 60)}h${flexibleDurationMinutes % 60 > 0 ? ` ${flexibleDurationMinutes % 60}m` : ''})`
                          : `${Math.floor(flexibleDurationMinutes / 60)}h ${flexibleDurationMinutes % 60 > 0 ? `${flexibleDurationMinutes % 60}m` : ''} (${flexibleDurationMinutes} mins)`}
                      </span>
                    </div>

                    {/* 5 Duration-Relative Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                      {[
                        { id: '30m', title: '30 min', subtitle: 'Quick Study Gap', duration: 30, icon: '⚡' },
                        { id: '1h', title: '1 hour', subtitle: 'Between Classes', duration: 60, icon: '📖' },
                        { id: '2h', title: '2 hours', subtitle: 'Standard Study', duration: 120, icon: '🎯' },
                        { id: '3h', title: '3 hours', subtitle: 'Extended Block', duration: 180, icon: '📚' },
                        { id: 'custom', title: 'Custom Slot', subtitle: 'Pick Start & Duration', duration: 0, isCustom: true, icon: '⏱' },
                      ].map((preset) => {
                        const isCardSelected = preset.isCustom
                          ? instituteTimeMode === 'CUSTOM'
                          : (instituteTimeMode === 'PRESET' && flexibleDurationMinutes === preset.duration);

                        const availCount = seats.filter(s => s.status === 'AVAILABLE').length;

                        return (
                          <div
                            key={preset.id}
                            onClick={() => {
                              if (preset.isCustom) {
                                setInstituteTimeMode('CUSTOM');
                                if (!customStartTime) {
                                  const now = new Date();
                                  const hh = String(now.getHours()).padStart(2, '0');
                                  const mm = String(now.getMinutes()).padStart(2, '0');
                                  setCustomStartTime(`${hh}:${mm}`);
                                }
                              } else {
                                setInstituteTimeMode('PRESET');
                                setFlexibleDurationMinutes(preset.duration);
                              }
                            }}
                            className={`relative rounded-2xl p-4 cursor-pointer transition-all duration-200 border ${
                              isCardSelected
                                ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-[#12192e] ring-2 ring-indigo-500/40 shadow-md shadow-indigo-500/10'
                                : 'border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0c1220] hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span>{preset.icon}</span> {preset.title}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  {preset.subtitle}
                                </p>
                              </div>
                            </div>

                            <div className="border-t border-slate-200/80 dark:border-slate-800 my-3"></div>

                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-bold ${
                                availCount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                              }`}>
                                {preset.isCustom ? 'Flexible' : (availCount > 0 ? `${availCount} free` : '0 free')}
                              </span>
                              <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                100% Free
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Custom Time Slot Expandable Controls for Institute */}
                    {instituteTimeMode === 'CUSTOM' && (
                      <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-[#0e1628] border border-indigo-200 dark:border-indigo-800/60 space-y-4 mt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-extrabold text-indigo-700 dark:text-indigo-300">
                            Custom Start Time & Session Duration
                          </span>
                          <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {customStartTime || 'Now'} · {Math.floor(flexibleDurationMinutes / 60)}h{flexibleDurationMinutes % 60 > 0 ? ` ${flexibleDurationMinutes % 60}m` : ''}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Start Time</label>
                            <input
                              type="time"
                              value={customStartTime}
                              onChange={e => setCustomStartTime(e.target.value)}
                              className="w-full bg-white dark:bg-[#151530] border border-indigo-200 dark:border-indigo-700 rounded-xl px-3 py-2 text-sm font-mono text-slate-800 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Duration Slider</label>
                            <input
                              type="range"
                              min="30"
                              max="300"
                              step="30"
                              value={flexibleDurationMinutes}
                              onChange={(e) => setFlexibleDurationMinutes(Number(e.target.value))}
                              className="w-full accent-indigo-600 cursor-pointer mt-2"
                            />
                            <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                              <span>30 mins</span>
                              <span>2.5 hrs</span>
                              <span>5 hrs (Max Cap)</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── RECOMMENDATION & SMART NUDGE (MODULE 28 & 29 INTEGRATION) ── */}
                {seats.filter(s => s.status === 'AVAILABLE').length === 0 && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-900/40 via-indigo-900/40 to-slate-900/60 border border-violet-500/30 text-white space-y-3 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">⏰</span>
                      <div>
                        <h4 className="font-bold text-sm text-white">
                          No seats free for {flexibleDurationMinutes} mins right now
                        </h4>
                        <p className="text-xs text-slate-300 mt-0.5">
                          3 seats open up in 15 minutes as ongoing student sessions expire (Module 28 Opening Soon).
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={handleJoinSeatQueue}
                        disabled={queueJoining}
                        className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition shadow-md shadow-violet-500/20 flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>🔔</span> {queueJoining ? 'Joining Queue...' : 'Wait & Get Notified (Join Seat Queue)'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setInstituteTimeMode('PRESET');
                          setFlexibleDurationMinutes(30);
                        }}
                        className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>⚡</span> Book a 30-min slot instead
                      </button>
                    </div>
                    {queueStatusMsg && (
                      <p className="text-xs font-bold text-emerald-400 mt-2 bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-800/60">
                        {queueStatusMsg}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* ── GOVERNMENT / PRIVATE LIBRARIES: FIXED DAYPART SHIFTS & CUSTOM TIME ── */
              <div className="space-y-4 mb-6">
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setTimeMode('SHIFT')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      timeMode === 'SHIFT'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                        : 'bg-white dark:bg-[#0c1220] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-400'
                    }`}
                  >
                    📅 Use Fixed Shift
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTimeMode('CUSTOM');
                      if (!customStartTime) {
                        const now = new Date();
                        const hh = String(now.getHours()).padStart(2, '0');
                        const mm = String(now.getMinutes()).padStart(2, '0');
                        setCustomStartTime(`${hh}:${mm}`);
                      }
                    }}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      timeMode === 'CUSTOM'
                        ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-500/20'
                        : 'bg-white dark:bg-[#0c1220] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-violet-400'
                    }`}
                  >
                    ⏱ Custom Time Slot
                  </button>
                </div>

                {timeMode === 'CUSTOM' && (
                  <div className="p-4 rounded-2xl bg-violet-50/60 dark:bg-[#0e0e28] border border-violet-200 dark:border-violet-800/50 space-y-3 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-extrabold text-violet-700 dark:text-violet-300">Custom Study Session</span>
                      <span className="text-xs font-mono font-bold text-violet-600 dark:text-violet-400">
                        {customStartTime} · {Math.floor(customDurationMinutes / 60)}h{customDurationMinutes % 60 > 0 ? ` ${customDurationMinutes % 60}m` : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Start Time</label>
                        <input
                          type="time"
                          value={customStartTime}
                          onChange={e => setCustomStartTime(e.target.value)}
                          className="w-full bg-white dark:bg-[#151530] border border-violet-200 dark:border-violet-700 rounded-xl px-3 py-2 text-sm font-mono text-slate-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Duration</label>
                        <select
                          value={customDurationMinutes}
                          onChange={e => setCustomDurationMinutes(Number(e.target.value))}
                          className="w-full bg-white dark:bg-[#151530] border border-violet-200 dark:border-violet-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 dark:text-white"
                        >
                          {[30, 60, 90, 120, 180, 240, 300].map(m => (
                            <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60}h${m % 60 > 0 ? ` ${m % 60}m` : ''}`}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400">ℹ️ Your booking will start at the chosen time and last for the selected duration.</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {shifts.map((shift) => {
                    const isSelected = activeShift?.id === shift.id;
                    return (
                      <div
                        key={shift.id}
                        onClick={() => {
                          setActiveShift(shift);
                          fetchSeats(shift.id);
                          setSelectedSeat(null);
                        }}
                        className={`relative rounded-2xl p-4 cursor-pointer transition-all duration-200 border ${
                          isSelected
                            ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-[#12192e] ring-2 ring-indigo-500/40 shadow-md shadow-indigo-500/10'
                            : 'border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0c1220] hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                              {shift.shift_name}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                            </p>
                          </div>
                        </div>

                        <div className="border-t border-slate-200/80 dark:border-slate-800 my-3"></div>

                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold ${
                            (shiftFreeSeats[shift.id] ?? shift.freeCount) > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-500 dark:text-rose-400'
                          }`}>
                            {shiftFreeSeats[shift.id] !== undefined
                              ? `${shiftFreeSeats[shift.id]} available`
                              : shift.freeCount !== undefined
                                ? `${shift.freeCount} free`
                                : '...'}
                          </span>
                          <span className={`text-lg font-extrabold ${Number(shift.daily_price) === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-[#3b82f6]'}`}>
                            {Number(shift.daily_price) === 0 ? '100% Free' : `₹${shift.daily_price}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── STEP 2: CHOOSE PHYSICAL CABIN SEAT ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-white">
              STEP 2: CHOOSE PHYSICAL CABIN SEAT
            </h2>
            <span className="px-3 py-1 text-[11px] font-semibold rounded-full bg-slate-200/70 dark:bg-[#151e33] text-indigo-700 dark:text-indigo-400 border border-slate-300/60 dark:border-slate-700/60">
              {library?.seating_type === 'MIXED' ? 'Mixed Layout' : 'Study Layout'}
            </span>
          </div>

          <div className="rounded-3xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0a0f1d] p-6 sm:p-8 shadow-sm flex flex-col items-center">
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mb-6 select-none">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-600"></span> Selected
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-600"></span> Available
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-800 dark:bg-slate-900 border border-slate-700"></span> Occupied
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-pink-400"></span> Girls Only
              </span>
              <span className="flex items-center gap-1.5 font-medium">⚡ Socket</span>
            </div>

            {/* Front label */}
            <div className="text-center mb-3">
              <span className="text-slate-400 dark:text-slate-600 text-[10px] uppercase tracking-widest">— Front / Entrance —</span>
            </div>

            {/* Dynamic Seat Grid — rows/cols from owner's onboarding layout */}
            <div className="overflow-x-auto w-full">
              <div className="flex flex-col gap-2.5 min-w-max mx-auto">
                {Array.from(new Set(displayedSeats.map(s => s.row_idx)))
                  .sort((a, b) => a - b)
                  .map(rowIdx => {
                    const rowSeats = displayedSeats
                      .filter(s => s.row_idx === rowIdx)
                      .sort((a, b) => a.col_idx - b.col_idx);
                    return (
                      <div key={rowIdx} className="flex gap-2.5 justify-center">
                        {rowSeats.map((seat) => {
                          const isSelected = selectedSeat?.id === seat.id;
                          const seatIdx = displayedSeats.findIndex(s => s.id === seat.id);
                          const emergencyCount = Math.max(1, Math.round(displayedSeats.length * 0.04));
                          const isEmergencyQuota = (seatIdx >= 0 && seatIdx < emergencyCount) || (seat as any).is_emergency;
                          const isEmergencyUnlocked = (seat as any).is_emergency_unlocked || false;

                          const isUnavailable = (seat.status !== 'AVAILABLE' || (isEmergencyQuota && !isEmergencyUnlocked)) && !isSelected;
                          const isGirls = seat.is_girls_only;
                          const hasSocket = seat.has_power_socket;

                          let seatIcon = '💻';
                          if (seat.custom_type_icon) seatIcon = seat.custom_type_icon;
                          else if (seat.is_sofa || seat.seat_type === 'SOFA') seatIcon = '🛋️';
                          else if (seat.seat_type === 'RECLINER') seatIcon = '💺';
                          else if (seat.seat_type === 'WINDOW') seatIcon = '🪟';
                          else if (seat.seat_type === 'CABIN') seatIcon = '🖥️';

                          if (isSelected) {
                            return (
                              <button
                                key={seat.id}
                                onClick={() => setSelectedSeat(null)}
                                className="relative aspect-square w-12 rounded-xl bg-violet-600 border-2 border-violet-400 text-white font-extrabold text-xs flex flex-col items-center justify-center shadow-lg shadow-violet-500/30 scale-105 transition-transform"
                              >
                                <span>{seat.seatCode}</span>
                                <span className="text-[9px] leading-none opacity-90">{seatIcon}</span>
                                {hasSocket && <span className="absolute -top-1 -right-1 text-[9px] leading-none">⚡</span>}
                              </button>
                            );
                          }

                          if (isUnavailable) {
                            return (
                              <div
                                key={seat.id}
                                className="aspect-square w-12 rounded-xl bg-slate-100 dark:bg-[#0c1222] border border-slate-200/40 dark:border-slate-800/50 flex flex-col items-center justify-center text-xs font-bold text-slate-300 dark:text-slate-700 cursor-not-allowed select-none"
                              >
                                <span>{seat.seatCode}</span>
                              </div>
                            );
                          }

                          // Available seat — style by exact seat category
                          let seatBorder = 'border-slate-200 dark:border-slate-700';
                          let seatBg = 'bg-slate-50 dark:bg-[#121a2d]';
                          let seatTextCls = 'text-slate-700 dark:text-slate-200';
                          
                          if (isGirls) {
                            seatBorder = 'border-pink-400 dark:border-pink-500 ring-1 ring-pink-400/30';
                            seatBg = 'bg-pink-50 dark:bg-pink-950/30';
                            seatTextCls = 'text-pink-700 dark:text-pink-300';
                          } else if (seat.custom_type_name && seat.custom_type_name !== 'Standard') {
                            seatBorder = 'border-violet-400 dark:border-violet-500 ring-1 ring-violet-400/30';
                            seatBg = 'bg-violet-50 dark:bg-violet-950/30';
                            seatTextCls = 'text-violet-700 dark:text-violet-300';
                          } else if (seat.is_sofa || seat.seat_type === 'SOFA') {
                            seatBorder = 'border-amber-400 dark:border-amber-500 ring-1 ring-amber-400/30';
                            seatBg = 'bg-amber-50 dark:bg-amber-950/30';
                            seatTextCls = 'text-amber-700 dark:text-amber-300';
                          }

                          return (
                            <button
                              key={seat.id}
                              onClick={() => handleSeatSelect(seat)}
                              className={`relative aspect-square w-12 rounded-xl ${seatBg} border-2 ${seatBorder} ${seatTextCls} hover:border-violet-500 dark:hover:border-violet-400 font-bold text-xs flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95`}
                            >
                              <span>{seat.seatCode}</span>
                              <span className="text-[9px] leading-none opacity-80">{seatIcon}</span>
                              {hasSocket && <span className="absolute -top-1 -right-1 text-[9px] leading-none">⚡</span>}
                              {isGirls && <span className="absolute -bottom-1 -right-1 text-[9px] leading-none">🩷</span>}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}

                {displayedSeats.length === 0 && (
                  <div className="py-10 text-center text-slate-400 dark:text-slate-600">
                    <p className="text-sm font-semibold">Loading seat layout...</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Interactive Seat Details & Specs Card ── */}
            {selectedSeat && (
              <div className="w-full mt-6 p-4 rounded-2xl bg-indigo-50/80 dark:bg-[#12192e] border border-indigo-200 dark:border-indigo-800/60 text-xs space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="flex items-center justify-between border-b border-indigo-200/60 dark:border-indigo-800/40 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-indigo-700 dark:text-indigo-300">
                      🪑 Desk {selectedSeat.seatCode}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30">
                      {selectedSeat.custom_type_icon || (selectedSeat.is_sofa ? '🛋️' : selectedSeat.is_girls_only ? '🩷' : '💻')} {selectedSeat.custom_type_name || (selectedSeat.is_sofa ? 'Sofa Seating' : selectedSeat.is_girls_only ? 'Girls Reserved' : 'Standard Study Desk')}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedSeat(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold"
                  >
                    ✕
                  </button>
                </div>

                {(() => {
                  const slotInfo = getSelectedSlotInfo();
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-700 dark:text-slate-300">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">{slotInfo.slotLabel}</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{slotInfo.slotName}</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Slot Timing</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{slotInfo.timing}</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Slot Price</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {slotInfo.price}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Socket & Comfort</span>
                        <span className="font-semibold">{selectedSeat.has_power_socket !== false ? '⚡ Dedicated Socket' : 'No Socket'}</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex flex-wrap gap-2 pt-1 border-t border-indigo-200/40 dark:border-indigo-800/30 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>❄️ AC Distance: <strong>{selectedSeat.dist_to_ac_m || 2.5}m</strong></span>
                  <span>•</span>
                  <span>🚪 Exit Distance: <strong>{selectedSeat.dist_to_door_m || 4.0}m</strong></span>
                  <span>•</span>
                  <span>🛡️ Section: <strong>{selectedSeat.is_girls_only ? '♀ Girls Only Reserved' : 'General Admission'}</strong></span>
                </div>
              </div>
            )}
          </div>
        </section>


        {/* ── STEP 3: CONFIRM CTA ── */}
        <section className="pt-2">
          {checkoutError && (
            <div className="mb-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
              {checkoutError}
            </div>
          )}

          {(() => {
            const slotInfo = getSelectedSlotInfo();
            return (
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className={`w-full py-4 px-6 rounded-2xl text-white font-extrabold text-base transition-all shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                  slotInfo.isFree
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/30'
                    : 'bg-[#00a86b] hover:bg-[#00925c] shadow-emerald-500/25'
                }`}
              >
                {checkoutLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Reserving Desk...
                  </>
                ) : selectedSeat ? (
                  slotInfo.isFree ? (
                    `⚡ Confirm Free Seat Booking (Seat ${selectedSeat.seatCode} · ${slotInfo.timingShort} · 100% Free)`
                  ) : (
                    `Confirm Direct Reservation & Pass (Seat ${selectedSeat.seatCode} · ${slotInfo.price} · ${slotInfo.timingShort})`
                  )
                ) : (
                  slotInfo.isFree ? (
                    `Confirm Free Seat Booking (${slotInfo.timingShort} · 100% Free)`
                  ) : (
                    `Confirm Direct Reservation & Pass (${slotInfo.price})`
                  )
                )}
              </button>
            );
          })()}

          <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-3">
            {getSelectedSlotInfo().isFree
              ? 'Instant Confirmed Free Digital Pass · No Payment Required · Zero Hidden Charges'
              : 'Secure Desk Reservation · DPDP Identity Verification Included'}
          </p>
        </section>
      </main>

      {/* ── IN-MODAL GUEST HANDSHAKE AUTHENTICATION MODAL ── */}
      {showGuestModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0c1120] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setShowGuestModal(false);
                setGuestStep('EMAIL');
                setGuestError(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg font-bold"
            >
              ✕
            </button>

            {guestStep === 'EMAIL' && (
              <>
                <div className="text-center mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                    ✉️
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    Enter Your Email to Continue
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    We'll check if you have an account or guide you through quick instant booking setup.
                  </p>
                </div>

                <form onSubmit={handleGuestEmailCheck} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={guestEmail}
                      onChange={e => setGuestEmail(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      placeholder="student@example.com"
                    />
                  </div>

                  {guestError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
                      {guestError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={guestChecking}
                    className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm shadow-lg shadow-indigo-600/25 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {guestChecking ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Checking Email...
                      </>
                    ) : (
                      'Continue to Booking →'
                    )}
                  </button>
                </form>
              </>
            )}

            {guestStep === 'LOGIN' && (
              <>
                <div className="text-center mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                    🔑
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    Welcome Back!
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    An account exists for <span className="font-bold text-indigo-500 font-mono">{guestEmail}</span>. Enter your password to sign in &amp; complete your seat booking.
                  </p>
                </div>

                <form onSubmit={handleGuestLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      value={guestPassword}
                      onChange={e => setGuestPassword(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="••••••••"
                    />
                  </div>

                  {guestError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
                      {guestError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={guestChecking}
                    className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-lg shadow-emerald-600/25 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {guestChecking ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Signing In...
                      </>
                    ) : (
                      'Sign In & Confirm Seat Booking →'
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setGuestStep('EMAIL')}
                    className="w-full text-center text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold"
                  >
                    ← Change Email Address
                  </button>
                </form>
              </>
            )}

            {guestStep === 'SIGNUP' && (
              <>
                <div className="text-center mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-2 text-xl font-bold">
                    🎓
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    Quick Account Setup
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Create a password to set up your student account for <span className="font-bold text-indigo-500 font-mono">{guestEmail}</span>.
                  </p>
                </div>

                <form onSubmit={handleGuestSignupSubmit} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={guestFullName}
                      onChange={e => setGuestFullName(e.target.value)}
                      placeholder="e.g. Aaditya Jha"
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-sm font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Gender *
                      </label>
                      <select
                        value={guestGender}
                        onChange={e => setGuestGender(e.target.value as any)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white font-bold"
                      >
                        <option value="FEMALE">Female ♀</option>
                        <option value="MALE">Male ♂</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={guestPhone}
                        onChange={e => setGuestPhone(e.target.value)}
                        placeholder="9876543210"
                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-sm font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Create Password *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={guestPassword}
                      onChange={e => setGuestPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-sm"
                    />
                  </div>

                  {guestError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
                      {guestError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={guestChecking}
                    className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm shadow-lg shadow-indigo-600/25 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {guestChecking ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      'Create Account & Confirm Booking →'
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setGuestStep('EMAIL')}
                    className="w-full text-center text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold"
                  >
                    ← Change Email Address
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── INSTITUTE COLLEGE STUDENT VERIFICATION MODAL ── */}
      {showInstituteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0c1120] border border-emerald-500/30 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative">
            <button
              onClick={() => setShowInstituteModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg font-bold"
            >
              ✕
            </button>

            {/* ── STEP 0: RETURNING VERIFIED STUDENT 1-CLICK POPUP CONFIRMATION ── */}
            {instituteModalStep === 'CONFIRM_RETURNING' && (
              <div className="space-y-5">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                    ✓
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 uppercase tracking-widest">
                    ✓ Verified Returning Student Profile
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mt-2">
                    Confirm Seat Reservation
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Your college identity is already verified for <strong className="text-slate-800 dark:text-slate-200">{library?.name || 'this library'}</strong>.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-800">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">College Student ID</span>
                    <strong className="font-mono text-slate-900 dark:text-white font-bold">{instituteForm.collegeIdNumber || savedProfile?.institute_id_number}</strong>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-800">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Institute Email</span>
                    <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{instituteForm.collegeEmail || savedProfile?.institute_email}</strong>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-800">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Gender</span>
                    <strong className="text-slate-900 dark:text-white font-bold">{instituteForm.gender || savedProfile?.gender || 'FEMALE'}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Branch / Department</span>
                    <strong className="text-slate-900 dark:text-white font-bold">{instituteForm.branchDepartment || savedProfile?.branch || 'N/A'}</strong>
                  </div>
                </div>

                {instituteError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-semibold">
                    {instituteError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowInstituteModal(false);
                    handleCheckout(instituteForm);
                  }}
                  className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/25 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  ✓ Confirm &amp; Reserve Desk
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setInstituteModalStep('LOOKUP')}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold"
                  >
                    Change ID / Use a different College Identity →
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 1: INITIAL ID LOOKUP INPUT ── */}
            {instituteModalStep === 'LOOKUP' && (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                    🎓
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    College Student ID Lookup
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Enter your official college/institute student ID to check your roster status.
                  </p>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleIdLookup();
                  }}
                  className="space-y-4 text-xs"
                >
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      College Student ID Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={lookupIdInput}
                      onChange={e => setLookupIdInput(e.target.value)}
                      placeholder="e.g. 2024CS1049"
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {instituteError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-semibold">
                      {instituteError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={idLookupLoading}
                    className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm shadow-lg shadow-indigo-600/25 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {idLookupLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Checking Roster...
                      </>
                    ) : (
                      'Lookup Student ID →'
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* ── STEP 2 CASE A: ID LISTED ON ROSTER ── */}
            {instituteModalStep === 'CASE_A' && (
              <div className="space-y-4">
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-extrabold">
                    <span>✓</span>
                    <span>ID Found on Institute Roster!</span>
                  </div>
                  {rosterInfo?.studentName && (
                    <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Roster Name: <strong>{rosterInfo.studentName}</strong> (ID: {instituteForm.collegeIdNumber})
                    </p>
                  )}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setInstituteError(null);
                    const allowed = library?.allowedEmailDomain || library?.allowed_email_domain;
                    if (allowed) {
                      const cleanAllowed = allowed.replace('@', '').toLowerCase().trim();
                      const domain = instituteForm.collegeEmail.substring(instituteForm.collegeEmail.indexOf('@') + 1).toLowerCase().trim();
                      if (domain !== cleanAllowed && !domain.endsWith('.' + cleanAllowed)) {
                        setInstituteError(`⚠️ Email domain mismatch! This college library requires a valid @${cleanAllowed} email address.`);
                        return;
                      }
                    }
                    setShowInstituteModal(false);
                    handleCheckout(instituteForm);
                  }}
                  className="space-y-4 text-xs"
                >
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      College / Institute Email ID *
                    </label>
                    <input
                      type="email"
                      required
                      value={instituteForm.collegeEmail}
                      onChange={e => setInstituteForm({ ...instituteForm, collegeEmail: e.target.value })}
                      placeholder={library?.allowedEmailDomain ? `student@${library.allowedEmailDomain}` : 'student@college.ac.in'}
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Gender * (Required for Girls Safety Reserved Desks)
                    </label>
                    <select
                      value={instituteForm.gender}
                      onChange={e => setInstituteForm({ ...instituteForm, gender: e.target.value as any })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white font-bold text-sm"
                    >
                      <option value="FEMALE">Female (♀) - Eligible for Girls-Only Seats</option>
                      <option value="MALE">Male (♂)</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  {instituteError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-semibold">
                      {instituteError}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer"
                  >
                    Verify &amp; Confirm Desk →
                  </button>

                  <button
                    type="button"
                    onClick={() => setInstituteModalStep('LOOKUP')}
                    className="w-full text-center text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold"
                  >
                    ← Check Different ID Number
                  </button>
                </form>
              </div>
            )}

            {/* ── STEP 2 CASE B: ID NOT LISTED ON ROSTER ── */}
            {instituteModalStep === 'CASE_B' && (
              <div className="space-y-4">
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-extrabold">
                    <span>⚠️</span>
                    <span>Notice: ID Not Pre-listed on Institute Roster</span>
                  </div>
                  <p className="text-[11px]">
                    ID <strong>{instituteForm.collegeIdNumber}</strong> is not listed yet. Please enter your complete student details below to create and link your profile.
                  </p>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setInstituteError(null);
                    const allowed = library?.allowedEmailDomain || library?.allowed_email_domain;
                    if (allowed) {
                      const cleanAllowed = allowed.replace('@', '').toLowerCase().trim();
                      const domain = instituteForm.collegeEmail.substring(instituteForm.collegeEmail.indexOf('@') + 1).toLowerCase().trim();
                      if (domain !== cleanAllowed && !domain.endsWith('.' + cleanAllowed)) {
                        setInstituteError(`⚠️ Email domain mismatch! This college library requires a valid @${cleanAllowed} email address.`);
                        return;
                      }
                    }
                    setShowInstituteModal(false);
                    handleCheckout(instituteForm);
                  }}
                  className="space-y-3.5 text-xs"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={instituteForm.fullName}
                        onChange={e => setInstituteForm({ ...instituteForm, fullName: e.target.value })}
                        placeholder="e.g. Rahul Sharma"
                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-sm font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Mobile Phone Number *
                      </label>
                      <input
                        type="tel"
                        required
                        value={instituteForm.phone}
                        onChange={e => setInstituteForm({ ...instituteForm, phone: e.target.value })}
                        placeholder="9876543210"
                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      College / Institute Email ID *
                    </label>
                    <input
                      type="email"
                      required
                      value={instituteForm.collegeEmail}
                      onChange={e => setInstituteForm({ ...instituteForm, collegeEmail: e.target.value })}
                      placeholder={library?.allowedEmailDomain ? `student@${library.allowedEmailDomain}` : 'student@college.ac.in'}
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        College Student ID Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={instituteForm.collegeIdNumber}
                        onChange={e => setInstituteForm({ ...instituteForm, collegeIdNumber: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-bold text-sm"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Gender *
                      </label>
                      <select
                        value={instituteForm.gender}
                        onChange={e => setInstituteForm({ ...instituteForm, gender: e.target.value as any })}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white font-bold text-sm"
                      >
                        <option value="FEMALE">Female (♀)</option>
                        <option value="MALE">Male (♂)</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                  </div>

                  {instituteError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-semibold">
                      {instituteError}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-600/25 transition cursor-pointer"
                  >
                    Register Identity &amp; Confirm Desk →
                  </button>

                  <button
                    type="button"
                    onClick={() => setInstituteModalStep('LOOKUP')}
                    className="w-full text-center text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold"
                  >
                    ← Check Different ID Number
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── GOVERNMENT LIBRARY STUDENT IDENTITY MODAL ── */}
      {showGovtModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0c1120] border border-amber-500/30 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowGovtModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg font-bold"
            >
              ✕
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3 text-2xl">
                🏛️
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Government Library — Student Identity
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Government public libraries require basic identity verification. Your info is saved for future bookings.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setGovtError(null);
                if (!govtForm.fullName.trim() || !govtForm.aadhaarLast4.trim()) {
                  setGovtError('Name and Aadhaar last 4 digits are required.');
                  return;
                }
                if (govtForm.aadhaarLast4.trim().length !== 4 || !/^\d{4}$/.test(govtForm.aadhaarLast4.trim())) {
                  setGovtError('Please enter exactly the last 4 digits of your Aadhaar card.');
                  return;
                }
                setShowGovtModal(false);
                handleCheckout(govtForm);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name (as on Aadhaar) *
                </label>
                <input
                  type="text"
                  required
                  value={govtForm.fullName}
                  onChange={e => setGovtForm({ ...govtForm, fullName: e.target.value })}
                  placeholder="e.g. Ramesh Kumar Sharma"
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Aadhaar Last 4 Digits *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    pattern="\d{4}"
                    value={govtForm.aadhaarLast4}
                    onChange={e => setGovtForm({ ...govtForm, aadhaarLast4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    placeholder="XXXX"
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white font-mono text-base text-center tracking-widest"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Your City
                  </label>
                  <input
                    type="text"
                    value={govtForm.city}
                    onChange={e => setGovtForm({ ...govtForm, city: e.target.value })}
                    placeholder="e.g. Indore"
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Exam Preparing For
                </label>
                <select
                  value={govtForm.targetExam}
                  onChange={e => setGovtForm({ ...govtForm, targetExam: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white font-bold"
                >
                  {['UPSC', 'SSC CGL', 'SSC CHSL', 'Banking (IBPS/SBI)', 'Railways (RRB)', 'State PSC', 'MPSC', 'RPSC', 'JPSC', 'Defence (NDA/CDS)', 'NET/JRF', 'GATE', 'CAT/MBA', 'Other'].map(exam => (
                    <option key={exam} value={exam}>{exam}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Voter ID Number (optional)
                </label>
                <input
                  type="text"
                  value={govtForm.voterIdNumber}
                  onChange={e => setGovtForm({ ...govtForm, voterIdNumber: e.target.value.toUpperCase() })}
                  placeholder="e.g. MH/01/234/012345"
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white font-mono text-sm"
                />
              </div>

              {govtError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-semibold">
                  {govtError}
                </div>
              )}

              <p className="text-[10px] text-slate-400 text-center">
                🔒 Only the last 4 Aadhaar digits are collected. No full ID number stored. Data used only for government library access records.
              </p>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer"
              >
                Confirm &amp; Continue to Booking →
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── STUDENT GRIEVANCE & COMPLAINT MODAL ── */}
      {showComplaintModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0c1120] border border-indigo-500/30 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setShowComplaintModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg font-bold"
            >
              ✕
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                📢
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                File a Complaint / Report Facility Issue
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Your report will be sent directly to the library warden &amp; management dashboard.
              </p>
            </div>

            <form onSubmit={handleSubmitComplaint} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  1. Issue Category *
                </label>
                <select
                  value={complaintCategory}
                  onChange={e => setComplaintCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white font-bold"
                >
                  <option value="AC_COOLING">❄️ AC &amp; Temperature Control</option>
                  <option value="WIFI_INTERNET">📶 Wi-Fi &amp; Internet Speed</option>
                  <option value="CLEANLINESS">🧹 Cleanliness &amp; Hygiene</option>
                  <option value="NOISE_DISTURBANCE">🤫 Noise &amp; Disturbances</option>
                  <option value="FACILITIES">⚡ Power Sockets &amp; Facilities</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  2. Priority Level *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setComplaintPriority('LOW')}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      complaintPriority === 'LOW'
                        ? 'bg-slate-200 dark:bg-slate-800 border-slate-400 text-slate-800 dark:text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    Low
                  </button>
                  <button
                    type="button"
                    onClick={() => setComplaintPriority('NORMAL')}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      complaintPriority === 'NORMAL'
                        ? 'bg-amber-500/15 border-amber-500 text-amber-600'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => setComplaintPriority('HIGH')}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      complaintPriority === 'HIGH'
                        ? 'bg-rose-500/15 border-rose-500 text-rose-600'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    🔥 High / Urgent
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  3. Detailed Description of Issue *
                </label>
                <textarea
                  required
                  rows={3}
                  value={complaintDescription}
                  onChange={e => setComplaintDescription(e.target.value)}
                  placeholder="e.g. AC near Desk A3 is blowing hot air or Wi-Fi speed dropping below 2Mbps..."
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Anonymous Submission Checkbox */}
              <label className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={complaintIsAnonymous}
                  onChange={e => setComplaintIsAnonymous(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                />
                <div>
                  <span className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                    🎭 Submit Anonymously
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-normal leading-tight mt-0.5">
                    Hide your identity &amp; name from library owner/warden while reporting facility issues.
                  </span>
                </div>
              </label>

              {complaintMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold border ${
                  complaintMsg.includes('submitted')
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                }`}>
                  {complaintMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={complaintSubmitting}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/20 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {complaintSubmitting ? 'Submitting Report...' : '📢 Submit Complaint Ticket →'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: EMERGENCY VIP GUEST SEAT ALLOCATION ── */}
      {showEmergencyGuestModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-amber-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500 text-slate-950">
                  ⚡ Emergency Seat Allocation
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white font-headers mt-1">
                  Reserve Seat {emergencyGuestSeat?.seatCode} as Emergency Guest
                </h3>
              </div>
              <button
                onClick={() => setShowEmergencyGuestModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEmergencyGuestSubmit} className="space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
                Notice: For Emergency Seats, enter Person Name &amp; Official Designation (No Student ID or Aadhaar required).
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Person Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={emergencyGuestName}
                  onChange={e => setEmergencyGuestName(e.target.value)}
                  placeholder="e.g. Dr. Rajesh Sharma"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Official Designation / Role *
                </label>
                <input
                  type="text"
                  required
                  value={emergencyGuestDesignation}
                  onChange={e => setEmergencyGuestDesignation(e.target.value)}
                  placeholder="e.g. Visiting Professor / Guest Speaker / VIP Inspector"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmergencyGuestModal(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold shadow-md transition cursor-pointer"
                >
                  Confirm Emergency Seat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: 40-MIN VISITOR PASS / CIRCULATION VISIT ── */}
      {showVisitorModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-violet-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-violet-600 text-white">
                  🎟️ 40-Min Visitor Pass
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white font-headers mt-1">
                  Request Visit to {library?.name || 'Library'}
                </h3>
              </div>
              <button
                onClick={() => setShowVisitorModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-800 dark:text-violet-300 text-[11px] leading-relaxed">
              ⏱️ <strong>40-Minute Circulation Visit:</strong> This allows you to enter the library front desk for physical book issue, return, enquiry, or document collection without booking a full study desk.
            </div>

            {visitorPassResult ? (
              <div className="space-y-4 text-center py-2">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-3xl mx-auto border border-emerald-500/20">
                  🎉
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Visitor Pass Requested!
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {visitorPassResult.message || 'Awaiting owner/warden approval at the desk.'}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-left space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className="font-bold text-amber-500 uppercase">{visitorPassResult.status || 'PENDING_APPROVAL'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Duration:</span>
                    <span className="font-bold text-violet-500">{visitorPassResult.timeLimitMinutes || 40} Minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Purpose:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{visitorPassResult.purpose || visitorPurpose}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowVisitorModal(false);
                      setVisitorPassResult(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/student/dashboard?tab=passes')}
                    className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-xs shadow-md transition cursor-pointer"
                  >
                    View in Dashboard →
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Select Purpose of Visit *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'CIRCULATION', label: '📖 Book Issue / Return' },
                      { id: 'ENQUIRY_INSPECTION', label: '🔍 Facility Enquiry' },
                      { id: 'DOCUMENT_SUBMISSION', label: '📄 Document Drop' },
                      { id: 'GENERAL_VISIT', label: '👥 Meet Staff / Visit' },
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setVisitorPurpose(p.id)}
                        className={`p-2.5 rounded-xl border text-left font-bold transition text-xs ${
                          visitorPurpose === p.id
                            ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-violet-400'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Notes / Query (Optional)
                  </label>
                  <input
                    type="text"
                    value={visitorNotes}
                    onChange={(e) => setVisitorNotes(e.target.value)}
                    placeholder="e.g. Want to return Java book #BK-102"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                <div className="flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowVisitorModal(false)}
                    className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={visitorLoading}
                    onClick={handleBookVisitorPass}
                    className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold shadow-md transition disabled:opacity-50 cursor-pointer"
                  >
                    {visitorLoading ? 'Submitting...' : 'Submit Request →'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
