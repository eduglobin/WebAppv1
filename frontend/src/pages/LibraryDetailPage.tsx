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
  allocation_type?: string;
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
  allowVisitorPasses?: boolean;
  allow_visitor_passes?: boolean;
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

  // Library photos from backend
  const [libraryPhotos, setLibraryPhotos] = useState<Array<{ id: string; url: string; caption?: string }>>([]);
  const [photoIndex, setPhotoIndex] = useState(0);

  // Active detail tab: overview | photos | reviews | rules
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'photos' | 'reviews' | 'rules'>('overview');

  // Real-time seat count per shift (replaces dummy freeCount)
  const [shiftFreeSeats, setShiftFreeSeats] = useState<Record<string, number>>({});

  // Dynamic Identity & Configurable KYC Requirements State
  const [identityRequirements, setIdentityRequirements] = useState<{
    fastPathZeroFields?: boolean;
    requirePhoneVerified?: boolean;
    requireAadhaarLast4?: boolean;
    requirePanMasked?: boolean;
    requireTargetExam?: boolean;
    requireCollegeName?: boolean;
    customFields?: Array<{ name: string; label: string; type: string; required: boolean }>;
  } | null>(null);
  const [showDynamicKycModal, setShowDynamicKycModal] = useState(false);
  const [dynamicKycError, setDynamicKycError] = useState<string | null>(null);
  const [dynamicKycForm, setDynamicKycForm] = useState<{
    fullName: string;
    phoneNumber: string;
    aadhaarLast4: string;
    panMasked: string;
    targetExam: string;
    collegeName: string;
    customFields: Record<string, string>;
  }>({
    fullName: '',
    phoneNumber: '',
    aadhaarLast4: '',
    panMasked: '',
    targetExam: 'UPSC',
    collegeName: '',
    customFields: {}
  });

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

  const libCat = (library?.libraryCategory || library?.library_category || 'PRIVATE').toUpperCase();
  const isInstitute = libCat === 'INSTITUTE';
  const isGovernment = libCat === 'GOVERNMENT';

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
          allowVisitorPasses: payload.library.allow_visitor_passes ?? payload.library.allowVisitorPasses ?? prev?.allowVisitorPasses,
          allow_visitor_passes: payload.library.allow_visitor_passes ?? payload.library.allowVisitorPasses ?? prev?.allow_visitor_passes,
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

  // Fetch library photos
  useEffect(() => {
    if (!id) return;
    api.get(`/api/v1/libraries/${id}/photos`)
      .then(({ data }) => {
        if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
          setLibraryPhotos(data.data);
        }
      })
      .catch(() => {});
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

    if (seat.allocation_type === 'RESERVED') {
      alert(`🔒 Dedicated Monthly Seat:\n\nDesk ${seat.seatCode} is dedicated to a monthly subscriber and cannot be self-booked for flexible hourly/daily slots. Please select a NON_RESERVED desk or contact the library owner.`);
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
  const [privateVisitorName, setPrivateVisitorName] = useState('');
  const [privateVisitorContact, setPrivateVisitorContact] = useState('');
  const [privateVisitorEmail, setPrivateVisitorEmail] = useState('');
  const [visitorLoading, setVisitorLoading] = useState(false);
  const [visitorPassResult, setVisitorPassResult] = useState<any | null>(null);

  const handleBookVisitorPass = async () => {
    if (!id) return;
    const libCat = (library?.libraryCategory || library?.library_category || 'PRIVATE').toUpperCase();
    
    // For Private libraries, allow unauthenticated visitor leads
    if (libCat === 'PRIVATE') {
      if (!privateVisitorName.trim() || !privateVisitorContact.trim() || !privateVisitorEmail.trim()) {
        alert('Please fill in all details.');
        return;
      }
      setVisitorLoading(true);
      setVisitorPassResult(null);
      try {
        const { data } = await api.post(`/api/v1/libraries/${id}/private-visitor-leads`, {
          name: privateVisitorName,
          contact: privateVisitorContact,
          email: privateVisitorEmail,
          purpose: visitorPurpose
        });
        if (data?.success) {
          setVisitorPassResult(data.data || { message: 'Details saved for advertisement!', status: 'SAVED', timeLimitMinutes: 0 });
        } else {
          alert(data?.message || 'Failed to submit details.');
        }
      } catch (err: any) {
        alert(err.response?.data?.message || 'Error submitting details.');
      } finally {
        setVisitorLoading(false);
      }
      return;
    }

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
          if (prof.masked_aadhaar || prof.masked_pan || prof.target_exam || prof.custom_identity_fields || prof.full_name || prof.phone_number) {
            setDynamicKycForm(prev => ({
              ...prev,
              fullName: prof.full_name || prev.fullName,
              phoneNumber: prof.phone_number || prev.phoneNumber,
              aadhaarLast4: prof.masked_aadhaar ? prof.masked_aadhaar.replace(/\D/g, '').slice(-4) : prev.aadhaarLast4,
              panMasked: prof.masked_pan || prev.panMasked,
              targetExam: prof.target_exam || prev.targetExam,
              collegeName: prof.branch || prev.collegeName,
              customFields: (typeof prof.custom_identity_fields === 'object' && prof.custom_identity_fields) ? prof.custom_identity_fields : prev.customFields
            }));
          }
        }
      })
      .catch(() => {});

    // Fetch dynamic identity requirements configured by this library
    api.get(`/api/v1/libraries/${id}/identity-requirements`)
      .then(({ data }) => {
        if (data?.success && data?.data) {
          const cfg = data.data;
          setIdentityRequirements({
            fastPathZeroFields: Boolean(cfg.fastPathZeroFields ?? cfg.fast_path_zero_fields ?? true),
            requirePhoneVerified: Boolean(cfg.requirePhoneVerified ?? cfg.require_phone_verified ?? true),
            requireAadhaarLast4: Boolean(cfg.requireAadhaarLast4 ?? cfg.require_aadhaar_last4 ?? false),
            requirePanMasked: Boolean(cfg.requirePanMasked ?? cfg.require_pan_masked ?? false),
            requireTargetExam: Boolean(cfg.requireTargetExam ?? cfg.require_target_exam ?? false),
            requireCollegeName: Boolean(cfg.requireCollegeName ?? cfg.require_college_name ?? false),
            customFields: Array.isArray(cfg.customFields || cfg.custom_fields)
              ? (cfg.customFields || cfg.custom_fields)
              : []
          });
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
        if (session.user.user_metadata?.full_name) {
          setDynamicKycForm(prev => ({ ...prev, fullName: prev.fullName || session.user.user_metadata.full_name }));
        }
        if (session.user.phone) {
          setDynamicKycForm(prev => ({ ...prev, phoneNumber: prev.phoneNumber || session.user.phone || '' }));
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
      const savedKyc = localStorage.getItem(`student_kyc_info_${id}`);
      if (savedKyc) {
        const parsedKyc = JSON.parse(savedKyc);
        if (parsedKyc) setDynamicKycForm((prev) => ({ ...prev, ...parsedKyc }));
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

    // ── GOVERNMENT & PRIVATE: Dynamic KYC Requirements vs Zero-Fields Fast Path
    let dynamicName = overrides?.fullName || dynamicKycForm.fullName || govtForm.fullName || session?.user?.user_metadata?.full_name || '';
    let dynamicPhone = overrides?.phoneNumber || dynamicKycForm.phoneNumber || session?.user?.phone || '';
    let dynamicAadhaar = overrides?.aadhaarLast4 || dynamicKycForm.aadhaarLast4 || govtForm.aadhaarLast4 || (savedProfile?.masked_aadhaar ? savedProfile.masked_aadhaar.replace(/\D/g, '').slice(-4) : '');
    let dynamicPan = overrides?.panMasked || dynamicKycForm.panMasked || savedProfile?.masked_pan || '';
    let dynamicExam = overrides?.targetExam || dynamicKycForm.targetExam || govtForm.targetExam || savedProfile?.target_exam || '';
    let dynamicCollege = overrides?.collegeName || dynamicKycForm.collegeName || savedProfile?.branch || '';
    let dynamicCustom = overrides?.customFields || dynamicKycForm.customFields || savedProfile?.custom_identity_fields || {};

    if (!isInstitute) {
      const isFastPath = identityRequirements
        ? (identityRequirements.fastPathZeroFields !== false && !identityRequirements.requireAadhaarLast4 && !identityRequirements.requirePanMasked && !identityRequirements.requireTargetExam && !identityRequirements.requireCollegeName && (!identityRequirements.customFields || identityRequirements.customFields.length === 0))
        : !isGovernment;

      if (!isFastPath) {
        const reqAadhaar = Boolean(identityRequirements?.requireAadhaarLast4 || (isGovernment && !identityRequirements));
        const reqPan = Boolean(identityRequirements?.requirePanMasked);
        const reqExam = Boolean(identityRequirements?.requireTargetExam || (isGovernment && !identityRequirements));
        const reqCollege = Boolean(identityRequirements?.requireCollegeName);
        const reqCustom = identityRequirements?.customFields || [];

        const isMissingAadhaar = reqAadhaar && (!dynamicAadhaar || dynamicAadhaar.length !== 4);
        const isMissingPan = reqPan && !dynamicPan.trim();
        const isMissingExam = reqExam && !dynamicExam.trim();
        const isMissingCollege = reqCollege && !dynamicCollege.trim();
        const isMissingCustom = reqCustom.some(f => f.required && (!dynamicCustom || !dynamicCustom[f.name]));

        if (isMissingAadhaar || isMissingPan || isMissingExam || isMissingCollege || isMissingCustom) {
          setShowDynamicKycModal(true);
          return;
        }

        try {
          const toSave = {
            fullName: dynamicName,
            phoneNumber: dynamicPhone,
            aadhaarLast4: dynamicAadhaar,
            panMasked: dynamicPan,
            targetExam: dynamicExam,
            collegeName: dynamicCollege,
            customFields: dynamicCustom
          };
          localStorage.setItem(`student_kyc_info_${id}`, JSON.stringify(toSave));
          if (isGovernment) {
            localStorage.setItem('student_govt_info_global', JSON.stringify({
              fullName: dynamicName,
              aadhaarLast4: dynamicAadhaar,
              targetExam: dynamicExam
            }));
          }
        } catch (e) {}
      }
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
        // Dynamic KYC & Govt fields
        govtName: dynamicName || undefined,
        phoneNumber: dynamicPhone || undefined,
        aadhaarLast4: dynamicAadhaar || undefined,
        panMasked: dynamicPan || undefined,
        targetExam: dynamicExam || undefined,
        customFields: dynamicCustom && Object.keys(dynamicCustom).length > 0 ? dynamicCustom : undefined,
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
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-24">
      {activeDetailTab !== ('seat_map' as any) ? (
        <div className="max-w-xl mx-auto bg-white min-h-screen shadow-sm relative">
          {/* TOP BAR */}
          <div className="flex items-center justify-between p-4 bg-white border-b border-gray-100 sticky top-0 z-10">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <span className="text-sm font-medium text-gray-500 tracking-wide">Library photo 1 / 4</span>
            <div className="w-9" />
          </div>

          <div className="p-5">
            <h1 className="text-3xl font-bold text-gray-900 mb-1">{library?.name || 'Pragati Study Point'}</h1>
            <p className="text-sm text-gray-500 mb-5">
              {library?.locality || 'Bhawarkua'}, {library?.city || 'Indore'} - 1.2 km - 4.6 (38 reviews)
            </p>
            
            <div className="flex gap-2 mb-5">
              <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-medium border border-gray-200">UPSC</span>
              <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-medium border border-gray-200">MPPSC</span>
              <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-medium border border-gray-200">SSC</span>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-8 border-b border-gray-100 pb-8">
              <span className="flex items-center gap-1.5"><span className="text-lg">❄️</span> AC</span>
              <span className="flex items-center gap-1.5"><span className="text-lg">📶</span> Wi-Fi</span>
              <span className="flex items-center gap-1.5"><span className="text-lg">🔌</span> Sockets</span>
              <span className="flex items-center gap-1.5"><span className="text-lg">👩</span> Girls room</span>
              <span className="flex items-center gap-1.5"><span className="text-lg">🔒</span> Lockers</span>
            </div>

            <h2 className="text-lg font-bold mb-4">Shifts and prices</h2>
            <div className="overflow-x-auto mb-5">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-200">
                    <th className="py-3 font-medium">Shift</th>
                    <th className="py-3 font-medium">Time</th>
                    <th className="py-3 font-medium">Month</th>
                    <th className="py-3 font-medium">Day</th>
                    <th className="py-3 font-medium">Free</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-50">
                    <td className="py-3.5 text-gray-800">Morning</td>
                    <td className="text-gray-500">6-12</td>
                    <td className="font-semibold">₹800</td>
                    <td className="text-gray-500">₹60</td>
                    <td className="font-medium text-gray-700">14</td>
                  </tr>
                  <tr className="border-b border-gray-50">
                    <td className="py-3.5 text-gray-800">Evening</td>
                    <td className="text-gray-500">12-6</td>
                    <td className="font-semibold">₹800</td>
                    <td className="text-gray-500">₹60</td>
                    <td className="font-medium text-gray-700">6</td>
                  </tr>
                  <tr className="border-b border-gray-50">
                    <td className="py-3.5 text-gray-800">Full day</td>
                    <td className="text-gray-500">6-10</td>
                    <td className="font-semibold">₹1,400</td>
                    <td className="text-gray-500">₹100</td>
                    <td className="font-medium text-gray-700">3</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 text-gray-800">Night</td>
                    <td className="text-gray-500">10-6</td>
                    <td className="font-semibold">₹900</td>
                    <td className="text-gray-500">-</td>
                    <td className="font-medium text-gray-700">11</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <p className="text-sm text-gray-500 mb-10 pb-8 border-b border-gray-100">
              Hourly ₹25 • AC seat +₹200/month • Locker ₹100/month • Admission ₹300 one time
            </p>

            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Reviews</h2>
              <span className="text-sm font-semibold underline cursor-pointer hover:text-gray-700">4.1/38</span>
            </div>
            <p className="text-sm text-gray-600 mb-20 italic">
              "Quiet even in exam season. Night shift staff are...
            </p>
          </div>

          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-safe z-50">
            <div className="max-w-xl mx-auto flex items-center justify-between">
              <div>
                <div className="font-bold text-xl">₹800 <span className="text-sm text-gray-500 font-normal">/ month</span></div>
                <div className="text-xs text-gray-500 mt-0.5">Pay at library</div>
              </div>
              <button 
                onClick={() => setActiveDetailTab('seat_map' as any)} 
                className="bg-[#ffdb4d] hover:bg-[#e6c545] text-black font-semibold rounded-lg px-8 py-3.5 transition-colors shadow-sm"
              >
                Book a seat
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-xl mx-auto bg-gray-50 min-h-screen relative flex flex-col">
          <div className="flex items-center justify-between p-4 bg-white border-b border-gray-100 sticky top-0 z-10">
            <button onClick={() => setActiveDetailTab('overview')} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <span className="text-lg font-bold">Choose a seat</span>
            <span className="text-sm border border-gray-300 rounded-md px-2.5 py-1.5 font-medium flex items-center gap-1.5">
              ⏱ 6:41
            </span>
          </div>
          
          <div className="p-4 bg-white border-b border-gray-200">
            <div className="flex gap-5 text-sm font-medium text-gray-400 mb-4 px-1">
              <span className="text-black border-b-2 border-black pb-1.5">Type ↗</span>
              <span className="hover:text-gray-700 cursor-pointer">Time ↗</span>
              <span className="hover:text-gray-700 cursor-pointer">Seat</span>
              <span className="hover:text-gray-700 cursor-pointer">Pay</span>
            </div>
            
            <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 text-sm mb-5 text-gray-700 leading-relaxed">
              Monthly membership • Morning 6:00 - 12:00<br/>
              from Tue 14 Oct
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              <button className="px-5 py-2.5 bg-white border border-gray-200 border-b-[3px] border-b-black rounded-lg font-semibold text-sm whitespace-nowrap shadow-sm">
                AC hall
              </button>
              <button className="px-5 py-2.5 bg-gray-50 border border-transparent rounded-lg font-medium text-gray-500 text-sm whitespace-nowrap hover:bg-gray-100">
                Non-AC hall
              </button>
              <button className="px-5 py-2.5 bg-gray-50 border border-transparent rounded-lg font-medium text-gray-500 text-sm whitespace-nowrap hover:bg-gray-100">
                Girls room
              </button>
            </div>
          </div>
          
          <div className="p-5 flex-1 bg-white mt-2">
            <div className="text-center text-[10px] font-bold text-gray-400 mb-6 tracking-[0.2em] uppercase">
              Door and desk
            </div>
            
            <div className="grid grid-cols-6 gap-3 mb-8 max-w-sm mx-auto">
              {displayedSeats.map((seat) => {
                const isSelected = selectedSeat?.id === seat.id;
                const isBooked = seat.status === 'BOOKED' || seat.status === 'LOCKED' || seat.status === 'IN_USE';
                const isGirlsOnly = seat.is_girls_only === true;
                
                let bgClass = "bg-white border-gray-300";
                let textClass = "text-gray-700";
                
                if (isSelected) {
                  bgClass = "bg-[#ffdb4d] border-[#ffdb4d] ring-4 ring-[#ffdb4d]/30";
                  textClass = "text-black font-bold";
                } else if (isGirlsOnly && !isBooked) {
                  bgClass = "bg-pink-100 border-pink-200";
                  textClass = "text-pink-500";
                } else if (isBooked) {
                  bgClass = "bg-gray-100 border-gray-200";
                  textClass = "text-gray-400";
                }

                return (
                  <button 
                    key={seat.id} 
                    onClick={() => {
                      if (!isBooked) {
                        setSelectedSeat(seat);
                      }
                    }}
                    className={`w-11 h-11 rounded-lg border shadow-sm ${bgClass} ${textClass} flex items-center justify-center text-sm transition-all hover:border-gray-400 focus:outline-none`}
                  >
                    {seat.seatCode}
                  </button>
                )
              })}
            </div>
            
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-[11px] font-medium text-gray-500 mb-8 max-w-xs mx-auto">
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded border border-gray-300 bg-white inline-block"></span> free</span>
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded border border-gray-200 bg-gray-100 inline-block"></span> taken</span>
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded border border-pink-200 bg-pink-100 inline-block"></span> girls only</span>
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded border border-[#ffdb4d] bg-[#ffdb4d] inline-block"></span> your pick</span>
            </div>
            
            <button className="w-full py-3.5 border border-gray-200 rounded-xl text-sm font-semibold bg-white text-gray-700 shadow-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
              <span>✨</span> Pick best available seat
            </button>
          </div>

          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-safe z-50">
            <div className="max-w-xl mx-auto flex items-center justify-between">
              <div>
                <div className="font-bold text-lg">Seat {selectedSeat?.seatCode || '12'} - AC hall</div>
                <div className="text-xs text-gray-500 mt-0.5">₹1,000 / month</div>
              </div>
              <button 
                onClick={handleCheckout}
                className="bg-[#ffdb4d] hover:bg-[#e6c545] text-black font-semibold rounded-lg px-8 py-3.5 transition-colors shadow-sm"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* ── DYNAMIC STUDENT IDENTITY & KYC REQUIREMENTS MODAL ── */}
      {(showDynamicKycModal || showGovtModal) && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0c1120] border border-violet-500/30 dark:border-violet-500/20 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setShowDynamicKycModal(false);
                setShowGovtModal(false);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg font-bold"
            >
              ✕
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center mx-auto mb-3 text-2xl">
                {isGovernment ? '🏛️' : '🪪'}
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {isGovernment ? 'Government Library — Student Identity' : 'Student Verification & Identity'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {library?.name || 'This library'} requires basic verification before confirming your desk.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setDynamicKycError(null);
                const reqAadhaar = Boolean(identityRequirements?.requireAadhaarLast4 || (isGovernment && !identityRequirements));
                const reqPan = Boolean(identityRequirements?.requirePanMasked);
                const reqExam = Boolean(identityRequirements?.requireTargetExam || (isGovernment && !identityRequirements));
                const reqCollege = Boolean(identityRequirements?.requireCollegeName);
                const reqCustom = identityRequirements?.customFields || [];

                if (reqAadhaar) {
                  const a4 = dynamicKycForm.aadhaarLast4.trim();
                  if (!a4 || a4.length !== 4 || !/^\d{4}$/.test(a4)) {
                    setDynamicKycError('Please enter exactly the last 4 digits of your Aadhaar card.');
                    return;
                  }
                }
                if (reqPan && !dynamicKycForm.panMasked.trim()) {
                  setDynamicKycError('Please enter your PAN details.');
                  return;
                }
                if (reqExam && !dynamicKycForm.targetExam.trim()) {
                  setDynamicKycError('Please select or specify your target exam.');
                  return;
                }
                if (reqCollege && !dynamicKycForm.collegeName.trim()) {
                  setDynamicKycError('Please enter your College / University name.');
                  return;
                }
                for (const cf of reqCustom) {
                  if (cf.required && !dynamicKycForm.customFields[cf.name]?.trim()) {
                    setDynamicKycError(`Please provide ${cf.label}.`);
                    return;
                  }
                }

                setShowDynamicKycModal(false);
                setShowGovtModal(false);
                handleCheckout({
                  fullName: dynamicKycForm.fullName,
                  phoneNumber: dynamicKycForm.phoneNumber,
                  aadhaarLast4: dynamicKycForm.aadhaarLast4,
                  panMasked: dynamicKycForm.panMasked,
                  targetExam: dynamicKycForm.targetExam,
                  collegeName: dynamicKycForm.collegeName,
                  customFields: dynamicKycForm.customFields
                });
              }}
              className="space-y-4 text-xs max-h-[70vh] overflow-y-auto pr-1"
            >
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={dynamicKycForm.fullName}
                  onChange={e => setDynamicKycForm({ ...dynamicKycForm, fullName: e.target.value })}
                  placeholder="e.g. Ramesh Kumar Sharma"
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mobile Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={dynamicKycForm.phoneNumber}
                  onChange={e => setDynamicKycForm({ ...dynamicKycForm, phoneNumber: e.target.value })}
                  placeholder="e.g. 9876543210"
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white font-mono text-sm"
                />
              </div>

              {(identityRequirements?.requireAadhaarLast4 || (isGovernment && !identityRequirements)) && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Aadhaar Last 4 Digits *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    pattern="\d{4}"
                    value={dynamicKycForm.aadhaarLast4}
                    onChange={e => setDynamicKycForm({ ...dynamicKycForm, aadhaarLast4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    placeholder="XXXX"
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white font-mono text-base text-center tracking-widest"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Stored masked as XXXX-XXXX-1234 for privacy</span>
                </div>
              )}

              {identityRequirements?.requirePanMasked && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    PAN Card (Masked) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={dynamicKycForm.panMasked}
                    onChange={e => setDynamicKycForm({ ...dynamicKycForm, panMasked: e.target.value.toUpperCase() })}
                    placeholder="ABCDE1234F"
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white font-mono text-sm uppercase"
                  />
                </div>
              )}

              {(identityRequirements?.requireTargetExam || (isGovernment && !identityRequirements)) && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Target Competitive Exam *
                  </label>
                  <select
                    value={dynamicKycForm.targetExam}
                    onChange={e => setDynamicKycForm({ ...dynamicKycForm, targetExam: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white font-bold"
                  >
                    {['UPSC', 'SSC CGL', 'SSC CHSL', 'Banking (IBPS/SBI)', 'Railways (RRB)', 'State PSC', 'MPSC', 'RPSC', 'JPSC', 'Defence (NDA/CDS)', 'NEET', 'IIT-JEE', 'NET/JRF', 'GATE', 'CAT/MBA', 'Other'].map(exam => (
                      <option key={exam} value={exam}>{exam}</option>
                    ))}
                  </select>
                </div>
              )}

              {identityRequirements?.requireCollegeName && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    College / University Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={dynamicKycForm.collegeName}
                    onChange={e => setDynamicKycForm({ ...dynamicKycForm, collegeName: e.target.value })}
                    placeholder="e.g. SGSITS, DAVV, IIT Indore"
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm"
                  />
                </div>
              )}

              {identityRequirements?.customFields && identityRequirements.customFields.map((cf, idx) => (
                <div key={idx}>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {cf.label} {cf.required && '*'}
                  </label>
                  <input
                    type={cf.type || 'text'}
                    required={cf.required}
                    value={dynamicKycForm.customFields[cf.name] || ''}
                    onChange={e => setDynamicKycForm({
                      ...dynamicKycForm,
                      customFields: { ...dynamicKycForm.customFields, [cf.name]: e.target.value }
                    })}
                    placeholder={`Enter ${cf.label}`}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm"
                  />
                </div>
              ))}

              {dynamicKycError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-semibold">
                  {dynamicKycError}
                </div>
              )}

              <p className="text-[10px] text-slate-400 text-center">
                🔒 Privacy-first verification: sensitive fields are stored masked to protect your identity.
              </p>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-xs shadow-lg shadow-violet-600/25 transition cursor-pointer"
              >
                Confirm Identity &amp; Continue to Booking →
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
                {((library?.libraryCategory || library?.library_category || 'PRIVATE').toUpperCase() === 'PRIVATE') ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={privateVisitorName}
                        onChange={(e) => setPrivateVisitorName(e.target.value)}
                        placeholder="e.g. John Doe"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Contact Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={privateVisitorContact}
                        onChange={(e) => setPrivateVisitorContact(e.target.value)}
                        placeholder="e.g. 9876543210"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={privateVisitorEmail}
                        onChange={(e) => setPrivateVisitorEmail(e.target.value)}
                        placeholder="e.g. john@example.com"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
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
                  </div>
                )}

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
      {/* ── STICKY BOTTOM BOOKING BAR ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[#0c1220] border-t border-slate-200 dark:border-slate-800 shadow-2xl shadow-slate-900/20 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {library?.isFree ? 'FREE' : activeShift ? `₹${activeShift.daily_price}` : '₹300'}
              </span>
              {!library?.isFree && <span className="text-xs text-slate-400 font-medium">per shift</span>}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {activeShift?.shift_name || 'Morning Shift'} &bull; {activeShift ? `${formatTime(activeShift.start_time)} – ${formatTime(activeShift.end_time)}` : '6:00 AM – 12:00 PM'}
            </p>
            {selectedSeat && (
              <p className="text-xs font-bold text-violet-600 dark:text-violet-400 mt-0.5 flex items-center gap-1">
                <span>🪑</span> Seat {selectedSeat.seatCode} selected
                <button
                  onClick={() => setSelectedSeat(null)}
                  className="ml-1 text-slate-400 hover:text-rose-500 transition text-[10px] font-normal cursor-pointer"
                >
                  Change
                </button>
              </p>
            )}
            {!selectedSeat && (
              <button
                onClick={() => document.querySelector('.seat-grid-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-xs text-indigo-500 font-bold mt-0.5 hover:underline"
              >
                View Details &rsaquo;
              </button>
            )}
          </div>
          <button
            id="book-seat-btn"
            type="button"
            onClick={() => handleCheckout()}
            disabled={checkoutLoading}
            className="shrink-0 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-extrabold text-sm shadow-lg shadow-violet-500/30 transition-all disabled:opacity-60 cursor-pointer flex items-center gap-2"
          >
            {checkoutLoading ? (
              <span className="flex items-center gap-1.5"><span className="animate-spin">⏳</span> Booking...</span>
            ) : (
              <>Book a Seat <span className="text-base">→</span></>
            )}
          </button>
        </div>
        {checkoutError && (
          <p className="max-w-2xl mx-auto text-xs text-rose-500 font-semibold mt-2 text-center">{checkoutError}</p>
        )}
      </div>
    </div>
  );
}

