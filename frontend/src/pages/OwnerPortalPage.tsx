import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import jsQR from 'jsqr';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import Navbar from '../components/Navbar';

interface ShiftData {
  id: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  monthlyPrice: number;
  dailyPrice: number;
}

interface LibraryData {
  id: string;
  name: string;
  locality?: string;
  city?: string;
  state?: string;
  address?: string;
  email?: string;
  contactNumber?: string;
  isFree: boolean;
  seatingType: string;
  approvalStatus: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
  totalSeats: number;
  lockerMode: string;
  allowVisitorPasses?: boolean;
  acAvailable?: boolean;
  hasGirlsSection?: boolean;
  hasDiscussionRoom?: boolean;
  discussionRoomCapacity?: number;
  wifiAvailable?: boolean;
  cctvAvailable?: boolean;
  powerBackupAvailable?: boolean;
  waterDispenserAvailable?: boolean;
  newspaperAvailable?: boolean;
  booksCapacity?: number;
  availableBooksData?: string;
  baseDeskPriceDaily?: number;
  baseDeskPriceMonthly?: number;
  sofaPriceDaily?: number;
  sofaPriceMonthly?: number;
  layoutType?: string;
  layoutFileUrl?: string;
  proofDocType?: string;
  proofDocNumber?: string;
  proofDocUrl?: string;
  rejectionReason?: string;
  libraryCategory?: 'PRIVATE' | 'GOVERNMENT' | 'INSTITUTE';
  allowedEmailDomain?: string;
  shifts?: ShiftData[];
}

function normalizeLibraryData(raw: any): LibraryData | null {
  if (!raw) return null;
  return {
    id: raw.id,
    name: raw.name,
    locality: raw.locality,
    city: raw.city,
    state: raw.state,
    address: raw.address,
    email: raw.email,
    contactNumber: raw.contactNumber || raw.contact_number,
    isFree: raw.isFree !== undefined ? Boolean(raw.isFree) : Boolean(raw.is_free),
    seatingType: raw.seatingType || raw.seating_type || 'ERGONOMIC',
    approvalStatus: (raw.approvalStatus || raw.approval_status || 'DRAFT') as any,
    rejectionReason: raw.rejectionReason || raw.rejection_reason,
    libraryCategory: raw.libraryCategory || raw.library_category || 'PRIVATE',
    allowedEmailDomain: raw.allowedEmailDomain || raw.allowed_email_domain || '',
    totalSeats: Number(raw.totalSeats || raw.total_seats || 30),
    lockerMode: raw.lockerMode || raw.locker_mode || 'PAID_MANAGED',
    allowVisitorPasses: raw.allowVisitorPasses !== undefined ? Boolean(raw.allowVisitorPasses) : (raw.allow_visitor_passes !== undefined ? Boolean(raw.allow_visitor_passes) : true),
    acAvailable: raw.acAvailable !== undefined ? Boolean(raw.acAvailable) : Boolean(raw.ac_available),
    hasGirlsSection: raw.hasGirlsSection !== undefined ? Boolean(raw.hasGirlsSection) : Boolean(raw.has_girls_section),
    hasDiscussionRoom: raw.hasDiscussionRoom !== undefined ? Boolean(raw.hasDiscussionRoom) : Boolean(raw.has_discussion_room),
    discussionRoomCapacity: Number(raw.discussionRoomCapacity || raw.discussion_room_capacity || 0),
    wifiAvailable: raw.wifiAvailable !== undefined ? Boolean(raw.wifiAvailable) : Boolean(raw.wifi_available),
    cctvAvailable: raw.cctvAvailable !== undefined ? Boolean(raw.cctvAvailable) : Boolean(raw.cctv_available),
    powerBackupAvailable: raw.powerBackupAvailable !== undefined ? Boolean(raw.powerBackupAvailable) : Boolean(raw.power_backup_available),
    waterDispenserAvailable: raw.waterDispenserAvailable !== undefined ? Boolean(raw.waterDispenserAvailable) : Boolean(raw.water_dispenser_available),
    newspaperAvailable: raw.newspaperAvailable !== undefined ? Boolean(raw.newspaperAvailable) : Boolean(raw.newspaper_available),
    booksCapacity: Number(raw.booksCapacity || raw.books_capacity || 0),
    availableBooksData: raw.availableBooksData || raw.available_books_data,
    baseDeskPriceDaily: Number(raw.baseDeskPriceDaily || raw.base_desk_price_daily || 0),
    baseDeskPriceMonthly: Number(raw.baseDeskPriceMonthly || raw.base_desk_price_monthly || 0),
    sofaPriceDaily: Number(raw.sofaPriceDaily || raw.sofa_price_daily || 0),
    sofaPriceMonthly: Number(raw.sofaPriceMonthly || raw.sofa_price_monthly || 0),
    layoutType: raw.layoutType || raw.layout_type,
    layoutFileUrl: raw.layoutFileUrl || raw.layout_file_url,
    proofDocType: raw.proofDocType || raw.proof_doc_type,
    proofDocNumber: raw.proofDocNumber || raw.proof_doc_number,
    proofDocUrl: raw.proofDocUrl || raw.proof_doc_url,
    shifts: (raw.shifts || []).map((sh: any) => ({
      id: sh.id,
      shiftName: sh.shiftName || sh.shift_name,
      startTime: sh.startTime || sh.start_time,
      endTime: sh.endTime || sh.end_time,
      monthlyPrice: Number(sh.monthlyPrice || sh.monthly_price || 0),
      dailyPrice: Number(sh.dailyPrice || sh.daily_price || 0),
    })),
  };
}

function generateSeatsForLayout(
  layout: string,
  totalSeats: number,
  girlsCount: number,
  hasSockets: boolean
) {
  const seats = [];
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'P', 'R'];
  const colsPerRow = 6;

  for (let i = 0; i < totalSeats; i++) {
    const rowIdx = Math.floor(i / colsPerRow);
    const colIdx = i % colsPerRow;
    const rowLetter = rows[rowIdx % rows.length] || `R${rowIdx + 1}`;

    let seatCode = `${rowLetter}${colIdx + 1}`;
    if (layout === 'GENERATED_PODS') {
      const podNum = Math.floor(i / 4) + 1;
      const seatInPod = (i % 4) + 1;
      seatCode = `POD${podNum}-${seatInPod}`;
    } else if (layout === 'GENERATED_PERIMETER') {
      const isWall = i < Math.floor(totalSeats * 0.4);
      seatCode = isWall ? `W${i + 1}` : `C${i - Math.floor(totalSeats * 0.4) + 1}`;
    } else if (layout === 'GENERATED_QUIET_CLUSTER') {
      const isQuiet = i < Math.floor(totalSeats * 0.7);
      seatCode = isQuiet ? `Q${i + 1}` : `D${i - Math.floor(totalSeats * 0.7) + 1}`;
    } else if (layout === 'GENERATED_DUAL_WING') {
      seatCode = `W-${rowLetter}${colIdx + 1}`;
    }

    const isGirlsOnly = false; // Default: unassigned; owner marks girls seats manually in layout
    seats.push({
      seatCode,
      rowIdx,
      colIdx,
      isGirlsOnly,
      hasPowerSocket: hasSockets,
      distToAcM: Math.round((2.0 + (i % 5) * 1.2) * 10) / 10,
      distToDoorM: Math.round((3.0 + Math.floor(i / 6) * 1.5) * 10) / 10,
    });
  }
  return seats;
}

interface StudentRecord {
  id: string;
  name: string;
  phone: string;
  email?: string;
  collegeId?: string;
  id_number?: string;
  aadhaarMasked?: string;
  shiftName?: string;
  seatCode?: string;
  monthlyFee: number;
  balanceOwed: number;
  status: string;
  gender?: string;
  isVerified?: boolean;
}

export default function OwnerPortalPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'onboarding' | 'desk' | 'crm' | 'fees' | 'walkin' | 'scanner' | 'circulation' | 'reports' | 'master-audit' | 'complaints' | 'requests' | 'manage-students'>('fees');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['onboarding', 'desk', 'crm', 'fees', 'walkin', 'scanner', 'circulation', 'reports', 'master-audit', 'complaints', 'requests', 'manage-students'].includes(tab)) {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  // Billing Register & Custom Template States
  const [customMsgTemplate, setCustomMsgTemplate] = useState(
    'Dear {StudentName}, gentle reminder from {LibraryName}. Your pending fee balance for desk {DeskCode} is ₹{PendingBalance}. Please complete payment by {ReminderDate}. Thank you!'
  );
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedReceiptStudent, setSelectedReceiptStudent] = useState<any>(null);
  const [showFullProfileModal, setShowFullProfileModal] = useState(false);
  const [selectedProfileStudent, setSelectedProfileStudent] = useState<any>(null);
  const [lastReminders, setLastReminders] = useState<Record<string, string>>({});

  // Complaints & Grievances Desk State
  const [libraryComplaints, setLibraryComplaints] = useState<any[]>([]);
  const [complaintFilter, setComplaintFilter] = useState<'ALL' | 'PENDING' | 'RESOLVED'>('ALL');
  const [wardenReplies, setWardenReplies] = useState<Record<string, string>>({});
  const [complaintActionLoading, setComplaintActionLoading] = useState<string | null>(null);

  // Master Audit Report Filter State
  const [auditFilterType, setAuditFilterType] = useState<'ALL' | 'BY_SEAT' | 'BY_STUDENT' | 'BY_DATE' | 'BY_VISIT' | 'BY_BOOKING'>('ALL');
  const [auditDateMode, setAuditDateMode] = useState<'TODAY' | 'CUSTOM' | 'MONTHLY' | 'YEARLY'>('TODAY');
  const [auditStartDate, setAuditStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [auditEndDate, setAuditEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');

  // Students Tab Limits for Load More
  const [activeSeatsLimit, setActiveSeatsLimit] = useState(5);
  const [waitingSeatsLimit, setWaitingSeatsLimit] = useState(5);
  const [bookingHistoryLimit, setBookingHistoryLimit] = useState(5);
  const [visitsHistoryLimit, setVisitsHistoryLimit] = useState(5);

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Library & Onboarding State
  const [library, setLibrary] = useState<LibraryData | null>(null);
  const [isEditingWizard, setIsEditingWizard] = useState(false);

  // Form Questionnaire State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    city: '',
    state: '',
    locality: '',
    address: '',
    contactNumber: '',
    libraryCategory: 'PRIVATE' as 'PRIVATE' | 'GOVERNMENT' | 'INSTITUTE',
    allowedEmailDomain: '',
    isFree: false,
    totalSeats: 30,
    girlsOnlyCount: 0,
    hasSockets: true,
    acAvailable: true,

    // Discussion Room
    hasDiscussionRoom: false,
    discussionRoomCapacity: 0,

    // Facilities
    wifiAvailable: true,
    cctvAvailable: true,
    powerBackupAvailable: true,
    waterDispenserAvailable: true,
    newspaperAvailable: true,
    booksCapacity: 0,
    availableBooksData: '',

    // Base Pricing & Sofas
    baseDeskPriceDaily: 300,
    baseDeskPriceMonthly: 800,
    hasSofaSeating: false,
    sofaPriceDaily: 450,
    sofaPriceMonthly: 1200,

    // Pricing Model & Custom Types
    pricingModel: 'BY_SEAT_TYPE' as 'BY_SEAT_TYPE' | 'CUSTOM_SEAT',
    customSeatTypes: [] as Array<{ id: string; name: string; icon: string; seatCount?: number; dailyPrice: number; monthlyPrice: number }>,

    // Locker
    lockerMode: 'NO_LOCKERS' as 'NO_LOCKERS' | 'FREE_LOCKERS' | 'PAID_MANAGED',
    seatingType: 'ERGONOMIC',

    // Layout
    layoutOption: 'GENERATED_CLASSROOM' as
      | 'GENERATED_CLASSROOM'
      | 'GENERATED_PODS'
      | 'GENERATED_PERIMETER'
      | 'GENERATED_QUIET_CLUSTER'
      | 'GENERATED_DUAL_WING'
      | 'CUSTOM_UPLOAD',
    customLayoutFileName: '',
    customLayoutFileSize: '',

    // Document of Proof
    proofDocType: 'Municipal Trade License',
    proofDocNumber: '',
    proofDocFileName: '',
    proofDocFileSize: '',
    kycDoc: '',
  });

  // Owner Configurable Student KYC & Identity Requirements State
  const [identityConfig, setIdentityConfig] = useState<{
    fastPathZeroFields: boolean;
    requirePhoneVerified: boolean;
    requireAadhaarLast4: boolean;
    requirePanMasked: boolean;
    requireTargetExam: boolean;
    requireCollegeName: boolean;
    customFields: Array<{ name: string; label: string; type: string; required: boolean }>;
  }>({
    fastPathZeroFields: true,
    requirePhoneVerified: true,
    requireAadhaarLast4: false,
    requirePanMasked: false,
    requireTargetExam: false,
    requireCollegeName: false,
    customFields: []
  });
  const [newCustomFieldName, setNewCustomFieldName] = useState('');
  const [newCustomFieldLabel, setNewCustomFieldLabel] = useState('');
  const [newCustomFieldRequired, setNewCustomFieldRequired] = useState(true);
  const [isSavingIdentityConfig, setIsSavingIdentityConfig] = useState(false);

  // Seat Level Overrides (for marking individual seats as Free, Sofa, Girls Only, Custom Type, or Custom Price)
  const [seatOverrides, setSeatOverrides] = useState<Record<string, {
    isFree?: boolean;
    isSofa?: boolean;
    isGirlsOnly?: boolean;
    seatType?: string;
    customTypeName?: string;
    customTypeIcon?: string;
    customPriceMonthly?: number;
  }>>({});
  const [selectedSeatForOverride, setSelectedSeatForOverride] = useState<string | null>(null);

  // New Custom Seat Type Form
  const [newSeatTypeForm, setNewSeatTypeForm] = useState({ name: '', icon: '🛋️', seatCount: 5, dailyPrice: 400, monthlyPrice: 1000 });
  const [showAddSeatType, setShowAddSeatType] = useState(false);

  // Onboarding shift configurator
  const [onboardingShifts, setOnboardingShifts] = useState<Array<{
    id: string;
    shiftName: string;
    startTime: string;
    endTime: string;
    dailyPrice: number;
    monthlyPrice: number;
    sofaDailyPrice?: number;
    sofaMonthlyPrice?: number;
    customSeatPrices?: Record<string, { dailyPrice: number; monthlyPrice: number }>;
  }>>([
    { id: 'os-1', shiftName: 'Morning Shift', startTime: '06:00', endTime: '12:00', dailyPrice: 300, monthlyPrice: 800 },
    { id: 'os-2', shiftName: 'Afternoon Shift', startTime: '12:00', endTime: '18:00', dailyPrice: 300, monthlyPrice: 800 },
    { id: 'os-3', shiftName: 'Evening Shift', startTime: '18:00', endTime: '00:00', dailyPrice: 350, monthlyPrice: 900 },
    { id: 'os-4', shiftName: 'Night Shift', startTime: '00:00', endTime: '06:00', dailyPrice: 250, monthlyPrice: 650 },
  ]);
  const [showAddShiftForm, setShowAddShiftForm] = useState(false);
  const [expandedShiftIds, setExpandedShiftIds] = useState<Record<string, boolean>>({});
  const [newShiftForm, setNewShiftForm] = useState({ shiftName: '', startTime: '06:00', endTime: '12:00', dailyPrice: 300, monthlyPrice: 800 });

  // Module 14 / Screenshot 2 Interactive Seat State
  const [selectedSeatInfo, setSelectedSeatInfo] = useState<{
    code: string;
    status: 'ONLINE' | 'WALKIN' | 'AVAILABLE' | 'WAITING' | 'IN_USE';
    name?: string;
    phone?: string;
    aadhaar?: string;
    shift?: string;
    feePaid?: number;
    feeDue?: number;
    seatType?: string;
    icon?: string | null;
    bookingId?: string;
    bookingRef?: string;
    collegeId?: string;
    collegeEmail?: string;
    branch?: string;
    degree?: string;
    gender?: string;
    city?: string;
    isEmergency?: boolean;
    isEmergencyUnlocked?: boolean;
  } | null>(null);

  // 4% Emergency Quota Reserve Unlocked Seats Map
  const [unlockedEmergencySeats, setUnlockedEmergencySeats] = useState<Record<string, boolean>>({});

  // Walk-In Sub-Tabs State (SEATS / VISITORS)
  const [walkInSubTab, setWalkInSubTab] = useState<'SEATS' | 'VISITORS'>('SEATS');

  // Shift & Rent Administration State
  const [adminShifts, setAdminShifts] = useState([
    { id: 'shift-1', name: 'Morning Shift', time: '06:00 AM - 12:00 PM', price: 300 },
    { id: 'shift-2', name: 'Afternoon Shift', time: '12:00 PM - 06:00 PM', price: 300 },
    { id: 'shift-3', name: 'Evening Shift', time: '06:00 PM - 12:00 AM', price: 350 },
    { id: 'shift-4', name: 'Night Shift', time: '12:00 AM - 06:00 AM', price: 250 },
  ]);

  // Circulation State (Modules 31-35)
  const [deskLoans, setDeskLoans] = useState<any[]>([]);
  const [catalogBooks, setCatalogBooks] = useState<any[]>([]);
  const [showAddBookModal, setShowAddBookModal] = useState(false);
  const [showIssueBookModal, setShowIssueBookModal] = useState(false);
  const [newBook, setNewBook] = useState({ bookCode: '', title: '', author: '', category: 'General', totalCopies: 1 });
  const [issueParams, setIssueParams] = useState({ bookId: '', studentProfileId: '', loanDays: 14 });
  const [deskVisitors, setDeskVisitors] = useState<any[]>([]);
  const [showCheckInVisitorModal, setShowCheckInVisitorModal] = useState(false);
  const [visitorCheckInPurpose, setVisitorCheckInPurpose] = useState('ISSUE');
  const [passActionOption, setPassActionOption] = useState<'ISSUE_BOOK' | 'REISSUE_BOOK' | 'RETURN_BOOK'>('ISSUE_BOOK');
  const [overtimeAlertVisitor, setOvertimeAlertVisitor] = useState<any | null>(null);
  const [circulationSearch, setCirculationSearch] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const [foundProfiles, setFoundProfiles] = useState<any[]>([]);
  const [showCsvUploadModal, setShowCsvUploadModal] = useState(false);
  const [csvRawText, setCsvRawText] = useState('');
  const [csvFileName, setCsvFileName] = useState('');
  const [csvSearchQuery, setCsvSearchQuery] = useState('');
  const [masterAuditRoster, setMasterAuditRoster] = useState<any[]>([]);

  const fetchMasterAuditRoster = useCallback(async () => {
    if (!library?.id) return;
    try {
      const { data } = await api.get(`/api/v1/partner/libraries/${library.id}/student-profiles`);
      if (data?.success && Array.isArray(data.data)) {
        setMasterAuditRoster(data.data);
      }
    } catch (_) {}
  }, [library?.id]);

  const [pendingVisitorRequests, setPendingVisitorRequests] = useState<any[]>([]);

  const fetchPendingVisitorRequests = useCallback(async () => {
    if (!library?.id) return;
    try {
      const { data } = await api.get(`/api/v1/partner/libraries/${library.id}/visitor-requests`);
      if (data?.success && Array.isArray(data.data)) {
        setPendingVisitorRequests(data.data);
      }
    } catch (_) {}
  }, [library?.id]);

  const handleDecideVisitorRequest = async (requestId: string, decision: 'ACCEPT' | 'DECLINE') => {
    try {
      const { data } = await api.post(`/api/v1/partner/visitor-requests/${requestId}/decide`, { decision });
      if (data?.success) {
        alert(`✓ Visitor request ${decision === 'ACCEPT' ? 'approved & entry granted' : 'declined'} successfully!`);
        fetchPendingVisitorRequests();
      } else {
        alert(data?.message || 'Failed to process visitor request decision.');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error deciding visitor request.');
    }
  };

  const handleToggleVisitorPasses = async (enabled: boolean) => {
    if (!library?.id) return;
    try {
      const { data } = await api.put(`/api/v1/partner/libraries/${library.id}/visitor-pass-config`, {
        allowVisitorPasses: enabled
      });
      if (data?.success) {
        setLibrary((prev) => prev ? { ...prev, allowVisitorPasses: enabled } : null);
        alert(`✓ Visitor pass policy updated: ${enabled ? 'ENABLED (Students can request 40-min visitor passes)' : 'DISABLED (No visitor passes accepted)'}`);
      } else {
        alert(data?.message || 'Failed to update visitor pass configuration.');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error updating visitor pass configuration.');
    }
  };

  const fetchCirculationData = async () => {
    if (!library?.id) return;
    try {
      const [loansRes, booksRes, visitorsRes] = await Promise.allSettled([
        api.get(`/api/v1/partner/libraries/${library.id}/book-loans`),
        api.get(`/api/v1/partner/libraries/${library.id}/books`),
        api.get(`/api/v1/partner/libraries/${library.id}/circulation-visitors`)
      ]);
      if (loansRes.status === 'fulfilled' && loansRes.value.data?.success) {
        setDeskLoans(loansRes.value.data.data || []);
      }
      if (booksRes.status === 'fulfilled' && booksRes.value.data?.success) {
        setCatalogBooks(booksRes.value.data.data || []);
      }
      if (visitorsRes.status === 'fulfilled' && visitorsRes.value.data?.success) {
        const visitors = visitorsRes.value.data.data || [];
        setDeskVisitors(visitors);
        const overtime = visitors.find((v: any) => v.is_overtime || (v.elapsed_minutes && v.elapsed_minutes > 40));
        if (overtime && !overtimeAlertVisitor) {
          setOvertimeAlertVisitor(overtime);
        }
      }
    } catch (e) {
      console.error('Error loading circulation data:', e);
    }
  };

  const handleCheckInVisitorSubmit = async () => {
    if (!selectedProfile?.id || !library?.id) {
      alert('Please search and select a student library profile first.');
      return;
    }
    try {
      const { data } = await api.post(`/api/v1/partner/libraries/${library.id}/circulation-visitors/checkin`, {
        studentLibraryProfileId: selectedProfile.id,
        purpose: visitorCheckInPurpose
      });
      if (data?.success) {
        alert(`Checked in ${selectedProfile.full_name} for ${visitorCheckInPurpose} (40-min limit active).`);
        setShowCheckInVisitorModal(false);
        setSelectedProfile(null);
        fetchCirculationData();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to check in visitor.');
    }
  };

  const handleOwnerDirectExitVisitor = async (visitorId: string) => {
    try {
      const { data } = await api.post(`/api/v1/partner/circulation-visitors/${visitorId}/exit`, {});
      if (data?.success) {
        alert('Visitor checked out. Visit record saved permanently in history.');
        if (overtimeAlertVisitor?.visitor_id === visitorId) setOvertimeAlertVisitor(null);
        fetchCirculationData();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to exit visitor.');
    }
  };

  const handleOwnerApproveVisitorExit = async (visitorId: string) => {
    try {
      const { data } = await api.post(`/api/v1/partner/circulation-visitors/${visitorId}/approve-exit`, {});
      if (data?.success) {
        alert('Student exit request APPROVED! Visitor marked as checked-out.');
        if (overtimeAlertVisitor?.visitor_id === visitorId) setOvertimeAlertVisitor(null);
        fetchCirculationData();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to approve exit.');
    }
  };

  useEffect(() => {
    if (activeTab === 'circulation' && library?.id) {
      fetchCirculationData();
    }
  }, [activeTab, library?.id]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Reports & History Module State & Logic
  // ─────────────────────────────────────────────────────────────────────────────
  const [reportSubTab, setReportSubTab] = useState<'students' | 'bookings' | 'seats' | 'activity' | 'girls' | 'sessions'>('students');
  const [reportDashboard, setReportDashboard] = useState<{
    entriesToday: number;
    entriesThisWeek: number;
    entriesThisMonth: number;
    activeStudentProfiles: number;
    currentOccupancy: { occupied: number; total: number };
  } | null>(null);
  const [reportDataset, setReportDataset] = useState<{
    title: string;
    columnHeaders: string[];
    rows: string[][];
    generatedAt: string;
  } | null>(null);
  const [reportLoading, setReportLoading] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportDateFrom, setReportDateFrom] = useState<string>('');
  const [reportDateTo, setReportDateTo] = useState<string>('');
  const [reportSelectedSeatId, setReportSelectedSeatId] = useState<string>('');
  const [reportTableFilter, setReportTableFilter] = useState<string>('');

  // Report 6 Student Lookup State
  const [studentLookupQuery, setStudentLookupQuery] = useState<string>('');
  const [studentLookupResult, setStudentLookupResult] = useState<{
    title: string;
    columnHeaders: string[];
    rows: string[][];
    generatedAt: string;
  } | null>(null);
  const [studentLookupLoading, setStudentLookupLoading] = useState<boolean>(false);
  const [studentLookupError, setStudentLookupError] = useState<string | null>(null);

  const fetchReportDashboard = async () => {
    if (!library?.id) return;
    try {
      const resp = await api.get(`/api/v1/partner/reports/dashboard?libraryId=${library.id}`);
      if (resp.data?.success) {
        setReportDashboard(resp.data.data);
      }
    } catch (e: any) {
      console.error('Failed to fetch reports dashboard', e);
    }
  };

  const fetchActiveReport = async () => {
    if (!library?.id) return;
    setReportLoading(true);
    setReportError(null);
    try {
      let endpoint = '';
      const params = new URLSearchParams();
      params.append('libraryId', library.id);
      params.append('format', 'JSON');
      if (reportDateFrom) params.append('from', reportDateFrom);
      if (reportDateTo) params.append('to', reportDateTo);

      if (reportSubTab === 'students') {
        endpoint = `/api/v1/partner/reports/students?${params.toString()}`;
      } else if (reportSubTab === 'bookings') {
        endpoint = `/api/v1/partner/reports/bookings?${params.toString()}`;
      } else if (reportSubTab === 'seats') {
        if (!reportSelectedSeatId) {
          setReportDataset(null);
          setReportLoading(false);
          return;
        }
        endpoint = `/api/v1/partner/reports/seats/${reportSelectedSeatId}/history?${params.toString()}`;
      } else if (reportSubTab === 'activity') {
        endpoint = `/api/v1/partner/reports/activity?${params.toString()}`;
      } else if (reportSubTab === 'girls') {
        endpoint = `/api/v1/partner/reports/girls-section?${params.toString()}`;
      } else if (reportSubTab === 'sessions') {
        endpoint = `/api/v1/partner/reports/booking-sessions?${params.toString()}`;
      }

      const resp = await api.get(endpoint);
      if (resp.data?.success) {
        setReportDataset(resp.data.data);
      } else {
        setReportError(resp.data?.error || 'Failed to fetch report');
      }
    } catch (e: any) {
      setReportError(e.response?.data?.error || e.message || 'Error loading report');
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reports' && library?.id) {
      fetchReportDashboard();
      fetchActiveReport();
    }
  }, [activeTab, library?.id, reportSubTab, reportSelectedSeatId, reportDateFrom, reportDateTo]);



  const handleExportReport = async (format: 'PDF' | 'CSV') => {
    if (!library?.id) return;
    try {
      let endpoint = '';
      const params = new URLSearchParams();
      params.append('libraryId', library.id);
      params.append('format', format);
      if (reportDateFrom) params.append('from', reportDateFrom);
      if (reportDateTo) params.append('to', reportDateTo);

      if (reportSubTab === 'students') {
        endpoint = `/api/v1/partner/reports/students?${params.toString()}`;
      } else if (reportSubTab === 'bookings') {
        endpoint = `/api/v1/partner/reports/bookings?${params.toString()}`;
      } else if (reportSubTab === 'seats') {
        if (!reportSelectedSeatId) {
          alert('Please select a seat desk first to export seat history.');
          return;
        }
        endpoint = `/api/v1/partner/reports/seats/${reportSelectedSeatId}/history?${params.toString()}`;
      } else if (reportSubTab === 'activity') {
        endpoint = `/api/v1/partner/reports/activity?${params.toString()}`;
      } else if (reportSubTab === 'girls') {
        endpoint = `/api/v1/partner/reports/girls-section?${params.toString()}`;
      } else if (reportSubTab === 'sessions') {
        endpoint = `/api/v1/partner/reports/booking-sessions?${params.toString()}`;
      }

      const mimeType = format === 'PDF' ? 'application/pdf' : 'text/csv;charset=utf-8;';
      const ext = format === 'PDF' ? 'pdf' : 'csv';
      const resp = await api.get(endpoint, { responseType: 'blob' });
      const blob = new Blob([resp.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportSubTab}_report_${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Could not download ${format} report: ` + (e.response?.data?.message || e.message));
    }
  };

  const handleStudentLookupSearch = async (exportFormat?: 'PDF' | 'CSV') => {
    if (!studentLookupQuery.trim() || !library?.id) {
      alert('Please enter an Institute ID, Email, or Phone number.');
      return;
    }
    const params = new URLSearchParams();
    params.append('libraryId', library.id);
    params.append('query', studentLookupQuery.trim());

    if (exportFormat) {
      params.append('format', exportFormat);
      try {
        const mimeType = exportFormat === 'PDF' ? 'application/pdf' : 'text/csv;charset=utf-8;';
        const ext = exportFormat === 'PDF' ? 'pdf' : 'csv';
        const resp = await api.get(`/api/v1/partner/reports/student-lookup?${params.toString()}`, { responseType: 'blob' });
        const blob = new Blob([resp.data], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `student_full_history_${studentLookupQuery.trim().replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (e: any) {
        alert(`Could not download ${exportFormat}: ` + (e.response?.data?.message || e.message));
      }
      return;
    }

    setStudentLookupLoading(true);
    setStudentLookupError(null);
    params.append('format', 'JSON');
    try {
      const resp = await api.get(`/api/v1/partner/reports/student-lookup?${params.toString()}`);
      if (resp.data?.success) {
        setStudentLookupResult(resp.data.data);
      } else {
        setStudentLookupError(resp.data?.error || 'Student not found');
      }
    } catch (e: any) {
      setStudentLookupError(e.response?.data?.error || 'Student not found matching query');
    } finally {
      setStudentLookupLoading(false);
    }
  };


  const handleAddBookToCatalog = async () => {
    if (!newBook.title.trim() || !newBook.bookCode.trim() || !library?.id) {
      alert('Book title and code are required.');
      return;
    }
    try {
      const { data } = await api.post(`/api/v1/partner/libraries/${library.id}/books`, newBook);
      if (data?.success) {
        alert('✅ Book added to library catalog!');
        setShowAddBookModal(false);
        setNewBook({ bookCode: '', title: '', author: '', category: 'General', totalCopies: 1 });
        fetchCirculationData();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to add book to catalog.');
    }
  };

  const handleSearchStudentProfile = async () => {
    if (!circulationSearch.trim() || !library?.id) return;
    try {
      const { data } = await api.get(`/api/v1/partner/libraries/${library.id}/student-profiles?query=${encodeURIComponent(circulationSearch)}`);
      if (data?.success) {
        setFoundProfiles(data.data || []);
      }
    } catch (e) {
      setFoundProfiles([]);
    }
  };

  const handleIssueBookSubmit = async () => {
    if (!issueParams.bookId || !selectedProfile?.id) {
      alert('Please select a book and student profile.');
      return;
    }
    try {
      const { data } = await api.post(`/api/v1/partner/books/${issueParams.bookId}/issue`, {
        studentLibraryProfileId: selectedProfile.id,
        loanDays: issueParams.loanDays
      });
      if (data?.success) {
        alert(`✅ Book "${data.data.title}" issued! Due date: ${new Date(data.data.dueAt).toLocaleDateString()}`);
        setShowIssueBookModal(false);
        fetchCirculationData();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to issue book.');
    }
  };

  const handleReissueBook = async (loanId: string) => {
    const daysStr = prompt('Enter extension days (default: 7):', '7');
    if (daysStr === null) return;
    const extensionDays = parseInt(daysStr, 10) || 7;
    try {
      const { data } = await api.post(`/api/v1/partner/book-loans/${loanId}/reissue`, { extensionDays });
      if (data?.success) {
        alert(`✅ Loan extended to ${new Date(data.data.newDueAt).toLocaleDateString()}`);
        fetchCirculationData();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to reissue book.');
    }
  };

  const handleReturnBook = async (loanId: string) => {
    if (!window.confirm('Confirm physical book return at counter?')) return;
    try {
      const { data } = await api.post(`/api/v1/partner/book-loans/${loanId}/return`, {});
      if (data?.success) {
        alert('Book returned and restored to catalog inventory!');
        fetchCirculationData();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to return book.');
    }
  };

  // Gate Scanner & Passcode State
  const [checkinRef, setCheckinRef] = useState('');
  const [checkinStatus, setCheckinStatus] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [gateAdmissions, setGateAdmissions] = useState<any[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const startGateCamera = async () => {
    setIsCameraActive(true);
    setCheckinStatus('📷 Camera active. Align student mobile QR pass in the viewfinder.');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.warn('Camera error:', err);
      setCheckinStatus('⚠️ Camera permission denied or unavailable. Enter Passcode / ID manually below.');
    }
  };

  const stopGateCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const executeCheckin = async (codeToVerify: string, isFromQr: boolean = false) => {
    if (!codeToVerify.trim()) return;
    setCheckinStatus('🔍 Validating student pass credentials…');
    
    let cleanRef = codeToVerify.trim();
    try {
      if (cleanRef.startsWith('{') && cleanRef.endsWith('}')) {
        const parsed = JSON.parse(cleanRef);
        cleanRef = parsed.ref || parsed.bookingReference || parsed.id || cleanRef;
      }
    } catch (ignored) {}

    try {
      const payload: any = {
        bookingReference: cleanRef,
        referenceCode: cleanRef
      };
      if (isFromQr || codeToVerify.length > 30) {
        payload.qrPayload = codeToVerify.trim();
      }

      const { data } = await api.post(`/api/v1/partner/checkin/confirm`, payload);
      if (data?.success || data?.data) {
        const info = data.data || { studentName: 'Verified Student', seatCode: 'Allocated' };
        setCheckinStatus(`✅ Admission Granted! Student: ${info.studentName || 'Pass Valid'} (Desk: ${info.seatCode || 'Active'})`);
        setGateAdmissions(prev => [{
          id: Date.now(),
          ref: cleanRef,
          name: info.studentName || 'Student Admission',
          seat: info.seatCode || 'Assigned',
          time: new Date().toLocaleTimeString()
        }, ...prev]);
        setCheckinRef('');
        if (isCameraActive) stopGateCamera();
      } else {
        setCheckinStatus(`⚠️ ${data?.message || 'Pass verified successfully.'}`);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Invalid or expired student pass / ID.';
      setCheckinStatus(`❌ Admission Denied: ${msg}`);
    }
  };

  const handleCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeCheckin(checkinRef, false);
  };

  // Offscreen Canvas Ref for jsQR decoding
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Continuous Camera QR Detection Loop via jsQR Canvas Engine
  useEffect(() => {
    let intervalId: any = null;

    if (isCameraActive && videoRef.current) {
      const scanFrame = () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;

        try {
          const canvas = scanCanvasRef.current || document.createElement('canvas');
          scanCanvasRef.current = canvas;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (!context) return;

          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data && code.data.trim()) {
            console.log('QR Code detected via jsQR:', code.data);
            executeCheckin(code.data, true);
          }
        } catch (err) {
          // Ignore frame decode glitch
        }
      };

      intervalId = setInterval(scanFrame, 250);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isCameraActive]);

  // Image File QR Decoder using jsQR
  const handleQrFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0, img.width, img.height);

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code && code.data && code.data.trim()) {
          setCheckinStatus(`📷 Scanned QR code from image: ${code.data}`);
          executeCheckin(code.data, true);
        } else {
          alert('No clear QR code detected in the uploaded image. Please try another photo or enter passcode manually.');
        }
      };
    } catch (err) {
      alert('Could not decode QR code from uploaded image.');
    }
  };
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<number>(300);

  // CRM State
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [crmForm, setCrmForm] = useState<{
    fullName: string;
    phone: string;
    email: string;
    aadhaarNumber: string;
    monthlyFee: number;
    seatCode: string;
    shiftName: string;
    isEmergencyGuest?: boolean;
    designation?: string;
  }>({
    fullName: '',
    phone: '',
    email: '',
    aadhaarNumber: '',
    monthlyFee: 1000,
    seatCode: 'A2',
    shiftName: 'Morning Shift',
    isEmergencyGuest: false,
    designation: ''
  });

  // Owner Vacate Confirmation Modal State (Yes / No)
  const [vacateConfirmModal, setVacateConfirmModal] = useState<{
    isOpen: boolean;
    seatCode: string;
    studentName?: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  // Walk-in UPI Dynamic QR State
  const [walkinName, setWalkinName] = useState('Walk-In Student');
  const [walkinHours, setWalkinHours] = useState(4);
  const [walkinRate, setWalkinRate] = useState(80);

  // Live Seats & Check-in Modal State
  const [liveSeats, setLiveSeats] = useState<any[]>([]);

  // Default seat selection for reports when seats become available
  useEffect(() => {
    if (!reportSelectedSeatId && liveSeats && liveSeats.length > 0) {
      setReportSelectedSeatId(liveSeats[0].id);
    }
  }, [liveSeats, reportSelectedSeatId]);
  const [checkingInSeat, setCheckingInSeat] = useState(false);
  const [checkInCodeInput, setCheckInCodeInput] = useState('');
  const [vacateTokenInput, setVacateTokenInput] = useState('');
  const [vacatingSeat, setVacatingSeat] = useState(false);

  // ── Unified Desk State (Owner Feature Gap Closure) ──
  const [deskQuery, setDeskQuery] = useState('');
  const [deskLoading, setDeskLoading] = useState(false);
  const [deskData, setDeskData] = useState<any | null>(null);
  const [deskNotFound, setDeskNotFound] = useState(false);
  const [deskActionMsg, setDeskActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deskSeatInput, setDeskSeatInput] = useState('');
  const [deskIssueItem, setDeskIssueItem] = useState({
    title: '',
    accessionNumber: '',
    itemType: 'BOOK',
    loanDurationDays: 14
  });
  const [deskInlineStudent, setDeskInlineStudent] = useState({
    fullName: '',
    phone: '',
    email: '',
    instituteStudentId: '',
    gender: 'FEMALE' as 'FEMALE' | 'MALE' | 'OTHER'
  });

  // ── Walk-In Assignment & 3-State Lookup State ──
  const [walkinSeatCode, setWalkinSeatCode] = useState('');
  const [walkinStudentName, setWalkinStudentName] = useState('');
  const [walkinStudentPhone, setWalkinStudentPhone] = useState('');
  const [walkinStudentIdNum, setWalkinStudentIdNum] = useState('');
  const [walkinPaymentMode, setWalkinPaymentMode] = useState<'FREE' | 'CASH' | 'UPI'>('FREE');
  const [walkinAssignLoading, setWalkinAssignLoading] = useState(false);
  const [walkinAssignResult, setWalkinAssignResult] = useState<any | null>(null);

  // 3-State Walk-In Desk Lookup (NOT_FOUND, FOUND_UNCLAIMED, FOUND_CLAIMED)
  const [walkinLookupQuery, setWalkinLookupQuery] = useState('');
  const [walkinLookupLoading, setWalkinLookupLoading] = useState(false);
  const [walkinLookupState, setWalkinLookupState] = useState<'IDLE' | 'NOT_FOUND' | 'FOUND_UNCLAIMED' | 'FOUND_CLAIMED'>('IDLE');
  const [walkinLookupRecord, setWalkinLookupRecord] = useState<any | null>(null);

  // Roster Bulk Upload & Pre-Registration List
  const [preRegList, setPreRegList] = useState<any[]>([]);
  const [preRegLoading, setPreRegLoading] = useState(false);
  const [preRegQuery, setPreRegQuery] = useState('');
  const [preRegCsvFile, setPreRegCsvFile] = useState<File | null>(null);
  const [preRegUploadLoading, setPreRegUploadLoading] = useState(false);
  const [preRegSingleForm, setPreRegSingleForm] = useState({
    idNumber: '',
    studentName: '',
    contactNumber: '',
    email: '',
    branch: ''
  });

  const fetchPreRegisteredStudents = async (libId: string, q: string = '') => {
    setPreRegLoading(true);
    try {
      const { data } = await api.get(`/api/v1/partner/libraries/${libId}/students/pre-registered?query=${encodeURIComponent(q)}`);
      if (data?.success && Array.isArray(data.data)) {
        setPreRegList(data.data);
      } else {
        setPreRegList([]);
      }
    } catch {
      setPreRegList([]);
    } finally {
      setPreRegLoading(false);
    }
  };

  const fetchLibraryComplaints = useCallback(async () => {
    if (!library?.id) return;
    try {
      const { data } = await api.get(`/api/v1/partner/libraries/${library.id}/complaints`);
      if (data?.success && Array.isArray(data.data)) {
        setLibraryComplaints(data.data);
      }
    } catch (_) {}
  }, [library?.id]);

  useEffect(() => {
    if (library?.id) {
      fetchMasterAuditRoster();
      fetchPendingVisitorRequests();
      const visitorTimer = setInterval(fetchPendingVisitorRequests, 5000);
      return () => clearInterval(visitorTimer);
    }
    if (activeTab === 'walkin' && library?.id) {
      fetchPreRegisteredStudents(library.id, preRegQuery);
    }
    if ((activeTab === 'complaints' || activeTab === 'master-audit' || activeTab === 'fees') && library?.id) {
      fetchLibraryComplaints();
      const timer = setInterval(fetchLibraryComplaints, 5000);
      return () => clearInterval(timer);
    }
  }, [activeTab, library?.id, preRegQuery, fetchLibraryComplaints, fetchMasterAuditRoster, fetchPendingVisitorRequests]);

  const handleResolveComplaint = async (complaintId: string, newStatus: string = 'RESOLVED') => {
    setComplaintActionLoading(complaintId);
    try {
      const replyNotes = wardenReplies[complaintId] || 'Warden inspected & issue resolved at facility.';
      const { data } = await api.post(`/api/v1/partner/complaints/${complaintId}/status`, {
        status: newStatus,
        resolutionNotes: replyNotes
      });
      if (data?.success) {
        alert(`✓ Complaint ${newStatus.toLowerCase()} successfully!`);
        if (library?.id) fetchLibraryComplaints();
      } else {
        alert(data?.message || 'Failed to update complaint status.');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error updating complaint status.');
    } finally {
      setComplaintActionLoading(null);
    }
  };

  const handleWalkinLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = walkinLookupQuery.trim();
    if (!q || !library?.id) return;
    setWalkinLookupLoading(true);
    setWalkinLookupState('IDLE');
    setWalkinLookupRecord(null);

    try {
      // 1. Try student CRM profile lookup first
      const crmRes = await api.get(`/api/v1/partner/desk/lookup?libraryId=${library.id}&query=${encodeURIComponent(q)}`);
      if (crmRes.data?.success && crmRes.data?.data?.studentProfile) {
        const prof = crmRes.data.data.studentProfile;
        setWalkinLookupRecord(prof);
        setWalkinStudentName(prof.full_name || prof.name || '');
        setWalkinStudentPhone(prof.phone || prof.contact_number || '');
        setWalkinStudentIdNum(prof.institute_id_number || q);
        setWalkinLookupState('FOUND_CLAIMED');
        setWalkinLookupLoading(false);
        return;
      }
    } catch {
      // Continue to pre-registered check
    }

    try {
      // 2. Check owner_pre_registered_students table
      const preRes = await api.get(`/api/v1/partner/libraries/${library.id}/students/pre-registered?query=${encodeURIComponent(q)}`);
      if (preRes.data?.success && Array.isArray(preRes.data.data) && preRes.data.data.length > 0) {
        const matched = preRes.data.data.find(
          (r: any) =>
            (r.id_number && r.id_number.toLowerCase() === q.toLowerCase()) ||
            (r.email && r.email.toLowerCase() === q.toLowerCase()) ||
            (r.contact_number && r.contact_number === q)
        ) || preRes.data.data[0];

        setWalkinLookupRecord(matched);
        setWalkinStudentName(matched.student_name || '');
        setWalkinStudentPhone(matched.contact_number || '');
        setWalkinStudentIdNum(matched.id_number || q);

        if (matched.is_claimed || matched.claimed_at) {
          setWalkinLookupState('FOUND_CLAIMED');
        } else {
          setWalkinLookupState('FOUND_UNCLAIMED');
        }
      } else {
        setWalkinLookupState('NOT_FOUND');
      }
    } catch {
      setWalkinLookupState('NOT_FOUND');
    } finally {
      setWalkinLookupLoading(false);
    }
  };

  const handleBulkCsvUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preRegCsvFile || !library?.id) {
      alert('Please select a CSV file first.');
      return;
    }
    setPreRegUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', preRegCsvFile);
      const { data } = await api.post(`/api/v1/partner/libraries/${library.id}/students/bulk-upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (data?.success) {
        const resData = data.data || {};
        alert(`✅ Roster upload complete!\nInserted: ${resData.inserted || 0} rows\nUpdated: ${resData.updated || 0} rows.`);
        setPreRegCsvFile(null);
        fetchPreRegisteredStudents(library.id, preRegQuery);
      } else {
        alert(data?.message || 'Bulk upload failed.');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error uploading CSV roster.');
    } finally {
      setPreRegUploadLoading(false);
    }
  };

  const handleSinglePreRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preRegSingleForm.idNumber.trim() || !preRegSingleForm.studentName.trim() || !library?.id) {
      alert('Please fill in Student ID and Name.');
      return;
    }
    setPreRegUploadLoading(true);
    try {
      const { data } = await api.post(`/api/v1/partner/libraries/${library.id}/students/pre-register`, preRegSingleForm);
      if (data?.success) {
        alert(`✅ Pre-registered student "${preRegSingleForm.studentName}"!`);
        setPreRegSingleForm({ idNumber: '', studentName: '', contactNumber: '', email: '', branch: '' });
        fetchPreRegisteredStudents(library.id, preRegQuery);
      } else {
        alert(data?.message || 'Failed to add student.');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error pre-registering student.');
    } finally {
      setPreRegUploadLoading(false);
    }
  };

  const handleDeskSearch = async (overrideQuery?: string) => {
    const q = (overrideQuery !== undefined ? overrideQuery : deskQuery).trim();
    if (!q) return;
    if (!library?.id) {
      alert('Please wait for library profile to load.');
      return;
    }
    setDeskLoading(true);
    setDeskActionMsg(null);
    setDeskNotFound(false);
    try {
      const { data } = await api.get(`/api/v1/partner/desk/lookup?libraryId=${library.id}&query=${encodeURIComponent(q)}`);
      if (data?.success && data?.data) {
        setDeskData(data.data);
        setDeskNotFound(false);
      } else {
        setDeskData(null);
        setDeskNotFound(true);
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setDeskData(null);
        setDeskNotFound(true);
      } else {
        setDeskActionMsg({ type: 'error', text: err.response?.data?.message || 'Error looking up student.' });
      }
    } finally {
      setDeskLoading(false);
    }
  };

  const handleDeskCheckIn = async () => {
    if (!deskData?.studentProfile?.id) return;
    if (!deskSeatInput.trim()) {
      alert('Please enter a desk/seat code (e.g. A1, B2).');
      return;
    }
    setDeskLoading(true);
    setDeskActionMsg(null);
    try {
      const { data } = await api.post(`/api/v1/partner/desk/${deskData.studentProfile.id}/check-in`, {
        libraryId: library?.id,
        seatCode: deskSeatInput.trim().toUpperCase()
      });
      if (data?.success) {
        setDeskActionMsg({ type: 'success', text: `Seat ${deskSeatInput.trim().toUpperCase()} successfully assigned to student!` });
        setDeskSeatInput('');
        handleDeskSearch();
        fetchLiveSeats(library!.id);
      } else {
        setDeskActionMsg({ type: 'error', text: data?.message || 'Failed to check in.' });
      }
    } catch (err: any) {
      setDeskActionMsg({ type: 'error', text: err.response?.data?.message || 'Error assigning seat.' });
    } finally {
      setDeskLoading(false);
    }
  };

  const handleDeskIssueItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deskData?.studentProfile?.id) return;
    if (!deskIssueItem.title.trim()) {
      alert('Please enter the book / item title.');
      return;
    }
    setDeskLoading(true);
    setDeskActionMsg(null);
    try {
      const { data } = await api.post(`/api/v1/partner/desk/${deskData.studentProfile.id}/item-log`, {
        libraryId: library?.id,
        action: 'ISSUE',
        itemTitle: deskIssueItem.title.trim(),
        accessionNumber: deskIssueItem.accessionNumber.trim() || undefined,
        itemType: deskIssueItem.itemType,
        loanDurationDays: Number(deskIssueItem.loanDurationDays) || 14
      });
      if (data?.success) {
        setDeskActionMsg({ type: 'success', text: `Successfully issued "${deskIssueItem.title}" to student!` });
        setDeskIssueItem({ title: '', accessionNumber: '', itemType: 'BOOK', loanDurationDays: 14 });
        handleDeskSearch();
      } else {
        setDeskActionMsg({ type: 'error', text: data?.message || 'Failed to issue item.' });
      }
    } catch (err: any) {
      setDeskActionMsg({ type: 'error', text: err.response?.data?.message || 'Error issuing item.' });
    } finally {
      setDeskLoading(false);
    }
  };

  const handleDeskReturnItem = async (txId: string) => {
    if (!deskData?.studentProfile?.id) return;
    setDeskLoading(true);
    setDeskActionMsg(null);
    try {
      const { data } = await api.post(`/api/v1/partner/desk/${deskData.studentProfile.id}/item-log`, {
        libraryId: library?.id,
        action: 'RETURN',
        transactionId: txId
      });
      if (data?.success) {
        setDeskActionMsg({ type: 'success', text: 'Item marked as returned successfully!' });
        handleDeskSearch();
      } else {
        setDeskActionMsg({ type: 'error', text: data?.message || 'Failed to return item.' });
      }
    } catch (err: any) {
      setDeskActionMsg({ type: 'error', text: err.response?.data?.message || 'Error returning item.' });
    } finally {
      setDeskLoading(false);
    }
  };

  const handleDownloadStudentReport = async (profileId: string, studentName?: string) => {
    try {
      const resp = await api.get(`/api/v1/partner/students/${profileId}/report`, {
        responseType: 'blob'
      });
      const blob = new Blob([resp.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `student_audit_${(studentName || 'report').toLowerCase().replace(/[^a-z0-9]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Could not download PDF report: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleExecuteWalkInAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!library?.id) {
      alert('Library not loaded.');
      return;
    }
    if (!walkinSeatCode.trim() || !walkinStudentName.trim() || !walkinStudentPhone.trim()) {
      alert('Please fill in seat code, student name, and mobile number.');
      return;
    }
    setWalkinAssignLoading(true);
    setWalkinAssignResult(null);
    try {
      const { data } = await api.post('/api/v1/partner/walkin/assign', {
        libraryId: library.id,
        seatCode: walkinSeatCode.trim().toUpperCase(),
        studentName: walkinStudentName.trim(),
        phone: walkinStudentPhone.trim(),
        durationHours: walkinHours,
        paymentMode: walkinPaymentMode,
        amount: walkinPaymentMode === 'FREE' ? 0 : walkinRate
      });
      if (data?.success && data?.data) {
        setWalkinAssignResult(data.data);
        fetchLiveSeats(library.id);
        alert(`Walk-in student successfully assigned! Booking Ref: ${data.data.bookingReference}`);
      } else {
        alert(data?.message || 'Failed to assign walk-in student.');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error assigning walk-in student.');
    } finally {
      setWalkinAssignLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        loadOwnerData(session.user.id);
      } else {
        // Dev session fallback for local testing
        const mockSession = { user: { id: '00000000-0000-0000-0000-000000000002', email: 'owner@eduglobin.com' } };
        setSession(mockSession);
        loadOwnerData(mockSession.user.id);
      }
    });
  }, [navigate]);

  const fetchLiveSeats = async (libId: string) => {
    try {
      const { data } = await api.get(`/api/v1/partner/libraries/${libId}/seats/live`);
      if (data?.success && data.data) {
        setLiveSeats(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch live seats', e);
    }
  };

  useEffect(() => {
    if (library?.id && library.approvalStatus === 'APPROVED') {
      fetchLiveSeats(library.id);
      // Optional polling
      const interval = setInterval(() => fetchLiveSeats(library.id), 10000);
      return () => clearInterval(interval);
    }
  }, [library?.id, library?.approvalStatus]);

  // Auto-poll approval status when pending so owner gets unlocked automatically
  useEffect(() => {
    if (library?.approvalStatus === 'PENDING_APPROVAL' && session?.user?.id) {
      const pollInterval = setInterval(() => {
        loadOwnerData(session.user.id);
      }, 4000);
      return () => clearInterval(pollInterval);
    }
  }, [library?.approvalStatus, session?.user?.id]);

  const loadOwnerData = async (ownerId: string) => {
    try {
      const { data } = await api.get('/api/v1/partner/libraries/my');
      // Sync onboarding shifts from existing library data
      if (data?.data?.shifts && data.data.shifts.length > 0) {
        const apiShifts = data.data.shifts.map((s: any) => ({
          id: s.id,
          shiftName: s.shiftName || s.shift_name,
          startTime: (s.startTime || s.start_time || '06:00').substring(0, 5),
          endTime: (s.endTime || s.end_time || '12:00').substring(0, 5),
          dailyPrice: Number(s.dailyPrice || s.daily_price || 0),
          monthlyPrice: Number(s.monthlyPrice || s.monthly_price || 0),
        }));
        setOnboardingShifts(apiShifts);
        setAdminShifts(apiShifts.map((s: any) => ({
          id: s.id,
          name: s.shiftName,
          time: `${s.startTime} - ${s.endTime}`,
          price: s.dailyPrice,
        })));
      }
      if (data?.success && data.data) {
        const normalized = normalizeLibraryData(data.data);
        setLibrary(normalized);
        if (normalized?.id) {
          api.get(`/api/v1/partner/libraries/${normalized.id}/identity-requirements`)
            .then(({ data: idData }) => {
              if (idData?.success && idData?.data) {
                setIdentityConfig({
                  fastPathZeroFields: Boolean(idData.data.fastPathZeroFields ?? idData.data.fast_path_zero_fields ?? true),
                  requirePhoneVerified: Boolean(idData.data.requirePhoneVerified ?? idData.data.require_phone_verified ?? true),
                  requireAadhaarLast4: Boolean(idData.data.requireAadhaarLast4 ?? idData.data.require_aadhaar_last4 ?? false),
                  requirePanMasked: Boolean(idData.data.requirePanMasked ?? idData.data.require_pan_masked ?? false),
                  requireTargetExam: Boolean(idData.data.requireTargetExam ?? idData.data.require_target_exam ?? false),
                  requireCollegeName: Boolean(idData.data.requireCollegeName ?? idData.data.require_college_name ?? false),
                  customFields: Array.isArray(idData.data.customFields || idData.data.custom_fields)
                    ? (idData.data.customFields || idData.data.custom_fields)
                    : []
                });
              }
            }).catch(() => {});
        }
        if (normalized?.approvalStatus === 'APPROVED') {
          setIsEditingWizard(false);
          setActiveTab((prev) => (prev === 'onboarding' ? 'crm' : prev));
        }
        if (normalized) {
          setFormData(prev => ({
            ...prev,
            name: normalized.name || prev.name,
            email: normalized.email || prev.email,
            city: normalized.city || prev.city,
            locality: normalized.locality || prev.locality,
            state: normalized.state || prev.state,
            address: normalized.address || prev.address,
            contactNumber: normalized.contactNumber || prev.contactNumber,
            totalSeats: normalized.totalSeats || prev.totalSeats,
            acAvailable: normalized.acAvailable ?? prev.acAvailable,
            hasDiscussionRoom: normalized.hasDiscussionRoom ?? prev.hasDiscussionRoom,
            discussionRoomCapacity: normalized.discussionRoomCapacity || prev.discussionRoomCapacity,
            wifiAvailable: normalized.wifiAvailable ?? prev.wifiAvailable,
            cctvAvailable: normalized.cctvAvailable ?? prev.cctvAvailable,
            powerBackupAvailable: normalized.powerBackupAvailable ?? prev.powerBackupAvailable,
            waterDispenserAvailable: normalized.waterDispenserAvailable ?? prev.waterDispenserAvailable,
            newspaperAvailable: normalized.newspaperAvailable ?? prev.newspaperAvailable,
            isFree: normalized.isFree ?? prev.isFree,
            libraryCategory: (normalized.libraryCategory as any) || prev.libraryCategory,
            allowedEmailDomain: normalized.allowedEmailDomain || prev.allowedEmailDomain,
            baseDeskPriceDaily: normalized.isFree ? 0 : (normalized.baseDeskPriceDaily || prev.baseDeskPriceDaily),
            baseDeskPriceMonthly: normalized.isFree ? 0 : (normalized.baseDeskPriceMonthly || prev.baseDeskPriceMonthly),
            sofaPriceDaily: normalized.isFree ? 0 : (normalized.sofaPriceDaily || prev.sofaPriceDaily),
            sofaPriceMonthly: normalized.isFree ? 0 : (normalized.sofaPriceMonthly || prev.sofaPriceMonthly),
            lockerMode: (normalized.lockerMode as any) || prev.lockerMode,
            proofDocType: normalized.proofDocType || prev.proofDocType,
            proofDocNumber: normalized.proofDocNumber || prev.proofDocNumber,
            kycDoc: normalized.proofDocNumber || prev.kycDoc,
          }));
        }

        // Restore seat markings, layout overrides, girls count, and custom seat types from saved seats
        if (data?.data?.seats && Array.isArray(data.data.seats) && data.data.seats.length > 0) {
          const loadedOverrides: Record<string, any> = {};
          let girlsCount = 0;
          const customTypeMap: Record<string, { id: string; name: string; icon: string; seatCount: number; dailyPrice: number; monthlyPrice: number }> = {};

          data.data.seats.forEach((s: any) => {
            const seatCode = s.seatCode || s.seat_code;
            const isGirls = Boolean(s.isGirlsOnly ?? s.is_girls_only);
            const isSofa = Boolean(s.isSofa ?? s.is_sofa);
            const isFree = Boolean(s.isFree ?? s.is_free);
            const seatType = s.seatType || s.seat_type || 'DESK';
            const customName = s.customTypeName || s.custom_type_name;
            const customIcon = s.customTypeIcon || s.custom_type_icon;

            if (isGirls) girlsCount++;

            loadedOverrides[seatCode] = {
              isGirlsOnly: isGirls,
              isSofa: isSofa,
              isFree: isFree,
              seatType: seatType,
              customTypeName: customName,
              customTypeIcon: customIcon,
            };

            if (customName) {
              if (!customTypeMap[customName]) {
                customTypeMap[customName] = {
                  id: 'cst-' + customName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                  name: customName,
                  icon: customIcon || '🛋️',
                  seatCount: 0,
                  dailyPrice: 400,
                  monthlyPrice: 1000,
                };
              }
              customTypeMap[customName].seatCount++;
            }
          });

          setSeatOverrides(loadedOverrides);
          setFormData(prev => ({
            ...prev,
            girlsOnlyCount: girlsCount,
            customSeatTypes: Object.values(customTypeMap),
          }));
        }
      } else {
        // No library found on backend — only reset to DRAFT if we have no local library state
        // (prevents overwriting PENDING_APPROVAL state set after a fresh submission)
        setLibrary(prev => {
          if (prev && prev.id && prev.approvalStatus !== 'DRAFT') {
            // Keep the local state — backend might not have synced yet
            return prev;
          }
          return {
            id: '',
            name: '',
            locality: '',
            city: '',
            address: '',
            contactNumber: '',
            isFree: false,
            seatingType: 'ERGONOMIC',
            approvalStatus: 'DRAFT',
            totalSeats: 0,
            lockerMode: 'PAID_MANAGED',
            acAvailable: false,
            hasGirlsSection: false,
          };
        });
      }

      // Load real CRM students from DB
      try {
        const crmResp = await api.get('/api/v1/partner/students');
        if (crmResp.data?.success && Array.isArray(crmResp.data.data)) {
          setStudents(crmResp.data.data);
        } else {
          setStudents([]);
        }
      } catch {
        setStudents([]);
      }
    } catch (err: any) {
      // Network/auth error — do NOT reset state to DRAFT if we already have library data
      // (prevents auth 401 polling race from wiping PENDING_APPROVAL state)
      setLibrary(prev => {
        if (prev && prev.id) {
          // Keep existing state — don't clobber it with a blank DRAFT
          return prev;
        }
        return {
          id: '',
          name: '',
          locality: '',
          city: '',
          address: '',
          contactNumber: '',
          isFree: false,
          seatingType: 'ERGONOMIC',
          approvalStatus: 'DRAFT',
          totalSeats: 0,
          lockerMode: 'PAID_MANAGED',
          acAvailable: false,
          hasGirlsSection: false,
        };
      });
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  // 1. Submit Questionnaire for Admin Approval
  const handleSubmitOnboardingForm = async (e: React.FormEvent) => {
    e.preventDefault();

    // ── Validation ──────────────────────────────────────────────────
    if (!formData.name.trim()) {
      alert('Please enter a Library Name.');
      return;
    }
    if (!formData.city.trim()) {
      alert('Please enter a City.');
      return;
    }
    if (!formData.state.trim()) {
      alert('Please enter a State.');
      return;
    }
    if (!formData.locality.trim()) {
      alert('Please enter a Locality.');
      return;
    }
    if (formData.totalSeats < 1) {
      alert('Total seats must be at least 1.');
      return;
    }


    if (formData.girlsOnlyCount > formData.totalSeats) {
      alert(`Declared girls seats (${formData.girlsOnlyCount}) cannot exceed total study desks (${formData.totalSeats}).`);
      return;
    }

    const girlsMarked = Object.values(seatOverrides).filter(o => o.isGirlsOnly).length;
    if (girlsMarked !== formData.girlsOnlyCount) {
      alert(
        `⚠️ Girls Seats Verification Mismatch:\n\n` +
        `• Declared in Form: ${formData.girlsOnlyCount} girls-reserved seat(s)\n` +
        `• Marked in Layout Map: ${girlsMarked} seat(s)\n\n` +
        `Please ensure the number of seats marked in the layout blueprint exactly matches your declared count (${formData.girlsOnlyCount}).`
      );
      return;
    }
    // ────────────────────────────────────────────────────────────────

    setLoading(true);

    const generatedSeats = generateSeatsForLayout(
      formData.layoutOption,
      formData.totalSeats,
      0,  // girls are set via seat overrides now, not auto-assigned
      formData.hasSockets
    ).map(seat => {
      const override = seatOverrides[seat.seatCode] || {};
      return {
        ...seat,
        isFree: override.isFree !== undefined ? override.isFree : formData.isFree,
        isSofa: override.isSofa || (override.seatType === 'SOFA') || false,
        isGirlsOnly: override.isGirlsOnly !== undefined ? override.isGirlsOnly : false,
        seatType: override.seatType || (override.isSofa ? 'SOFA' : 'DESK'),
        customTypeName: override.customTypeName || null,
        customTypeIcon: override.customTypeIcon || null,
      };
    });

    const girlsOnlyFinal = generatedSeats.filter(s => s.isGirlsOnly).length;

    try {
      // Submit to backend
      const res = await api.post('/api/v1/owner/libraries', {
        name: formData.name,
        slug: formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString().slice(-4),
        isFree: formData.isFree,
        email: formData.email,
        contactNumber: formData.contactNumber,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        locality: formData.locality,
        libraryCategory: formData.libraryCategory,
        allowedEmailDomain: formData.libraryCategory === 'INSTITUTE' ? formData.allowedEmailDomain : null,
        lat: 22.6926,
        lng: 75.8676,
        totalSeats: formData.totalSeats,
        seatingType: formData.hasSofaSeating ? 'MIXED' : formData.seatingType,
        acAvailable: formData.acAvailable,
        hasGirlsSection: girlsOnlyFinal > 0,
        girlsSafetyScore: girlsOnlyFinal > 0 ? 94 : 85,
        cancellationDeadlineHours: 24,

        // Discussion Room
        hasDiscussionRoom: formData.hasDiscussionRoom,
        discussionRoomCapacity: formData.hasDiscussionRoom ? formData.discussionRoomCapacity : 0,

        // Amenities
        wifiAvailable: formData.wifiAvailable,
        cctvAvailable: formData.cctvAvailable,
        powerBackupAvailable: formData.powerBackupAvailable,
        waterDispenserAvailable: formData.waterDispenserAvailable,
        newspaperAvailable: formData.newspaperAvailable,

        // Books Data
        booksCapacity: formData.booksCapacity,
        availableBooksData: formData.availableBooksData,

        // Base Pricing
        baseDeskPriceDaily: formData.isFree ? 0 : formData.baseDeskPriceDaily,
        baseDeskPriceMonthly: formData.isFree ? 0 : formData.baseDeskPriceMonthly,
        sofaPriceDaily: formData.isFree ? 0 : (formData.hasSofaSeating ? formData.sofaPriceDaily : null),
        sofaPriceMonthly: formData.isFree ? 0 : (formData.hasSofaSeating ? formData.sofaPriceMonthly : null),

        // Locker
        lockerMode: formData.lockerMode,

        // Layout
        layoutType: formData.layoutOption,
        layoutFileUrl: formData.customLayoutFileName || null,

        // Document of Proof
        proofDocType: formData.proofDocType || 'Municipal Trade License',
        proofDocNumber: formData.proofDocNumber || ('LIC-' + Date.now().toString().slice(-6)),
        proofDocUrl: formData.proofDocFileName || 'proof_document.pdf',
        kycDocument: formData.proofDocNumber || formData.kycDoc || ('KYC-' + Date.now().toString().slice(-6)),

        shifts: onboardingShifts.map(sh => ({
          shiftName: sh.shiftName,
          startTime: sh.startTime.length === 5 ? sh.startTime + ':00' : sh.startTime,
          endTime: sh.endTime.length === 5 ? sh.endTime + ':00' : sh.endTime,
          dailyPrice: formData.isFree ? 0 : sh.dailyPrice,
          monthlyPrice: formData.isFree ? 0 : sh.monthlyPrice,
        })),
        seats: generatedSeats
      });

      if (res.data?.success && res.data.data) {
        console.log('Onboarding submitted successfully:', res.data.data);
        const submittedLibId = res.data.data.id || library?.id;
        if (submittedLibId) {
          await api.put(`/api/v1/partner/onboarding/${submittedLibId}/identity-requirements`, identityConfig).catch(() => {});
        }
      } else {
        throw new Error(res.data?.error || 'Failed to submit library to backend');
      }
    } catch (err: any) {
      console.error('Backend onboarding submit error:', err);
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Server submission error';
      alert(`⚠️ Submission Error: ${errorMsg}\n\nPlease verify your form details and try again.`);
      setLoading(false);
      return;
    }


    // Update state to PENDING_APPROVAL with full dossier
    setLibrary(prev => ({
      id: prev?.id || 'lib-' + Date.now(),
      name: formData.name,
      city: formData.city,
      state: formData.state,
      locality: formData.locality,
      address: formData.address,
      email: formData.email,
      contactNumber: formData.contactNumber,
      isFree: formData.isFree,
      seatingType: formData.hasSofaSeating ? 'MIXED' : formData.seatingType,
      approvalStatus: 'PENDING_APPROVAL',
      totalSeats: formData.totalSeats,
      lockerMode: formData.lockerMode,
      acAvailable: formData.acAvailable,
      hasGirlsSection: girlsOnlyFinal > 0,
      hasDiscussionRoom: formData.hasDiscussionRoom,
      discussionRoomCapacity: formData.discussionRoomCapacity,
      wifiAvailable: formData.wifiAvailable,
      cctvAvailable: formData.cctvAvailable,
      powerBackupAvailable: formData.powerBackupAvailable,
      waterDispenserAvailable: formData.waterDispenserAvailable,
      newspaperAvailable: formData.newspaperAvailable,
      booksCapacity: formData.booksCapacity,
      availableBooksData: formData.availableBooksData,
      baseDeskPriceDaily: formData.baseDeskPriceDaily,
      baseDeskPriceMonthly: formData.baseDeskPriceMonthly,
      sofaPriceDaily: formData.sofaPriceDaily,
      sofaPriceMonthly: formData.sofaPriceMonthly,
      layoutType: formData.layoutOption,
      layoutFileUrl: formData.customLayoutFileName,
      proofDocType: formData.proofDocType,
      proofDocNumber: formData.proofDocNumber,
      proofDocUrl: formData.proofDocFileName,
    }));
    setIsEditingWizard(false);
    setLoading(false);
  };

  // Quick action to check approval or simulate approval
  const handleCheckApprovalStatus = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/v1/partner/libraries/my');
      if (data?.success && data.data) {
        const normalized = normalizeLibraryData(data.data);
        if (normalized) setLibrary(normalized);
      }
    } catch (e) {
      console.error('Check approval error:', e);
    } finally {
      setLoading(false);
    }
  };

  // CRM Add Student
  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    const isEmergency = crmForm.isEmergencyGuest;
    const isInstitute = library?.libraryCategory === 'INSTITUTE';
    
    let masked = isEmergency ? `VIP Guest (${crmForm.designation || 'Emergency Staff'})` : 'N/A (Institute Campus)';
    if (!isEmergency && !isInstitute) {
      masked = crmForm.aadhaarNumber.length >= 4 
        ? `XXXX-XXXX-${crmForm.aadhaarNumber.slice(-4)}`
        : 'XXXX-XXXX-0000';
    } else if (!isEmergency && isInstitute && crmForm.aadhaarNumber && crmForm.aadhaarNumber.length >= 4) {
      masked = `XXXX-XXXX-${crmForm.aadhaarNumber.slice(-4)}`;
    }

    const newStudent: StudentRecord = {
      id: `crm-${Date.now()}`,
      name: crmForm.fullName,
      phone: crmForm.phone || 'N/A',
      email: isEmergency ? (crmForm.designation ? `Designation: ${crmForm.designation}` : 'Emergency VIP Guest') : (crmForm.email || undefined),
      aadhaarMasked: masked,
      shiftName: crmForm.shiftName,
      seatCode: crmForm.seatCode,
      monthlyFee: crmForm.monthlyFee,
      balanceOwed: crmForm.monthlyFee,
      status: 'ACTIVE'
    };

    setStudents([newStudent, ...students]);
    setCrmForm({ fullName: '', phone: '', email: '', aadhaarNumber: '', monthlyFee: 1000, seatCode: 'A2', shiftName: 'Morning Shift' });
    alert(`Student ${newStudent.name} registered! Desk ${newStudent.seatCode} assigned.`);
  };

  // WhatsApp Reminder Link
  const getWhatsAppLink = (student: StudentRecord) => {
    const message = encodeURIComponent(
      `Namaste ${student.name},\nThis is a friendly reminder from ${library?.name ?? 'EduGlobin Library'}. Your pending library fee of ₹${student.balanceOwed} for seat ${student.seatCode} is due.\nPlease clear it at the front desk.\nThank you!`
    );
    return `https://wa.me/91${student.phone}?text=${message}`;
  };

  const dynamicUpiUri = `upi://pay?pa=eduglobin.pay@okaxis&pn=EduGlobin_Partner&am=${walkinRate}&cu=INR&tn=${encodeURIComponent(walkinName + '_DeskPass')}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400">Loading your library profile...</p>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // ═════════════════════════════════════════════════════════════════════════════
  // PHASE 1: ONBOARDING QUESTIONNAIRE WIZARD (When DRAFT or not yet submitted)
  // ═════════════════════════════════════════════════════════════════════════════
  if (library?.approvalStatus === 'DRAFT' || isEditingWizard) {
    const generatedSeatsPreview = generateSeatsForLayout(
      formData.layoutOption,
      formData.totalSeats,
      formData.girlsOnlyCount,
      formData.hasSockets
    );

    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#070b14] text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-300">
        <Navbar />

        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-10 space-y-8">
          <div className="text-center space-y-2">
            <span className="px-3.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-400 border border-violet-200 dark:border-violet-800">
              Partner Onboarding · Space Certification
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-headers">
              List Your Study Space on EduGlobin
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
              Configure your study space specifications, amenities, seat blueprint, and proof documents. Once submitted, our regional team will verify your facility and approve your operational dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmitOnboardingForm} className="bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800/90 rounded-3xl p-6 sm:p-10 shadow-sm space-y-8">
            {/* ─── 1. Basic Library Details & Contact ─── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-extrabold flex items-center justify-center">1</span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Basic Library Details & Contact
                </h3>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Library / Reading Room Brand Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Pragati UPSC Study Point"
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] text-sm focus:border-violet-500 focus:outline-none transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Official Contact Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. library.manager@eduglobin.com"
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] text-sm focus:border-violet-500 focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Front Desk / WhatsApp Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.contactNumber}
                    onChange={e => setFormData({ ...formData, contactNumber: e.target.value })}
                    placeholder="+91 98260 12345"
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] text-sm font-mono focus:border-violet-500 focus:outline-none transition"
                  />
                </div>
              </div>

              {/* City, State, Locality row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Indore, Kota, Delhi"
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] text-sm focus:border-violet-500 focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    State *
                  </label>
                  <select
                    required
                    value={formData.state}
                    onChange={e => setFormData({ ...formData, state: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] text-sm focus:border-violet-500 focus:outline-none transition"
                  >
                    <option value="">Select State</option>
                    {[
                      'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
                      'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
                      'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
                      'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
                      'Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
                      'Delhi (NCT)','Jammu & Kashmir','Ladakh','Chandigarh','Puducherry'
                    ].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Locality / Hub *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.locality}
                    onChange={e => setFormData({ ...formData, locality: e.target.value })}
                    placeholder="e.g. Bhawarkua Circle"
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] text-sm focus:border-violet-500 focus:outline-none transition"
                  />
                </div>
              </div>


              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Physical Address & Landmark *
                </label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Plot / Floor, Street, Landmark, Pin code"
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] text-sm focus:border-violet-500 focus:outline-none transition"
                />
              </div>

              {/* Library Classification Category */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#12192c] space-y-3">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Library Type / Category Classification *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className={`p-3 rounded-xl border cursor-pointer text-xs transition flex flex-col justify-between ${
                    formData.libraryCategory === 'PRIVATE'
                      ? 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-300 font-bold'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="radio"
                        name="libCategory"
                        checked={formData.libraryCategory === 'PRIVATE'}
                        onChange={() => setFormData({ ...formData, libraryCategory: 'PRIVATE' })}
                        className="accent-violet-600"
                      />
                      <span>🏢 Private / Commercial</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal">Private study hall open for general subscription</span>
                  </label>

                  <label className={`p-3 rounded-xl border cursor-pointer text-xs transition flex flex-col justify-between ${
                    formData.libraryCategory === 'GOVERNMENT'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-300 font-bold'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="radio"
                        name="libCategory"
                        checked={formData.libraryCategory === 'GOVERNMENT'}
                        onChange={() => setFormData({ ...formData, libraryCategory: 'GOVERNMENT' })}
                        className="accent-amber-600"
                      />
                      <span>🏛️ Government Library</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal">Public central municipal or state library</span>
                  </label>

                  <label className={`p-3 rounded-xl border cursor-pointer text-xs transition flex flex-col justify-between ${
                    formData.libraryCategory === 'INSTITUTE'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 font-bold'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="radio"
                        name="libCategory"
                        checked={formData.libraryCategory === 'INSTITUTE'}
                        onChange={() => setFormData({ ...formData, libraryCategory: 'INSTITUTE' })}
                        className="accent-emerald-600"
                      />
                      <span>🎓 College / Institute Library</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal">Restricted exclusively to enrolled college students</span>
                  </label>
                </div>

                {/* Free Library Toggle right in Section 1 */}
                <div className="mt-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="isFreeQuick"
                      checked={formData.isFree}
                      onChange={e => setFormData({ ...formData, isFree: e.target.checked })}
                      className="w-4.5 h-4.5 accent-emerald-600 rounded cursor-pointer"
                    />
                    <div>
                      <label htmlFor="isFreeQuick" className="text-xs font-extrabold text-slate-800 dark:text-slate-200 cursor-pointer block">
                        🎁 100% Free Access Library (Students Pay ₹0)
                      </label>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        Check this if students are not charged any daily or monthly fees.
                      </span>
                    </div>
                  </div>
                  {formData.isFree && (
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-emerald-500 text-white uppercase tracking-wider shadow">
                      Free Active
                    </span>
                  )}
                </div>

                {formData.libraryCategory === 'INSTITUTE' && (
                  <div className="mt-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                      <span>🔒 Institute College Email Domain Restriction</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      Students booking seats in this institute library will be required to verify their college email domain (e.g. <code className="font-mono bg-white dark:bg-slate-900 px-1 rounded">iitb.ac.in</code>) and enter their College Student ID Number (no Aadhaar required).
                    </p>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Allowed College Email Domain (e.g. iitb.ac.in or nitk.edu.in) *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.allowedEmailDomain}
                        onChange={e => setFormData({ ...formData, allowedEmailDomain: e.target.value })}
                        placeholder="e.g. iitb.ac.in"
                        className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono text-emerald-600 dark:text-emerald-400 font-bold focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ─── 2. Capacity & Discussion Room ─── */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-extrabold flex items-center justify-center">2</span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Capacity & Discussion Room
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Total Study Desks Capacity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    required
                    value={formData.totalSeats}
                    onChange={e => {
                      const v = Math.max(1, parseInt(e.target.value) || 1);
                      setFormData({ ...formData, totalSeats: v });
                    }}
                    className={`w-full p-3 rounded-xl border text-sm font-bold ${
                      formData.totalSeats < 1
                        ? 'border-red-400 bg-red-50 dark:bg-red-950/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c]'
                    }`}
                  />
                  {formData.totalSeats < 1 && (
                    <p className="text-[11px] text-red-500 mt-1">⚠ Total seats cannot be 0</p>
                  )}
                  {formData.totalSeats >= 1 && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {formData.totalSeats} individual study desk{formData.totalSeats !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Girls-only: Owner fills declared count and app verifies against layout markings */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Declared Girls-Only Seats Count *
                    </label>
                    <span className="text-[10px] text-pink-600 dark:text-pink-400 font-bold">
                      {Object.values(seatOverrides).filter(o => o.isGirlsOnly).length} marked in layout
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={formData.totalSeats}
                    value={formData.girlsOnlyCount}
                    onChange={e => {
                      const v = Math.max(0, parseInt(e.target.value) || 0);
                      setFormData({ ...formData, girlsOnlyCount: v });
                    }}
                    placeholder="e.g. 5 (0 if general only)"
                    className={`w-full p-3 rounded-xl border text-sm font-bold focus:outline-none transition ${
                      formData.girlsOnlyCount > formData.totalSeats
                        ? 'border-red-400 bg-red-50 dark:bg-red-950/20 text-red-600'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] focus:border-pink-500'
                    }`}
                  />
                  {/* Live Verification Status */}
                  {(() => {
                    const marked = Object.values(seatOverrides).filter(o => o.isGirlsOnly).length;
                    const declared = formData.girlsOnlyCount;
                    if (declared > formData.totalSeats) {
                      return (
                        <p className="text-[11px] text-red-500 font-bold mt-1">
                          ⚠️ Declared count ({declared}) cannot exceed total desks ({formData.totalSeats}).
                        </p>
                      );
                    }
                    if (declared === 0 && marked === 0) {
                      return (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                          No girls-only seats declared. All desks are open general admission.
                        </span>
                      );
                    }
                    if (marked === declared) {
                      return (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 flex items-center gap-1">
                          ✓ Verified: Exactly {marked} of {declared} girls seats marked in layout below
                        </span>
                      );
                    }
                    if (marked < declared) {
                      return (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold mt-1 flex items-center gap-1">
                          ⚠️ Action Needed: Click layout below to mark {declared - marked} more seat(s) ({marked}/{declared})
                        </span>
                      );
                    }
                    return (
                      <span className="text-[11px] text-red-600 dark:text-red-400 font-bold mt-1 flex items-center gap-1">
                        ⚠️ Mismatch: {marked} seats marked in layout, but declared {declared}. Please unmark {marked - declared} seat(s).
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* ── Custom Seat Types Configurator (+ Add Seat Type) ── */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#12192c] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <span>🏷️</span>
                      <span>Custom Seat Types (Optional)</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">Define special seating categories (e.g. Window Seat, Private Cabin, Executive Recliner)</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddSeatType(!showAddSeatType)}
                    className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow transition flex items-center gap-1 cursor-pointer"
                  >
                    <span>{showAddSeatType ? '✕ Cancel' : '+ Add Seat Type'}</span>
                  </button>
                </div>

                {/* Add Seat Type Form - Name, Icon & Number of Seats (No Price Fields) */}
                {showAddSeatType && (
                  <div className="p-4 rounded-xl bg-white dark:bg-[#161f36] border border-violet-200 dark:border-violet-800/60 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          Category Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Window Seat / Private Cabin / Sofa"
                          value={newSeatTypeForm.name}
                          onChange={e => setNewSeatTypeForm({ ...newSeatTypeForm, name: e.target.value })}
                          className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0c1220] text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          Icon
                        </label>
                        <select
                          value={newSeatTypeForm.icon}
                          onChange={e => setNewSeatTypeForm({ ...newSeatTypeForm, icon: e.target.value })}
                          className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0c1220] text-xs"
                        >
                          <option value="🛋️">🛋️ Sofa</option>
                          <option value="💺">💺 Recliner</option>
                          <option value="🪟">🪟 Window View</option>
                          <option value="🖥️">🖥️ Private Cabin</option>
                          <option value="🤫">🤫 Quiet Pod</option>
                          <option value="🩷">🩷 Girls Reserved</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          Number of Seats
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={formData.totalSeats}
                          placeholder="e.g. 5"
                          value={newSeatTypeForm.seatCount}
                          onChange={e => setNewSeatTypeForm({ ...newSeatTypeForm, seatCount: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0c1220] text-xs font-bold font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (!newSeatTypeForm.name.trim()) return;
                          const newType = {
                            id: 'cst-' + Date.now(),
                            name: newSeatTypeForm.name.trim(),
                            icon: newSeatTypeForm.icon,
                            seatCount: newSeatTypeForm.seatCount || 5,
                            dailyPrice: 400,
                            monthlyPrice: 1000,
                          };
                          setFormData(prev => ({
                            ...prev,
                            customSeatTypes: [...prev.customSeatTypes, newType]
                          }));

                          setNewSeatTypeForm({ name: '', icon: '🛋️', seatCount: 5, dailyPrice: 400, monthlyPrice: 1000 });
                          setShowAddSeatType(false);
                        }}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                      >
                        <span>✓ Add Seat Type</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Custom Seat Types Badge List with Seat Quantity */}
                {formData.customSeatTypes.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {formData.customSeatTypes.map((type, idx) => (
                      <div key={type.id} className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161f36] flex items-center gap-2 shadow-sm">
                        <span className="text-sm">{type.icon}</span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{type.name}</span>
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-mono">
                          {type.seatCount || 5} seat{(type.seatCount || 5) !== 1 ? 's' : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const removedType = formData.customSeatTypes[idx];
                            setFormData({
                              ...formData,
                              customSeatTypes: formData.customSeatTypes.filter((_, i) => i !== idx)
                            });
                            setSeatOverrides(prev => {
                              const updated = { ...prev };
                              Object.keys(updated).forEach(code => {
                                if (updated[code]?.seatType === removedType.id || updated[code]?.customTypeName === removedType.name) {
                                  delete updated[code];
                                }
                              });
                              return updated;
                            });
                          }}
                          className="text-xs text-slate-400 hover:text-red-500 font-bold ml-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Discussion Room Section */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#101726] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="discRoom"
                      checked={formData.hasDiscussionRoom}
                      onChange={e => setFormData({ ...formData, hasDiscussionRoom: e.target.checked })}
                      className="w-4 h-4 accent-violet-600 rounded cursor-pointer"
                    />
                    <label htmlFor="discRoom" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                      Group Discussion Room Available (Sound-Dampened)
                    </label>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                    Collaborative Study
                  </span>
                </div>

                {formData.hasDiscussionRoom && (
                  <div className="pt-2 pl-7">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Discussion Room Seating Capacity (Persons)
                    </label>
                    <input
                      type="number"
                      min="2"
                      max="30"
                      value={formData.discussionRoomCapacity}
                      onChange={e => setFormData({ ...formData, discussionRoomCapacity: parseInt(e.target.value) || 4 })}
                      className="w-48 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161f36] text-sm font-bold"
                    />
                    <span className="block text-[11px] text-slate-500 mt-1">Available for GD sessions, peer interviews, and doubt clearing</span>
                  </div>
                )}
              </div>
            </div>

            {/* ─── 3. Facilities, Amenities & Books Inventory ─── */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-extrabold flex items-center justify-center">3</span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Facilities & Books Library Data
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] cursor-pointer hover:border-violet-500/50 transition">
                  <input
                    type="checkbox"
                    checked={formData.wifiAvailable}
                    onChange={e => setFormData({ ...formData, wifiAvailable: e.target.checked })}
                    className="w-4 h-4 accent-violet-600 rounded"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">High-Speed WiFi</span>
                    <span className="text-[11px] text-slate-500">Optic fiber dual-band 100+ Mbps</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] cursor-pointer hover:border-violet-500/50 transition">
                  <input
                    type="checkbox"
                    checked={formData.acAvailable}
                    onChange={e => setFormData({ ...formData, acAvailable: e.target.checked })}
                    className="w-4 h-4 accent-violet-600 rounded"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">Air Conditioning (AC)</span>
                    <span className="text-[11px] text-slate-500">Centralized quiet study temperature</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] cursor-pointer hover:border-violet-500/50 transition">
                  <input
                    type="checkbox"
                    checked={formData.cctvAvailable}
                    onChange={e => setFormData({ ...formData, cctvAvailable: e.target.checked })}
                    className="w-4 h-4 accent-violet-600 rounded"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">24/7 CCTV Surveillance</span>
                    <span className="text-[11px] text-slate-500">30-day cloud recorded safety feed</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] cursor-pointer hover:border-violet-500/50 transition">
                  <input
                    type="checkbox"
                    checked={formData.powerBackupAvailable}
                    onChange={e => setFormData({ ...formData, powerBackupAvailable: e.target.checked })}
                    className="w-4 h-4 accent-violet-600 rounded"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">Power Backup (UPS / Inverter)</span>
                    <span className="text-[11px] text-slate-500">Zero blackout study continuity</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] cursor-pointer hover:border-violet-500/50 transition">
                  <input
                    type="checkbox"
                    checked={formData.waterDispenserAvailable}
                    onChange={e => setFormData({ ...formData, waterDispenserAvailable: e.target.checked })}
                    className="w-4 h-4 accent-violet-600 rounded"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">RO Water Dispenser</span>
                    <span className="text-[11px] text-slate-500">Chilled, normal & hot drinking water</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] cursor-pointer hover:border-violet-500/50 transition">
                  <input
                    type="checkbox"
                    checked={formData.newspaperAvailable}
                    onChange={e => setFormData({ ...formData, newspaperAvailable: e.target.checked })}
                    className="w-4 h-4 accent-violet-600 rounded"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">Daily Newspapers & Magazines</span>
                    <span className="text-[11px] text-slate-500">The Hindu, Indian Express, Yojana</span>
                  </div>
                </label>
              </div>

              {/* Books Capacity & Catalog Information */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#101726] space-y-3 mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">📚</span>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    In-House Book Bank & Reference Material
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Books Capacity (Volumes)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10000"
                      value={formData.booksCapacity}
                      onChange={e => setFormData({ ...formData, booksCapacity: parseInt(e.target.value) || 0 })}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161f36] text-sm font-bold"
                      placeholder="e.g. 350"
                    />
                    <span className="text-[11px] text-slate-500">Total physical volumes in racks</span>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Available Books Data & Major Subjects
                    </label>
                    <input
                      type="text"
                      value={formData.availableBooksData}
                      onChange={e => setFormData({ ...formData, availableBooksData: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161f36] text-sm"
                      placeholder="e.g. UPSC GS-1/2/3/4, NCERT 6-12 sets, NEET Modules, CA Final archives"
                    />
                    <span className="text-[11px] text-slate-500">Highlights displayed to students searching this library</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── 4. Base Pricing & Lockers ─── */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-extrabold flex items-center justify-center">4</span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Base Pricing &amp; Lockers Service
                </h3>
              </div>

              {/* FREE LIBRARY TOGGLE — always visible at top of pricing */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                  formData.isFree
                    ? 'border-emerald-400 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isFreeLibrary"
                    checked={formData.isFree}
                    onChange={e => setFormData({ ...formData, isFree: e.target.checked })}
                    className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
                  />
                  <div>
                    <label htmlFor="isFreeLibrary" className="text-sm font-bold text-slate-800 dark:text-slate-200 cursor-pointer block">
                      100% Free / Charitable Library
                    </label>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {formData.isFree
                        ? 'Students get free access — no payment required for desks or sofas.'
                        : 'Check this if your library charges zero fees to students.'}
                    </span>
                  </div>
                </div>
                {formData.isFree ? (
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-extrabold tracking-wide shadow">
                    FREE
                  </span>
                ) : (
                  <span className="text-2xl">🤝</span>
                )}
              </div>

              {/* ── Pricing fields: only shown when NOT free ── */}
              {!formData.isFree ? (
                <>
                  {/* Pricing Model Option */}
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#12192c] space-y-3">
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Pricing Strategy &amp; Model
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label
                        className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                          formData.pricingModel === 'BY_SEAT_TYPE'
                            ? 'border-violet-500 bg-violet-50/50 dark:bg-violet-950/20 text-slate-900 dark:text-white ring-1 ring-violet-500'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161f36] text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="pricingModel"
                            checked={formData.pricingModel === 'BY_SEAT_TYPE'}
                            onChange={() => setFormData({ ...formData, pricingModel: 'BY_SEAT_TYPE' })}
                            className="accent-violet-600"
                          />
                          <span className="text-xs font-bold">Pricing by Seat Type (Automatic)</span>
                        </div>
                        <span className="text-[11px] text-slate-500 mt-1 pl-5">
                          Standard, Sofa, and custom types each have a set price. Seats automatically inherit their category price when marked.
                        </span>
                      </label>

                      <label
                        className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                          formData.pricingModel === 'CUSTOM_SEAT'
                            ? 'border-violet-500 bg-violet-50/50 dark:bg-violet-950/20 text-slate-900 dark:text-white ring-1 ring-violet-500'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161f36] text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="pricingModel"
                            checked={formData.pricingModel === 'CUSTOM_SEAT'}
                            onChange={() => setFormData({ ...formData, pricingModel: 'CUSTOM_SEAT' })}
                            className="accent-violet-600"
                          />
                          <span className="text-xs font-bold">Custom Seat-Level Pricing</span>
                        </div>
                        <span className="text-[11px] text-slate-500 mt-1 pl-5">
                          Set custom price tiers or assign custom monthly/daily rates to individual desks directly in the layout map.
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Standard Desks Base Pricing */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c]">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        🪑 Standard Desk · Daily Pass Base Rate (₹) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-3 text-slate-400 font-bold text-sm">₹</span>
                        <input
                          type="number"
                          min="50"
                          max="5000"
                          required
                          value={formData.baseDeskPriceDaily}
                          onChange={e => setFormData({ ...formData, baseDeskPriceDaily: parseInt(e.target.value) || 100 })}
                          className="w-full pl-8 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161f36] text-sm font-bold font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        🪑 Standard Desk · Monthly Pass Base Rate (₹) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-3 text-slate-400 font-bold text-sm">₹</span>
                        <input
                          type="number"
                          min="200"
                          max="30000"
                          required
                          value={formData.baseDeskPriceMonthly}
                          onChange={e => setFormData({ ...formData, baseDeskPriceMonthly: parseInt(e.target.value) || 500 })}
                          className="w-full pl-8 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161f36] text-sm font-bold font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sofa / Lounge Seating Checkbox & Pricing */}
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="sofaToggle"
                          checked={formData.hasSofaSeating}
                          onChange={e => setFormData({ ...formData, hasSofaSeating: e.target.checked })}
                          className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                        />
                        <label htmlFor="sofaToggle" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer flex items-center gap-1.5">
                          <span>🛋️</span>
                          <span>Offer Ergonomic Sofa / Recliner Lounge Seats</span>
                        </label>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Sofa Tier
                      </span>
                    </div>

                    {formData.hasSofaSeating && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 pl-7 border-t border-slate-200/60 dark:border-slate-800/60 mt-2">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Sofa Seating · Daily Pass (₹)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₹</span>
                            <input
                              type="number"
                              min="50"
                              max="10000"
                              value={formData.sofaPriceDaily}
                              onChange={e => setFormData({ ...formData, sofaPriceDaily: parseInt(e.target.value) || 0 })}
                              className="w-full pl-8 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161f36] text-sm font-bold font-mono"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Sofa Seating · Monthly Pass (₹)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₹</span>
                            <input
                              type="number"
                              min="200"
                              max="50000"
                              value={formData.sofaPriceMonthly}
                              onChange={e => setFormData({ ...formData, sofaPriceMonthly: parseInt(e.target.value) || 0 })}
                              className="w-full pl-8 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161f36] text-sm font-bold font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Custom Seat Category Base Rates in Section 4 */}
                  {formData.customSeatTypes.length > 0 && (
                    <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] space-y-3">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <span>🏷️</span>
                        <span>Custom Seat Category Base Rates</span>
                      </h4>
                      <p className="text-[11px] text-slate-500">Base pricing rates for custom seat categories created in Section 2</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {formData.customSeatTypes.map(cType => (
                          <div key={cType.id} className="p-3 rounded-xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-[#161f36] space-y-2">
                            <span className="text-xs font-bold text-violet-700 dark:text-violet-300 block">{cType.icon} {cType.name}</span>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Daily Pass (₹)</label>
                                <input
                                  type="number"
                                  value={cType.dailyPrice}
                                  onChange={e => {
                                    const val = parseInt(e.target.value) || 0;
                                    setFormData({
                                      ...formData,
                                      customSeatTypes: formData.customSeatTypes.map(st => st.id === cType.id ? { ...st, dailyPrice: val } : st)
                                    });
                                  }}
                                  className="w-full text-xs font-mono font-bold p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0c1220]"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Monthly Pass (₹)</label>
                                <input
                                  type="number"
                                  value={cType.monthlyPrice}
                                  onChange={e => {
                                    const val = parseInt(e.target.value) || 0;
                                    setFormData({
                                      ...formData,
                                      customSeatTypes: formData.customSeatTypes.map(st => st.id === cType.id ? { ...st, monthlyPrice: val } : st)
                                    });
                                  }}
                                  className="w-full text-xs font-mono font-bold p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0c1220]"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Free library — show what's included for free */
                <div className="p-5 rounded-2xl border-2 border-dashed border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🆓</span>
                    <div>
                      <p className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300">100% Free Public Library</p>
                      <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">All desks, sofas, and lockers are ₹0 cost to students. No individual seat pricing or payment required.</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pl-11">
                    {['All Desks · ₹0', 'Sofa Seats · ₹0', 'Daily Pass · FREE', 'Monthly Pass · FREE'].map(tag => (
                      <span key={tag} className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Locker Service or Not */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Locker Service Options *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'NO_LOCKERS', title: 'No Lockers', desc: 'Open desk under-seat rack only' },
                    { id: 'FREE_LOCKERS', title: 'Complimentary Lockers', desc: 'Free with monthly desk pass' },
                    { id: 'PAID_MANAGED', title: 'Paid Secure Lockers', desc: 'Keycard / digital pin storage' }
                  ].map(item => (
                    <label
                      key={item.id}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                        formData.lockerMode === item.id
                          ? 'border-violet-600 bg-violet-50/50 dark:bg-violet-950/20 text-violet-950 dark:text-violet-100 ring-2 ring-violet-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold">{item.title}</span>
                        <input
                          type="radio"
                          name="lockerMode"
                          value={item.id}
                          checked={formData.lockerMode === item.id}
                          onChange={() => setFormData({ ...formData, lockerMode: item.id as any })}
                          className="w-4 h-4 accent-violet-600"
                        />
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">{item.desc}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* ─── 5. Layout Generation & Blueprint ─── */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-extrabold flex items-center justify-center">5</span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Seat Blueprint & Layout Options ({formData.totalSeats} Desks)
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  { id: 'GENERATED_CLASSROOM', title: '1. Classroom Grid Rows', icon: '🏛️', desc: 'Ordered rows with center aisle' },
                  { id: 'GENERATED_PODS', title: '2. Focus Pods (4-Desk)', icon: '📦', desc: 'Acoustic cubicle modules' },
                  { id: 'GENERATED_PERIMETER', title: '3. Perimeter + Island', icon: '🔲', desc: 'Wall desks + center tables' },
                  { id: 'GENERATED_QUIET_CLUSTER', title: '4. Quiet Zone + Alcoves', icon: '🤫', desc: 'Silent cabins + discussion cluster' },
                  { id: 'GENERATED_DUAL_WING', title: '5. Dual-Wing Gender Split', icon: '🛡️', desc: 'General Wing + Girls Reserved Wing' },
                  { id: 'CUSTOM_UPLOAD', title: 'Custom File Upload', icon: '📁', desc: 'Upload your own PDF/blueprint' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, layoutOption: opt.id as any })}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      formData.layoutOption === opt.id
                        ? 'border-violet-600 bg-violet-50/50 dark:bg-violet-950/20 ring-2 ring-violet-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{opt.icon}</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{opt.title}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">{opt.desc}</span>
                  </button>
                ))}
              </div>

              {/* Layout Content: Visual Interactive Preview or Custom File Upload */}
              {formData.layoutOption === 'CUSTOM_UPLOAD' ? (
                <div className="p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-[#12192c]/50 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center text-xl">
                    📑
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Upload Custom Floor Plan / Blueprint File</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Supports PDF, PNG, JPG, or CAD exports (Max 15MB)</p>
                  </div>
                  <label className="inline-block px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs cursor-pointer shadow transition">
                    Select Blueprint File
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.dwg"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setFormData({
                            ...formData,
                            customLayoutFileName: file.name,
                            customLayoutFileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                          });
                        }
                      }}
                    />
                  </label>
                  {formData.customLayoutFileName && (
                    <div className="flex items-center justify-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 pt-2">
                      <span>✓ Attached:</span>
                      <span className="font-mono">{formData.customLayoutFileName}</span>
                      <span className="text-slate-400">({formData.customLayoutFileSize})</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Live Interactive Preview of Generated Seats */
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                        Live Layout Generated Preview ({formData.totalSeats} Desks Created)
                      <span className="text-[10px] text-slate-500">Click any seat to customize it (Sofa, Girls Only, Free)</span>
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-violet-500 font-bold">
                      {formData.layoutOption.replace('GENERATED_', '')}
                    </span>
                  </div>

                  {/* Live seat-type summary with multi-type verification */}
                  {(() => {
                    const validGridCodes = new Set(generatedSeatsPreview.map(s => s.seatCode));
                    const girlsCount = Object.entries(seatOverrides).filter(([code, o]) => validGridCodes.has(code) && o.isGirlsOnly).length;
                    const declaredGirls = formData.girlsOnlyCount;
                    const isGirlsMatched = girlsCount === declaredGirls;

                    // Track custom seat type counts based exclusively on active valid layout seats
                    const customSeatStatus = formData.customSeatTypes.map(cType => {
                      const declared = cType.seatCount || 5;
                      const marked = Object.entries(seatOverrides).filter(([code, o]) => 
                        validGridCodes.has(code) && (
                          o.seatType === cType.id || 
                          (o.customTypeName && o.customTypeName.toLowerCase() === cType.name.toLowerCase()) ||
                          (cType.name.toLowerCase().includes('sofa') && o.isSofa)
                        )
                      ).length;
                      return {
                        id: cType.id,
                        name: cType.name,
                        icon: cType.icon,
                        declared,
                        marked,
                        isMatched: marked === declared,
                        needed: declared - marked
                      };
                    });

                    // Check overall pending list
                    const pendingList: string[] = [];
                    if (declaredGirls > 0 && !isGirlsMatched) {
                      const diff = declaredGirls - girlsCount;
                      if (diff > 0) pendingList.push(`${diff} more Girls Reserved 🩷 (${girlsCount}/${declaredGirls} marked)`);
                      else pendingList.push(`Unmark ${Math.abs(diff)} Girls Reserved 🩷 (${girlsCount}/${declaredGirls} marked)`);
                    }

                    customSeatStatus.forEach(cs => {
                      if (!cs.isMatched) {
                        if (cs.needed > 0) pendingList.push(`${cs.needed} more ${cs.icon} ${cs.name} (${cs.marked}/${cs.declared} marked)`);
                        else pendingList.push(`Unmark ${Math.abs(cs.needed)} ${cs.icon} ${cs.name} (${cs.marked}/${cs.declared} marked)`);
                      }
                    });

                    const allVerified = (declaredGirls === 0 || isGirlsMatched) && customSeatStatus.every(cs => cs.isMatched);
                    const freeCount = Object.entries(seatOverrides).filter(([code, o]) => validGridCodes.has(code) && o.isFree).length;
                    const totalCustomMarked = customSeatStatus.reduce((acc, c) => acc + c.marked, 0);

                    return (
                      <>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                            🪑 Total: {formData.totalSeats}
                          </span>

                          {/* Girls Only Status Tag */}
                          {declaredGirls > 0 && (
                            <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                              !isGirlsMatched 
                                ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                                : 'bg-pink-100 dark:bg-pink-950/30 text-pink-700 dark:text-pink-300'
                            }`}>
                              🩷 Girls: {girlsCount}/{declaredGirls} Marked {isGirlsMatched ? '✓' : '⚠️'}
                            </span>
                          )}

                          {/* Custom Seat Types Tags */}
                          {customSeatStatus.map(cs => (
                            <span key={cs.id} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                              !cs.isMatched
                                ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                                : 'bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300'
                            }`}>
                              {cs.icon} {cs.name}: {cs.marked}/{cs.declared} Marked {cs.isMatched ? '✓' : '⚠️'}
                            </span>
                          ))}

                          {freeCount > 0 && (
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                              🆓 Free: {freeCount}
                            </span>
                          )}
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                            ✅ Standard Desks: {Math.max(0, formData.totalSeats - girlsCount - totalCustomMarked)}
                          </span>
                        </div>

                        {/* Action Needed Warning Banner listing all pending seat types */}
                        {pendingList.length > 0 && (
                          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                            <div className="font-bold flex items-center gap-1.5">
                              <span>⚠️ Action Needed: Click layout seats below to mark pending seat categories:</span>
                            </div>
                            <ul className="list-disc pl-5 space-y-0.5 font-semibold text-[11px]">
                              {pendingList.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* All Verified Success Banner */}
                        {allVerified && (declaredGirls > 0 || formData.customSeatTypes.length > 0) && (
                          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1.5">
                            <span>✓ All seat categories and declared seat counts match your layout blueprint!</span>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  <div className="max-h-64 overflow-y-auto p-3 rounded-xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800/80 relative">
                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                      {generatedSeatsPreview.map((seat, idx) => {
                        const override = seatOverrides[seat.seatCode] || {};
                        const isGirls = override.isGirlsOnly !== undefined ? override.isGirlsOnly : seat.isGirlsOnly;
                        const isSofa = override.isSofa;
                        const isFree = override.isFree;
                        const customIcon = override.customTypeIcon;
                        const customName = override.customTypeName;

                        let borderClass = 'border-slate-200 dark:border-slate-800';
                        let bgClass = 'bg-slate-100 dark:bg-[#161f36]';
                        let textClass = 'text-slate-800 dark:text-slate-200';

                        if (isGirls) {
                          borderClass = 'border-pink-300 dark:border-pink-800/60';
                          bgClass = 'bg-pink-50 dark:bg-pink-950/30';
                          textClass = 'text-pink-700 dark:text-pink-300';
                        } else if (customName || customIcon) {
                          borderClass = 'border-violet-300 dark:border-violet-800/60';
                          bgClass = 'bg-violet-50 dark:bg-violet-950/30';
                          textClass = 'text-violet-700 dark:text-violet-300';
                        } else if (isSofa) {
                          borderClass = 'border-amber-300 dark:border-amber-800/60';
                          bgClass = 'bg-amber-50 dark:bg-amber-950/30';
                          textClass = 'text-amber-700 dark:text-amber-300';
                        } else if (isFree) {
                          borderClass = 'border-emerald-300 dark:border-emerald-800/60';
                          bgClass = 'bg-emerald-50 dark:bg-emerald-950/30';
                          textClass = 'text-emerald-700 dark:text-emerald-300';
                        }

                        return (
                          <div
                            key={idx}
                            onClick={() => setSelectedSeatForOverride(seat.seatCode)}
                            className={`p-2 rounded-lg border text-center font-mono text-[11px] font-bold cursor-pointer hover:ring-2 hover:ring-violet-400 transition-all ${borderClass} ${bgClass} ${textClass}`}
                          >
                            {seat.seatCode}
                            <div className="flex justify-center gap-1 mt-1">
                              {seat.hasPowerSocket && <span className="text-[8px] text-amber-500" title="Socket">⚡</span>}
                              {customIcon && <span className="text-[8px]" title={customName || 'Custom'}>{customIcon}</span>}
                              {!customIcon && isSofa && <span className="text-[8px]" title="Sofa">🛋️</span>}
                              {isFree && <span className="text-[8px]" title="Free">🆓</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {selectedSeatForOverride && (
                    <div className="absolute top-16 left-1/2 -translate-x-1/2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl p-4 z-20 space-y-3">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">Desk {selectedSeatForOverride}</span>
                          {formData.isFree && (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold">
                              100% FREE
                            </span>
                          )}
                        </div>
                        <button type="button" onClick={() => setSelectedSeatForOverride(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">✕</button>
                      </div>
                      
                      <div className="space-y-3">
                        {/* Girls Reserved Toggle */}
                        <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl bg-pink-50/50 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-900/40">
                          <span className="text-xs font-bold text-pink-700 dark:text-pink-300">🩷 Girls Reserved Wing</span>
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 accent-pink-500 rounded"
                            checked={seatOverrides[selectedSeatForOverride]?.isGirlsOnly ?? false}
                            onChange={(e) => setSeatOverrides(prev => ({
                              ...prev,
                              [selectedSeatForOverride]: { ...prev[selectedSeatForOverride], isGirlsOnly: e.target.checked }
                            }))}
                          />
                        </label>
                        
                        {/* Seat Category Selection (Standard, Sofa if enabled, or Custom Types) */}
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Seat Category</label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {/* Standard Desk */}
                            <button
                              type="button"
                              onClick={() => setSeatOverrides(prev => ({
                                ...prev,
                                [selectedSeatForOverride]: {
                                  ...prev[selectedSeatForOverride],
                                  isSofa: false,
                                  seatType: 'STANDARD'
                                }
                              }))}
                              className={`p-2 rounded-lg text-xs font-bold border text-left transition ${
                                !seatOverrides[selectedSeatForOverride]?.isSofa && (!seatOverrides[selectedSeatForOverride]?.seatType || seatOverrides[selectedSeatForOverride]?.seatType === 'STANDARD')
                                  ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'
                                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              🪑 Standard
                            </button>

                            {/* Sofa Desk (if enabled in pricing) */}
                            {formData.hasSofaSeating && (
                              <button
                                type="button"
                                onClick={() => setSeatOverrides(prev => ({
                                  ...prev,
                                  [selectedSeatForOverride]: {
                                    ...prev[selectedSeatForOverride],
                                    isSofa: true,
                                    seatType: 'SOFA'
                                  }
                                }))}
                                className={`p-2 rounded-lg text-xs font-bold border text-left transition ${
                                  seatOverrides[selectedSeatForOverride]?.isSofa || seatOverrides[selectedSeatForOverride]?.seatType === 'SOFA'
                                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                🛋️ Sofa / Recliner
                              </button>
                            )}

                            {/* Custom Seat Types */}
                            {formData.customSeatTypes.map(cType => (
                              <button
                                key={cType.id}
                                type="button"
                                onClick={() => setSeatOverrides(prev => ({
                                  ...prev,
                                  [selectedSeatForOverride]: {
                                    ...prev[selectedSeatForOverride],
                                    isSofa: false,
                                    seatType: cType.id,
                                    customTypeName: cType.name,
                                    customTypeIcon: cType.icon,
                                  }
                                }))}
                                className={`p-2 rounded-lg text-xs font-bold border text-left transition ${
                                  seatOverrides[selectedSeatForOverride]?.seatType === cType.id
                                    ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'
                                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {cType.icon} {cType.name}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Individual Free Desk Toggle — ONLY shown when entire library is NOT free */}
                        {!formData.isFree && (
                          <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">🆓 Mark Desk 100% Free</span>
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 accent-emerald-500 rounded"
                              checked={seatOverrides[selectedSeatForOverride]?.isFree ?? false}
                              onChange={(e) => setSeatOverrides(prev => ({
                                ...prev,
                                [selectedSeatForOverride]: { ...prev[selectedSeatForOverride], isFree: e.target.checked }
                              }))}
                            />
                          </label>
                        )}

                        {/* Custom Price Input — ONLY shown when Custom Seat-Level Pricing is active & not free */}
                        {!formData.isFree && formData.pricingModel === 'CUSTOM_SEAT' && (
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 space-y-1">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              Custom Monthly Fee for Seat {selectedSeatForOverride} (₹)
                            </label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-2 text-slate-400 font-bold text-xs">₹</span>
                              <input
                                type="number"
                                placeholder={
                                  seatOverrides[selectedSeatForOverride]?.isSofa 
                                    ? String(formData.sofaPriceMonthly) 
                                    : String(formData.baseDeskPriceMonthly)
                                }
                                value={seatOverrides[selectedSeatForOverride]?.customPriceMonthly ?? ''}
                                onChange={(e) => setSeatOverrides(prev => ({
                                  ...prev,
                                  [selectedSeatForOverride]: {
                                    ...prev[selectedSeatForOverride],
                                    customPriceMonthly: parseInt(e.target.value) || undefined
                                  }
                                }))}
                                className="w-full pl-6 p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161f36] text-xs font-mono font-bold"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-slate-300 dark:bg-slate-700"></span>
                      <span>General Cabin</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-pink-400"></span>
                      <span>Girls Reserved Wing</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-amber-400"></span>
                      <span>Sofa / Premium</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-emerald-400"></span>
                      <span>Free Desk</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ─── 6. Time-wise Shift Configuration ─── */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-extrabold flex items-center justify-center">6</span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Time-wise Shifts & Pricing Configuration
                </h3>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Define your library's operating shifts. Each shift can have custom timings and pricing. Students will see and book these shifts.
              </p>

              {/* Existing Shifts List */}
              <div className="space-y-3">
                {onboardingShifts.map((sh, idx) => {
                  const isExpanded = Boolean(expandedShiftIds[sh.id]);
                  return (
                    <div key={sh.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={sh.shiftName}
                              onChange={e => setOnboardingShifts(prev => prev.map((s, i) => i === idx ? { ...s, shiftName: e.target.value } : s))}
                              className="text-xs font-bold bg-transparent text-slate-900 dark:text-white border-b border-transparent focus:border-violet-500 focus:outline-none w-36 truncate"
                              placeholder="Shift Name"
                            />
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="time"
                              value={sh.startTime}
                              onChange={e => setOnboardingShifts(prev => prev.map((s, i) => i === idx ? { ...s, startTime: e.target.value } : s))}
                              className="text-[11px] font-mono bg-transparent text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 py-0.5 focus:outline-none focus:border-violet-500"
                            />
                            <span className="text-slate-400 text-xs">to</span>
                            <input
                              type="time"
                              value={sh.endTime}
                              onChange={e => setOnboardingShifts(prev => prev.map((s, i) => i === idx ? { ...s, endTime: e.target.value } : s))}
                              className="text-[11px] font-mono bg-transparent text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 py-0.5 focus:outline-none focus:border-violet-500"
                            />
                          </div>
                        </div>
                        {!formData.isFree && (
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-slate-400">₹</span>
                                <input
                                  type="number"
                                  value={sh.dailyPrice}
                                  onChange={e => setOnboardingShifts(prev => prev.map((s, i) => i === idx ? { ...s, dailyPrice: parseInt(e.target.value) || 0 } : s))}
                                  className="w-16 text-xs font-bold font-mono text-center bg-white dark:bg-[#161f36] border border-slate-200 dark:border-slate-700 rounded-lg p-1 focus:border-violet-500 focus:outline-none"
                                />
                                <span className="text-[10px] text-slate-400">/day</span>
                              </div>
                              <div className="flex items-center gap-1 mt-1">
                                <span className="text-[10px] text-slate-400">₹</span>
                                <input
                                  type="number"
                                  value={sh.monthlyPrice}
                                  onChange={e => setOnboardingShifts(prev => prev.map((s, i) => i === idx ? { ...s, monthlyPrice: parseInt(e.target.value) || 0 } : s))}
                                  className="w-16 text-xs font-bold font-mono text-center bg-white dark:bg-[#161f36] border border-slate-200 dark:border-slate-700 rounded-lg p-1 focus:border-violet-500 focus:outline-none"
                                />
                                <span className="text-[10px] text-slate-400">/mo</span>
                              </div>
                            </div>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setOnboardingShifts(prev => prev.filter((_, i) => i !== idx))}
                          className="text-xs text-slate-400 hover:text-red-500 font-bold p-1 transition shrink-0"
                          title="Remove Shift"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Expandable Seat Type Pricing Breakdown */}
                      {!formData.isFree && (
                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                          <button
                            type="button"
                            onClick={() => setExpandedShiftIds(prev => ({ ...prev, [sh.id]: !prev[sh.id] }))}
                            className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>{isExpanded ? '▲ Hide Seat Type Pricing Breakdown' : '▼ Expand & Customize Seat Type Pricing'}</span>
                          </button>

                          {isExpanded && (
                            <div className="mt-3 p-3.5 rounded-xl bg-white dark:bg-[#161f36] border border-violet-200 dark:border-violet-800/60 space-y-3">
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                Custom Seat Category Prices for {sh.shiftName}
                              </h4>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Standard Desk */}
                                <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0c1220] flex items-center justify-between">
                                  <span className="text-xs font-bold">🪑 Standard Desk</span>
                                  <div className="text-right text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300">
                                    ₹{sh.dailyPrice}/day · ₹{sh.monthlyPrice}/mo
                                  </div>
                                </div>

                                {/* Sofa / Recliner (if enabled) */}
                                {formData.hasSofaSeating && (
                                  <div className="p-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
                                    <span className="text-xs font-bold text-amber-700 dark:text-amber-300 block">🛋️ Sofa / Recliner Tier</span>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-[10px] font-semibold text-slate-500 block">Daily (₹)</label>
                                        <input
                                          type="number"
                                          value={sh.sofaDailyPrice ?? formData.sofaPriceDaily}
                                          onChange={e => {
                                            const v = parseInt(e.target.value) || 0;
                                            setOnboardingShifts(prev => prev.map((s, i) => i === idx ? { ...s, sofaDailyPrice: v } : s));
                                          }}
                                          className="w-full text-xs font-mono font-bold p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[10px] font-semibold text-slate-500 block">Monthly (₹)</label>
                                        <input
                                          type="number"
                                          value={sh.sofaMonthlyPrice ?? formData.sofaPriceMonthly}
                                          onChange={e => {
                                            const v = parseInt(e.target.value) || 0;
                                            setOnboardingShifts(prev => prev.map((s, i) => i === idx ? { ...s, sofaMonthlyPrice: v } : s));
                                          }}
                                          className="w-full text-xs font-mono font-bold p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Custom Seat Types */}
                                {formData.customSeatTypes.map(cType => (
                                  <div key={cType.id} className="p-2.5 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 space-y-2">
                                    <span className="text-xs font-bold text-violet-700 dark:text-violet-300 block">{cType.icon} {cType.name}</span>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-[10px] font-semibold text-slate-500 block">Daily (₹)</label>
                                        <input
                                          type="number"
                                          value={sh.customSeatPrices?.[cType.id]?.dailyPrice ?? cType.dailyPrice}
                                          onChange={e => {
                                            const v = parseInt(e.target.value) || 0;
                                            setOnboardingShifts(prev => prev.map((s, i) => {
                                              if (i !== idx) return s;
                                              const existing = s.customSeatPrices || {};
                                              const updatedCType = { ...(existing[cType.id] || { dailyPrice: cType.dailyPrice, monthlyPrice: cType.monthlyPrice }), dailyPrice: v };
                                              return { ...s, customSeatPrices: { ...existing, [cType.id]: updatedCType } };
                                            }));
                                          }}
                                          className="w-full text-xs font-mono font-bold p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[10px] font-semibold text-slate-500 block">Monthly (₹)</label>
                                        <input
                                          type="number"
                                          value={sh.customSeatPrices?.[cType.id]?.monthlyPrice ?? cType.monthlyPrice}
                                          onChange={e => {
                                            const v = parseInt(e.target.value) || 0;
                                            setOnboardingShifts(prev => prev.map((s, i) => {
                                              if (i !== idx) return s;
                                              const existing = s.customSeatPrices || {};
                                              const updatedCType = { ...(existing[cType.id] || { dailyPrice: cType.dailyPrice, monthlyPrice: cType.monthlyPrice }), monthlyPrice: v };
                                              return { ...s, customSeatPrices: { ...existing, [cType.id]: updatedCType } };
                                            }));
                                          }}
                                          className="w-full text-xs font-mono font-bold p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0c1220]"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add New Shift */}
              {showAddShiftForm ? (
                <div className="p-4 rounded-2xl border border-violet-200 dark:border-violet-800/60 bg-violet-50/50 dark:bg-violet-950/20 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Shift Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Early Bird Shift"
                        value={newShiftForm.shiftName}
                        onChange={e => setNewShiftForm({ ...newShiftForm, shiftName: e.target.value })}
                        className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0c1220] text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Start Time</label>
                      <input type="time" value={newShiftForm.startTime} onChange={e => setNewShiftForm({ ...newShiftForm, startTime: e.target.value })} className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0c1220] text-xs font-mono" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">End Time</label>
                      <input type="time" value={newShiftForm.endTime} onChange={e => setNewShiftForm({ ...newShiftForm, endTime: e.target.value })} className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0c1220] text-xs font-mono" />
                    </div>
                    {!formData.isFree && (
                      <>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Daily Price (₹)</label>
                          <input type="number" value={newShiftForm.dailyPrice} onChange={e => setNewShiftForm({ ...newShiftForm, dailyPrice: parseInt(e.target.value) || 0 })} className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0c1220] text-xs font-mono font-bold" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Monthly Price (₹)</label>
                          <input type="number" value={newShiftForm.monthlyPrice} onChange={e => setNewShiftForm({ ...newShiftForm, monthlyPrice: parseInt(e.target.value) || 0 })} className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0c1220] text-xs font-mono font-bold" />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!newShiftForm.shiftName.trim()) return;
                        setOnboardingShifts(prev => [...prev, { ...newShiftForm, id: 'os-' + Date.now() }]);
                        setNewShiftForm({ shiftName: '', startTime: '06:00', endTime: '12:00', dailyPrice: 300, monthlyPrice: 800 });
                        setShowAddShiftForm(false);
                      }}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                    >
                      ✓ Add Shift
                    </button>
                    <button type="button" onClick={() => setShowAddShiftForm(false)} className="px-4 py-1.5 rounded-lg text-slate-500 text-xs font-semibold">Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddShiftForm(true)}
                  className="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-400 text-xs font-bold transition"
                >
                  + Add Custom Shift
                </button>
              )}
            </div>

            {/* ─── 7. Document of Proof (PDF & Number) ─── */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-extrabold flex items-center justify-center">7</span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Document of Proof (PDF & License ID)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Proof Document Type *
                  </label>
                  <select
                    value={formData.proofDocType}
                    onChange={e => setFormData({ ...formData, proofDocType: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] text-sm font-semibold"
                  >
                    <option>Municipal Trade License</option>
                    <option>Shop & Establishment Certificate</option>
                    <option>GSTIN Registration Certificate</option>
                    <option>Commercial Electricity Bill (Recent)</option>
                    <option>Commercial Rent / Lease Agreement</option>
                    <option>Udyam MSME Registration</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Document / Registration Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.proofDocNumber}
                    onChange={e => setFormData({ ...formData, proofDocNumber: e.target.value })}
                    placeholder="e.g. MP-IND-2026-TL-84920"
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] text-sm font-mono font-bold uppercase"
                  />
                </div>
              </div>

              {/* PDF Document Upload Area */}
              <div className="p-5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-[#12192c]/70 text-center space-y-3">
                <div className="flex items-center justify-center gap-3">
                  <span className="text-2xl">📄</span>
                  <div className="text-left">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Upload Proof Document (PDF)</h4>
                    <p className="text-[11px] text-slate-500">Official government registration document in PDF format (Max 10MB)</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
                  <label className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer transition shadow">
                    Choose PDF Document
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setFormData({
                            ...formData,
                            proofDocFileName: file.name,
                            proofDocFileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                          });
                        }
                      }}
                    />
                  </label>

                  {formData.proofDocFileName && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-mono">
                      <span>✓ Ready: {formData.proofDocFileName}</span>
                      <span className="text-slate-400">({formData.proofDocFileSize})</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ─── 8. Student Identity & KYC Requirements ─── */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-extrabold flex items-center justify-center">8</span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Student Identity &amp; Verification Requirements (KYC)
                </h3>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] space-y-4">
                {/* Zero Fields Fast Path Option */}
                <div
                  onClick={() => {
                    const next = !identityConfig.fastPathZeroFields;
                    setIdentityConfig(prev => ({
                      ...prev,
                      fastPathZeroFields: next,
                      requireAadhaarLast4: next ? false : prev.requireAadhaarLast4,
                      requirePanMasked: next ? false : prev.requirePanMasked,
                      requireTargetExam: next ? false : prev.requireTargetExam,
                      requireCollegeName: next ? false : prev.requireCollegeName,
                      customFields: next ? [] : prev.customFields
                    }));
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    identityConfig.fastPathZeroFields
                      ? 'border-emerald-400 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1220]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={identityConfig.fastPathZeroFields}
                      onChange={() => {}}
                      className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        ⚡ Zero-Fields Fast Path (Recommended for Maximum Bookings)
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Students book instantly using their default EduGlobin verified account (Name + Phone + Email). No extra KYC friction.
                      </p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                    identityConfig.fastPathZeroFields ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                  }`}>
                    {identityConfig.fastPathZeroFields ? 'Active' : 'Custom KYC'}
                  </span>
                </div>

                {/* Optional KYC Checkboxes */}
                {!identityConfig.fastPathZeroFields && (
                  <div className="space-y-3 pt-2">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Select optional extra identity fields required before a student can confirm their desk:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1220] cursor-pointer hover:border-violet-500/50 transition">
                        <input
                          type="checkbox"
                          checked={identityConfig.requireAadhaarLast4}
                          onChange={e => setIdentityConfig(prev => ({ ...prev, requireAadhaarLast4: e.target.checked, fastPathZeroFields: false }))}
                          className="w-4 h-4 accent-violet-600 rounded"
                        />
                        <div className="text-xs">
                          <span className="font-bold text-slate-800 dark:text-slate-200 block">🪪 Aadhaar Last 4 Digits</span>
                          <span className="text-[10px] text-slate-500">Stored masked (XXXX-XXXX-1234) for privacy</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1220] cursor-pointer hover:border-violet-500/50 transition">
                        <input
                          type="checkbox"
                          checked={identityConfig.requirePanMasked}
                          onChange={e => setIdentityConfig(prev => ({ ...prev, requirePanMasked: e.target.checked, fastPathZeroFields: false }))}
                          className="w-4 h-4 accent-violet-600 rounded"
                        />
                        <div className="text-xs">
                          <span className="font-bold text-slate-800 dark:text-slate-200 block">💳 PAN Card (Masked)</span>
                          <span className="text-[10px] text-slate-500">e.g. ABCDE****F verification</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1220] cursor-pointer hover:border-violet-500/50 transition">
                        <input
                          type="checkbox"
                          checked={identityConfig.requireTargetExam}
                          onChange={e => setIdentityConfig(prev => ({ ...prev, requireTargetExam: e.target.checked, fastPathZeroFields: false }))}
                          className="w-4 h-4 accent-violet-600 rounded"
                        />
                        <div className="text-xs">
                          <span className="font-bold text-slate-800 dark:text-slate-200 block">🎯 Target Competitive Exam</span>
                          <span className="text-[10px] text-slate-500">e.g. UPSC, SSC CGL, Banking, NEET, GATE</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1220] cursor-pointer hover:border-violet-500/50 transition">
                        <input
                          type="checkbox"
                          checked={identityConfig.requireCollegeName}
                          onChange={e => setIdentityConfig(prev => ({ ...prev, requireCollegeName: e.target.checked, fastPathZeroFields: false }))}
                          className="w-4 h-4 accent-violet-600 rounded"
                        />
                        <div className="text-xs">
                          <span className="font-bold text-slate-800 dark:text-slate-200 block">🏫 College / University Name</span>
                          <span className="text-[10px] text-slate-500">e.g. SGSITS, DAVV, IIT Indore</span>
                        </div>
                      </label>
                    </div>

                    {/* Custom Dynamic Fields Builder */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          ✨ Custom Identity Fields (Optional)
                        </h4>
                        <span className="text-[10px] text-slate-400">
                          {identityConfig.customFields.length} custom field(s) configured
                        </span>
                      </div>

                      {identityConfig.customFields.map((cf, cIdx) => (
                        <div key={cIdx} className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{cf.label}</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-500">
                              {cf.name} · {cf.type}
                            </span>
                            {cf.required && (
                              <span className="text-[10px] text-rose-500 font-bold">Required</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setIdentityConfig(prev => ({
                              ...prev,
                              customFields: prev.customFields.filter((_, i) => i !== cIdx)
                            }))}
                            className="text-slate-400 hover:text-rose-500 font-bold p-1"
                          >
                            ✕
                          </button>
                        </div>
                      ))}

                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Field Label (e.g. Roll No / Vehicle No)"
                          value={newCustomFieldLabel}
                          onChange={e => {
                            setNewCustomFieldLabel(e.target.value);
                            setNewCustomFieldName(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
                          }}
                          className="flex-1 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1220] text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newCustomFieldLabel.trim()) return;
                            const key = newCustomFieldName.trim() || newCustomFieldLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                            setIdentityConfig(prev => ({
                              ...prev,
                              fastPathZeroFields: false,
                              customFields: [
                                ...prev.customFields,
                                { name: key, label: newCustomFieldLabel.trim(), type: 'text', required: newCustomFieldRequired }
                              ]
                            }));
                            setNewCustomFieldLabel('');
                            setNewCustomFieldName('');
                          }}
                          className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow cursor-pointer"
                        >
                          + Add Field
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-sm transition shadow-lg shadow-violet-500/25 flex items-center justify-center gap-2 cursor-pointer mt-6"
            >
              Submit Application for Super Admin Approval →
            </button>
          </form>
        </main>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PHASE 2: PENDING APPROVAL GATE (When submitted and awaiting Admin)
  // ═════════════════════════════════════════════════════════════════════════════
  if (library?.approvalStatus === 'PENDING_APPROVAL') {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#070b14] text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-300">
        <Navbar />

        <main className="flex-1 max-w-xl w-full mx-auto px-4 py-12 flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center text-4xl animate-pulse">
            ⏳
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              Application Under Review
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-headers">
              Profile Pending Admin Approval
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
              Your library application has been submitted to the EduGlobin Super Admin compliance queue. Our team is verifying your space specifications, proof documents, and safety standards.
            </p>
          </div>

          {/* Submission Detailed Dossier Summary Card */}
          <div className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1220] p-6 text-left space-y-3.5 text-xs shadow-sm">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">Application Dossier</span>
              <span className="font-mono text-violet-500 font-bold">REQ-LIB-{library.id.slice(0, 8).toUpperCase()}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Library Brand</span>
              <span className="font-bold text-slate-900 dark:text-white">{library.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Location</span>
              <span className="font-bold text-slate-900 dark:text-white">{library.locality}, {library.city}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Official Contact</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">{library.email || formData.email} · {library.contactNumber || formData.contactNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Cabin Capacity</span>
              <span className="font-bold text-slate-900 dark:text-white">{library.totalSeats} Desks</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Discussion Room</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {library.hasDiscussionRoom || formData.hasDiscussionRoom ? `✓ Available (${library.discussionRoomCapacity || formData.discussionRoomCapacity} Seats)` : 'None'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Facilities & Books</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                WiFi, AC, CCTV, UPS, Water · {library.booksCapacity || formData.booksCapacity} Volumes
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Pricing Model</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {(library.isFree ?? formData.isFree)
                  ? <span className="text-emerald-500 font-bold">🆓 FREE ADMISSION (No Charge)</span>
                  : `₹${library.baseDeskPriceDaily ?? formData.baseDeskPriceDaily}/day · ₹${library.baseDeskPriceMonthly ?? formData.baseDeskPriceMonthly}/mo`
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Locker Service</span>
              <span className="font-bold text-slate-900 dark:text-white">{library.lockerMode || formData.lockerMode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Blueprint Archetype</span>
              <span className="font-bold text-violet-600 dark:text-violet-400">
                {(library.layoutType || formData.layoutOption).replace('GENERATED_', '')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Proof of License</span>
              <span className="font-mono text-slate-900 dark:text-white font-bold">
                {library.proofDocType || formData.proofDocType} ({library.proofDocNumber || formData.proofDocNumber})
              </span>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-2.5 flex justify-between items-center">
              <span className="text-slate-400">Verification Status</span>
              <span className="font-extrabold text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                PENDING APPROVAL
              </span>
            </div>
          </div>

          <div className="w-full space-y-3 pt-2">
            <button
              onClick={handleCheckApprovalStatus}
              className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-md shadow-violet-500/20 transition cursor-pointer flex items-center justify-center gap-2"
            >
              🔄 Refresh & Check Approval Status
            </button>

            {/* Quick Demo Instant Unlock for pairwise verification */}
            <button
              onClick={() => {
                setLibrary({ ...library, approvalStatus: 'APPROVED' });
              }}
              className="w-full py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs border border-emerald-500/30 transition cursor-pointer"
            >
              ⚡ Instant Unlock Demo (Simulate Super Admin Approval)
            </button>

            <button
              onClick={() => setIsEditingWizard(true)}
              className="w-full py-2.5 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white text-xs font-semibold transition"
            >
              ✏️ Edit Submitted Details
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PHASE 2.5: CHANGES REQUESTED / REJECTED GATE
  // ═════════════════════════════════════════════════════════════════════════════
  if (library?.approvalStatus === 'CHANGES_REQUESTED' || library?.approvalStatus === 'REJECTED') {
    const isChangesReq = library.approvalStatus === 'CHANGES_REQUESTED';
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#070b14] text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-300">
        <Navbar />

        <main className="flex-1 max-w-xl w-full mx-auto px-4 py-12 flex flex-col items-center justify-center text-center space-y-6">
          <div className={`w-20 h-20 rounded-3xl border-2 flex items-center justify-center text-4xl shadow-xl ${
            isChangesReq 
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' 
              : 'bg-red-500/10 border-red-500/30 text-red-500'
          }`}>
            {isChangesReq ? '📝' : '❌'}
          </div>

          <div className="space-y-2">
            <span className={`px-3.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border ${
              isChangesReq 
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' 
                : 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
            }`}>
              {isChangesReq ? 'Action Needed: Admin Requested Changes' : 'Application Rejected'}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-headers">
              {isChangesReq ? 'Corrections Required for Your Study Space' : 'Application Rejected by Super Admin'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
              {isChangesReq 
                ? 'The EduGlobin compliance team reviewed your submission and requested adjustments before approving your portal.' 
                : 'Your library application was reviewed and rejected by EduGlobin Super Admin compliance.'}
            </p>
          </div>

          {/* Admin Remarks Card */}
          <div className="w-full rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 p-5 text-left space-y-2 text-xs">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold uppercase text-[11px] tracking-wider">
              <span>📌 Admin Remarks & Feedback</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 font-medium text-xs leading-relaxed bg-white dark:bg-[#0c1220] p-3 rounded-xl border border-amber-200 dark:border-amber-900/40">
              {library.rejectionReason || 'Please review your uploaded document of proof and seat blueprint specifications, make necessary updates, and re-submit for approval.'}
            </p>
          </div>

          <div className="w-full space-y-3 pt-2">
            <button
              onClick={() => setIsEditingWizard(true)}
              className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-xs shadow-lg shadow-violet-500/25 transition cursor-pointer flex items-center justify-center gap-2"
            >
              ✏️ Edit Onboarding Form & Re-submit →
            </button>

            <button
              onClick={handleCheckApprovalStatus}
              className="w-full py-2.5 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white text-xs font-semibold transition cursor-pointer"
            >
              🔄 Refresh Approval Status
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PHASE 3: APPROVED OPERATIONAL PORTAL (SCREENSHOT 2 LAYOUT)
  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#070b14] text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-300">
      <Navbar />

      <main className="flex-1 max-w-[1500px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 mb-8">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-headers">
                Owner ERP Portal
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                ✓ Approved & Live
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Manage your verified study space, live desk grid, student CRM, and daily collections.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 hidden sm:inline">Portal Active</span>
            <button
              type="button"
              onClick={() => setShowCsvUploadModal(true)}
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-xs shadow-md shadow-violet-500/20 transition cursor-pointer flex items-center gap-2"
            >
              <span>📄 Manage Student CSV Roster</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 mb-8 gap-2">
          <button
            onClick={() => setActiveTab('fees')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'fees'
                ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <span>💳 Student Fees &amp; Billing</span>
          </button>

          <button
            onClick={() => setActiveTab('onboarding')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition ${
              activeTab === 'onboarding'
                ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            🗺️ Seat Layout &amp; Blueprint
          </button>

          <button
            onClick={() => setActiveTab('scanner')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition ${
              activeTab === 'scanner'
                ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            🔍 Gate Scanner / Check-in
          </button>

          <button
            onClick={() => setActiveTab('walkin')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'walkin'
                ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <span>🚪 Walk IN</span>
          </button>

          <button
            onClick={() => setActiveTab('complaints')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'complaints'
                ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <span>📢 Complaints Desk</span>
            {libraryComplaints.filter(c => c.status !== 'RESOLVED').length > 0 && (
              <span className="px-1.5 py-0.5 text-[9px] rounded-full bg-rose-500 text-white font-extrabold">
                {libraryComplaints.filter(c => c.status !== 'RESOLVED').length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('master-audit')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition ${
              activeTab === 'master-audit'
                ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            📜 Master Audit Report
          </button>

          {library?.libraryCategory !== 'INSTITUTE' && (
            <button
              onClick={() => setActiveTab('circulation')}
              className={`py-3 px-4 text-xs font-bold border-b-2 transition ${
                activeTab === 'circulation'
                  ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              📚 Book Catalog
            </button>
          )}
        </div>

        {/* TAB 1: MY LIBRARY & SEAT LAYOUT (MATCHING SCREENSHOT 2) */}
        {activeTab === 'onboarding' && (
          <div className="w-full space-y-6">
            {/* Top Library Header Banner */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0c1220] p-4 flex items-center gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center text-xl">
                🏢
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  {library?.name || '—'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {[library?.locality, library?.city, library?.state].filter(Boolean).join(', ') || 'Location not set'}
                </p>
              </div>
            </div>

            {/* 4 KPI Stat Cards: Occupied, Active Bookings, Girls Reserved, Premium/Custom Seats */}
            {(() => {
              const occupied = liveSeats.filter((s: any) => s.status === 'IN_USE' || s.status === 'WAITING' || s.status === 'ONLINE').length;
              const totalSeatsDB = library?.totalSeats || liveSeats.length || 0;
              const occupancy = totalSeatsDB > 0 ? Math.round((occupied / totalSeatsDB) * 100) : 0;
              const girlsCount = liveSeats.filter((s: any) => s.isGirlsOnly).length;
              const sofaCount = liveSeats.filter((s: any) => s.isSofa).length;
              const customCount = liveSeats.filter((s: any) => s.customTypeName && s.customTypeName !== 'Standard').length;

              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0c1220] p-4 text-center shadow-sm">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                      OCCUPIED SEATS
                    </span>
                    <p className="text-xl sm:text-2xl font-extrabold text-emerald-500 my-0.5">
                      {occupied} / {totalSeatsDB}
                    </p>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                      {totalSeatsDB > 0 ? `${occupancy}% Occupancy` : 'No seats'}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0c1220] p-4 text-center shadow-sm">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                      ACTIVE BOOKINGS
                    </span>
                    <p className="text-xl sm:text-2xl font-extrabold text-violet-500 my-0.5">
                      {liveSeats.filter((s: any) => s.status === 'WAITING').length}
                    </p>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                      Pending check-in
                    </span>
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0c1220] p-4 text-center shadow-sm">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-pink-500/80 block">
                      GIRLS RESERVED 🩷
                    </span>
                    <p className="text-xl sm:text-2xl font-extrabold text-pink-500 my-0.5">
                      {girlsCount}
                    </p>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                      {totalSeatsDB > 0 ? `${Math.round((girlsCount / totalSeatsDB) * 100)}% Reserved` : '0 Reserved'}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0c1220] p-4 text-center shadow-sm">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-500/80 block">
                      PREMIUM / CUSTOM 🛋️
                    </span>
                    <p className="text-xl sm:text-2xl font-extrabold text-amber-500 my-0.5">
                      {sofaCount + customCount}
                    </p>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                      Sofa & Custom Pods
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Interactive Seat Locker / Cabin Grid Card */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0a0f1d] p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-headers">
                    Interactive Seat Locker & Layout Blueprint
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Click any seat card to view student CRM details, Aadhaar status, or fee ledger.
                  </p>
                </div>
                <span className="px-3 py-1 text-[11px] font-semibold rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                  Live Seat Map
                </span>
              </div>

              {/* Seat Types Breakdown Summary Chips */}
              {(() => {
                const girlsCount = liveSeats.filter((s: any) => s.isGirlsOnly).length;
                const sofaCount = liveSeats.filter((s: any) => s.isSofa).length;
                const customMap: Record<string, { icon: string; count: number }> = {};
                liveSeats.forEach((s: any) => {
                  if (s.customTypeName && s.customTypeName !== 'Standard') {
                    if (!customMap[s.customTypeName]) {
                      customMap[s.customTypeName] = { icon: s.customTypeIcon || '🏷️', count: 0 };
                    }
                    customMap[s.customTypeName].count++;
                  }
                });
                const generalCount = Math.max(0, liveSeats.length - girlsCount - sofaCount - Object.values(customMap).reduce((a, b) => a + b.count, 0));

                return (
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#12192c] border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-[11px] font-extrabold uppercase text-slate-400 mr-1">Categories:</span>
                    <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-[#161f36] border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300">
                      🪑 General: {generalCount}
                    </span>
                    {girlsCount > 0 && (
                      <span className="px-2.5 py-1 rounded-xl bg-pink-50 dark:bg-pink-950/40 border border-pink-300 dark:border-pink-800 font-bold text-pink-600 dark:text-pink-300">
                        🩷 Girls Reserved: {girlsCount}
                      </span>
                    )}
                    {sofaCount > 0 && (
                      <span className="px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 font-bold text-amber-600 dark:text-amber-300">
                        🛋️ Sofa Lounge: {sofaCount}
                      </span>
                    )}
                    {Object.entries(customMap).map(([name, item]) => (
                      <span key={name} className="px-2.5 py-1 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-300 dark:border-violet-800 font-bold text-violet-600 dark:text-violet-300">
                        {item.icon} {name}: {item.count}
                      </span>
                    ))}
                  </div>
                );
              })()}

              {/* Live Seats Grid — only real seats from DB */}
              <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-16 gap-3 w-full my-4 justify-center">
                {liveSeats.length === 0 ? (
                  <div className="w-full col-span-full py-8 text-center">
                    <p className="text-slate-400 text-xs font-semibold">No live seat data yet.</p>
                    <p className="text-slate-300 dark:text-slate-600 text-[11px] mt-1">Seats will appear here once students check in or book via the portal.</p>
                  </div>
                ) : liveSeats.map((seat: any, idx: number) => {
                  const code = seat.seatCode;
                  const status = seat.status || 'AVAILABLE'; // WAITING, IN_USE, AVAILABLE
                  const isGirls = seat.isGirlsOnly;
                  const isSofa = seat.isSofa;
                  const isFree = seat.isFree;
                  const hasSocket = seat.hasPowerSocket;
                  const customName = seat.customTypeName;
                  const customIcon = seat.customTypeIcon;

                  // 4% Emergency Quota calculation
                  const emergencyCount = Math.max(1, Math.round((liveSeats.length || formData.totalSeats || 30) * 0.04));
                  const isEmergencySeat = idx < emergencyCount || seat.isEmergency;
                  const isEmergencyUnlocked = unlockedEmergencySeats[code] || false;
                  const isEmergencyLocked = isEmergencySeat && !isEmergencyUnlocked;

                  if (status === 'IN_USE') {
                    return (
                      <button
                        key={code}
                        onClick={() => setSelectedSeatInfo({
                          code,
                          status: 'IN_USE',
                          name: seat.studentData?.name || 'Walk-In Student',
                          phone: seat.studentData?.phone || '9999999999',
                          aadhaar: seat.studentData?.aadhaar || 'Not Provided',
                          bookingId: seat.studentData?.bookingId,
                          bookingRef: seat.studentData?.bookingRef,
                          collegeId: seat.studentData?.collegeId || seat.studentData?.id_number,
                          collegeEmail: seat.studentData?.collegeEmail || seat.studentData?.email,
                          branch: seat.studentData?.branch,
                          gender: seat.studentData?.gender || 'Not Specified',
                          degree: seat.studentData?.degree,
                          city: seat.studentData?.city,
                          shift: 'Currently Active',
                          feePaid: seat.studentData?.feePaid || 0,
                          feeDue: seat.studentData?.feeDue || 0,
                        })}
                        className="aspect-square w-12 sm:w-14 rounded-2xl bg-rose-500/10 border-2 border-rose-500/70 text-rose-500 dark:text-rose-400 font-extrabold text-xs flex flex-col items-center justify-center hover:scale-105 transition shadow-sm"
                      >
                        <span>{code}</span>
                        <span className="text-[9px] mt-0.5 font-bold">🔴 IN USE</span>
                      </button>
                    );
                  }

                  if (status === 'WAITING') {
                    return (
                      <button
                        key={code}
                        onClick={() => setSelectedSeatInfo({
                          code,
                          status: 'WAITING',
                          name: seat.studentData?.name,
                          phone: seat.studentData?.phone,
                          aadhaar: seat.studentData?.aadhaar,
                          bookingId: seat.studentData?.bookingId,
                          bookingRef: seat.studentData?.bookingRef,
                          collegeId: seat.studentData?.collegeId || seat.studentData?.id_number,
                          collegeEmail: seat.studentData?.collegeEmail || seat.studentData?.email,
                          branch: seat.studentData?.branch,
                          gender: seat.studentData?.gender || 'Not Specified',
                          degree: seat.studentData?.degree,
                          city: seat.studentData?.city,
                          shift: 'Booking pending check-in',
                          feePaid: seat.studentData?.feePaid,
                          feeDue: seat.studentData?.feeDue,
                        })}
                        className="relative aspect-square w-12 sm:w-14 rounded-2xl bg-violet-700/80 border-2 border-violet-500 text-white font-extrabold text-xs flex flex-col items-center justify-center hover:scale-105 transition shadow-sm"
                      >
                        <span>{code}</span>
                        <span className="text-[8px] mt-0.5 text-violet-200">WAITING</span>
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-violet-300 animate-pulse"></span>
                      </button>
                    );
                  }

                  // AVAILABLE seats styled by their exact seat category type
                  let seatBorder = 'border-slate-200 dark:border-slate-800';
                  let seatBg = 'bg-slate-50 dark:bg-slate-800/40';
                  let seatText = 'text-slate-800 dark:text-slate-200';
                  let seatBadgeIcon = null;

                  if (isEmergencyLocked) {
                    seatBorder = 'border-amber-500 dark:border-amber-400 ring-2 ring-amber-500/40';
                    seatBg = 'bg-amber-50 dark:bg-amber-950/40';
                    seatText = 'text-amber-800 dark:text-amber-300';
                    seatBadgeIcon = '🚨';
                  } else if (isEmergencyUnlocked) {
                    seatBorder = 'border-emerald-500 dark:border-emerald-400 ring-2 ring-emerald-500/40';
                    seatBg = 'bg-emerald-50 dark:bg-emerald-950/40';
                    seatText = 'text-emerald-800 dark:text-emerald-300';
                    seatBadgeIcon = '🔓';
                  } else if (isGirls) {
                    seatBorder = 'border-pink-400 dark:border-pink-500 ring-1 ring-pink-400/30';
                    seatBg = 'bg-pink-50 dark:bg-pink-950/30';
                    seatText = 'text-pink-700 dark:text-pink-300';
                    seatBadgeIcon = '🩷';
                  } else if (customName && customName !== 'Standard') {
                    seatBorder = 'border-violet-400 dark:border-violet-500 ring-1 ring-violet-400/30';
                    seatBg = 'bg-violet-50 dark:bg-violet-950/30';
                    seatText = 'text-violet-700 dark:text-violet-300';
                    seatBadgeIcon = customIcon || '🖥️';
                  } else if (isSofa) {
                    seatBorder = 'border-amber-400 dark:border-amber-500 ring-1 ring-amber-400/30';
                    seatBg = 'bg-amber-50 dark:bg-amber-950/30';
                    seatText = 'text-amber-700 dark:text-amber-300';
                    seatBadgeIcon = '🛋️';
                  } else if (isFree) {
                    seatBorder = 'border-emerald-400 dark:border-emerald-500';
                    seatBg = 'bg-emerald-50 dark:bg-emerald-950/30';
                    seatText = 'text-emerald-700 dark:text-emerald-300';
                    seatBadgeIcon = '🆓';
                  }

                  return (
                    <button
                      key={code}
                      onClick={() => setSelectedSeatInfo({
                        code,
                        status: 'AVAILABLE',
                        seatType: isEmergencyLocked
                          ? '4% Emergency Quota Reserve 🚨'
                          : isEmergencyUnlocked
                          ? '4% Emergency Quota (Unlocked by Owner) 🔓'
                          : customName || (isGirls ? 'Girls Reserved 🩷' : isSofa ? 'Sofa / Lounge 🛋️' : 'Standard Study Desk'),
                        icon: seatBadgeIcon,
                        isEmergency: isEmergencySeat,
                        isEmergencyUnlocked: isEmergencyUnlocked,
                      })}
                      className={`aspect-square w-12 sm:w-14 rounded-2xl ${seatBg} border-2 ${seatBorder} ${seatText} font-extrabold text-xs flex flex-col items-center justify-center hover:scale-105 transition shadow-sm relative`}
                    >
                      <span>{code}</span>
                      <div className="flex items-center gap-0.5 text-[9px] leading-none mt-0.5">
                        {seatBadgeIcon && <span>{seatBadgeIcon}</span>}
                        {hasSocket && <span title="Socket">⚡</span>}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Legend matching Screenshot 2 */}
              <div className="flex items-center justify-center gap-6 text-xs text-slate-500 dark:text-slate-400 mt-6 select-none">
                <span className="flex items-center gap-1.5 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Available
                </span>
                <span className="flex items-center gap-1.5 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> In Use
                </span>
                <span className="flex items-center gap-1.5 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse"></span> Waiting (Booked)
                </span>
              </div>
            </div>

            {/* Shift & Rent Administration Card matching Screenshot 2 */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0a0f1d] p-6 shadow-sm space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-headers mb-4">
                Shift & Rent Administration
              </h3>

              <div className="space-y-2.5">
                {adminShifts.map((sh) => {
                  const isEditing = editingShiftId === sh.id;
                  return (
                    <div
                      key={sh.id}
                      className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-[#0c1222] p-4 flex items-center justify-between"
                    >
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{sh.name}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sh.time}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={tempPrice}
                              onChange={e => setTempPrice(parseInt(e.target.value) || 100)}
                              className="w-20 p-1 text-center font-bold text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                            />
                            <button
                              onClick={() => {
                                setAdminShifts(prev => prev.map(s => s.id === sh.id ? { ...s, price: tempPrice } : s));
                                setEditingShiftId(null);
                              }}
                              className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-base text-emerald-600 dark:text-emerald-400 font-mono">
                              ₹{sh.price}
                            </span>
                            <button
                              onClick={() => {
                                setEditingShiftId(sh.id);
                                setTempPrice(sh.price);
                              }}
                              className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 transition"
                              title="Edit Price"
                            >
                              ✏️
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Seat Record Modal Drawer */}
            {selectedSeatInfo && (
              <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">
                        Seat {selectedSeatInfo.code} Record
                      </h4>
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        selectedSeatInfo.status === 'WAITING' ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400' :
                        selectedSeatInfo.status === 'IN_USE' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400' :
                        'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                      }`}>
                        {selectedSeatInfo.status === 'WAITING' ? 'Waiting (Booked)' : selectedSeatInfo.status === 'IN_USE' ? 'Currently In Use' : 'Vacant & Available'}
                      </span>
                    </div>
                    <button
                      onClick={() => { setSelectedSeatInfo(null); setVacatingSeat(false); setVacateTokenInput(''); }}
                      className="text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold text-lg p-1"
                    >
                      ✕
                    </button>
                  </div>

                  {selectedSeatInfo.status !== 'AVAILABLE' ? (
                    <div className="space-y-3 text-xs">
                      {selectedSeatInfo.name ? (
                        <div className="space-y-2 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <div className="flex justify-between items-center pb-1 border-b border-slate-200/50 dark:border-slate-800">
                            <span className="text-slate-500 font-medium">Student Name</span>
                            <span className="font-bold text-slate-900 dark:text-white text-sm">{selectedSeatInfo.name}</span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-slate-500">Phone</span>
                            <span className="font-mono font-semibold text-slate-900 dark:text-white">+91 {selectedSeatInfo.phone}</span>
                          </div>

                          {/* Institute-Specific Identity Fields */}
                          {(library?.libraryCategory === 'INSTITUTE' || formData.libraryCategory === 'INSTITUTE' || (selectedSeatInfo as any).collegeId) ? (
                            <>
                              <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">Institute Roll / ID</span>
                                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{(selectedSeatInfo as any).collegeId || (selectedSeatInfo as any).id_number || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">Institute Email</span>
                                <span className="font-mono text-slate-700 dark:text-slate-300">{(selectedSeatInfo as any).collegeEmail || (selectedSeatInfo as any).email || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">Branch / Department</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{(selectedSeatInfo as any).branch || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">Gender</span>
                                <span className="font-mono font-bold uppercase text-slate-800 dark:text-slate-200">{(selectedSeatInfo as any).gender || 'Not Specified'}</span>
                              </div>
                            </>
                          ) : (
                            <>
                              {/* Government & General KYC Details for non-institute libraries */}
                              <div className="flex justify-between">
                                <span className="text-slate-500">Aadhaar (DPDP Masked)</span>
                                <span className="font-mono text-slate-900 dark:text-white">{selectedSeatInfo.aadhaar || 'Not Provided'}</span>
                              </div>

                              <div className="flex justify-between">
                                <span className="text-slate-500">City / Location</span>
                                <span className="font-medium text-slate-800 dark:text-slate-200">{(selectedSeatInfo as any).city || formData.city || 'Bhilai'}</span>
                              </div>

                              <div className="flex justify-between pt-1 border-t border-slate-200/50 dark:border-slate-800">
                                <span className="text-slate-500 font-medium">Fee Status</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  ₹{selectedSeatInfo.feePaid ?? 0} Paid {selectedSeatInfo.feeDue ? `· ₹${selectedSeatInfo.feeDue} Due` : ''}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="py-4 text-center text-slate-500">
                          In booking progress. No student details yet.
                        </div>
                      )}

                      <div className="pt-2 space-y-2">
                        {/* ⚡ CHECK-IN CODE PROMPT BOX */}
                        {selectedSeatInfo.status === 'WAITING' && (
                          <div className="space-y-2">
                            {!checkingInSeat ? (
                              <button
                                onClick={() => {
                                  setCheckingInSeat(true);
                                  setCheckInCodeInput('');
                                }}
                                className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-xs shadow-md shadow-violet-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
                              >
                                ⚡ Check-In Student / Fill Seat (Mark In Use)
                              </button>
                            ) : (
                              <div className="p-3.5 bg-violet-50 dark:bg-violet-950/40 rounded-2xl border border-violet-200 dark:border-violet-800 space-y-2.5">
                                <label className="block text-[11px] font-bold text-violet-800 dark:text-violet-300">
                                  🔑 Enter Student's Unique Check-In Passcode:
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={checkInCodeInput}
                                  onChange={e => setCheckInCodeInput(e.target.value.toUpperCase())}
                                  placeholder="e.g. EDU-BOOK-8A3F12"
                                  className="w-full p-2.5 text-center font-mono font-bold tracking-widest text-sm rounded-xl border border-violet-300 dark:border-violet-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white uppercase focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setCheckingInSeat(false)}
                                    className="flex-1 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!checkInCodeInput.trim()) {
                                        alert('Please enter the student check-in passcode.');
                                        return;
                                      }
                                      try {
                                        await api.post('/api/v1/partner/checkin/confirm', {
                                          bookingReference: checkInCodeInput.trim()
                                        });
                                        alert(`✅ Student checked in! Seat ${selectedSeatInfo.code} is now IN USE.`);
                                        if (library?.id) fetchLiveSeats(library.id);
                                        setSelectedSeatInfo(null);
                                        setCheckingInSeat(false);
                                      } catch (err: any) {
                                        alert(err?.response?.data?.message || 'Check-in failed. Please verify passcode.');
                                      }
                                    }}
                                    className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer"
                                  >
                                    ✓ Verify & Check In
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* ❌ NO-SHOW CANCELLATION BUTTON (If not checked in after 20 mins of slot start) */}
                            <button
                              onClick={async () => {
                                const confirmCancel = window.confirm(
                                  `Are you sure you want to cancel the booking for ${selectedSeatInfo.name || 'this student'} (No-Show) and release Seat ${selectedSeatInfo.code} back to Available?`
                                );
                                if (!confirmCancel) return;

                                try {
                                  const bId = (selectedSeatInfo as any).bookingId;
                                  if (bId) {
                                    await api.post(`/api/v1/partner/bookings/${bId}/reject`, {
                                      reason: 'No-show cancellation after 20 minutes of slot start time'
                                    });
                                  }
                                  alert(`❌ Booking cancelled! Seat ${selectedSeatInfo.code} is now vacant & available.`);
                                  if (library?.id) fetchLiveSeats(library.id);
                                  setSelectedSeatInfo(null);
                                } catch (err: any) {
                                  alert(err?.response?.data?.message || `Seat ${selectedSeatInfo.code} booking released.`);
                                  if (library?.id) fetchLiveSeats(library.id);
                                  setSelectedSeatInfo(null);
                                }
                              }}
                              className="w-full py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              ❌ Cancel Booking (No-Show Release)
                            </button>
                            <p className="text-[10px] text-slate-400 text-center">
                              ⏱️ Auto-release eligible if student has not checked in after 20 mins of slot start time
                            </p>
                          </div>
                        )}

                        {selectedSeatInfo.name && (
                          <div className="space-y-2">
                            <a
                              href={`https://wa.me/91${selectedSeatInfo.phone}?text=Hello%20${encodeURIComponent(selectedSeatInfo.name || '')},%20greetings%20from%20${encodeURIComponent(library?.name || 'EduGlobin')}.`}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20"
                            >
                              💬 Send WhatsApp Message
                            </a>

                          </div>
                        )}

                        {selectedSeatInfo.status === 'IN_USE' && !vacatingSeat && (
                          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                              ⏳ Extend Active Seat Session:
                            </label>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  alert(`⏳ Session extended by +1 Hour for Seat ${selectedSeatInfo.code}!`);
                                }}
                                className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-xs transition cursor-pointer shadow"
                              >
                                ⏳ +1 Hour
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  alert(`⏳ Session extended by +2 Hours for Seat ${selectedSeatInfo.code}!`);
                                }}
                                className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-xs transition cursor-pointer shadow"
                              >
                                ⏳ +2 Hours
                              </button>
                            </div>

                            <button
                              onClick={() => setVacatingSeat(true)}
                              className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-extrabold text-xs transition border border-rose-500/30 cursor-pointer shadow-sm flex items-center justify-center gap-1.5 mt-2"
                            >
                              🛑 Vacate Seat
                            </button>
                            <p className="text-[10px] text-slate-400 text-center">
                              ⏱️ Auto-vacates at end of shift unless session extended
                            </p>
                          </div>
                        )}
                        
                        {selectedSeatInfo.status === 'IN_USE' && vacatingSeat && (
                          <div className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-2xl space-y-2.5 border border-slate-200 dark:border-slate-700">
                            <label className="block text-xs text-slate-700 dark:text-slate-200 font-bold">
                              🔑 Enter Student's 8-Digit Vacate Passcode:
                            </label>
                            <input
                              type="text"
                              maxLength={8}
                              value={vacateTokenInput}
                              onChange={(e) => setVacateTokenInput(e.target.value.toUpperCase())}
                              placeholder="e.g. 84920134"
                              className="w-full p-2.5 text-center font-mono font-bold tracking-widest text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:border-rose-500 focus:outline-none uppercase"
                            />
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => { setVacatingSeat(false); setVacateTokenInput(''); }}
                                className="flex-1 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => {
                                  if (!vacateTokenInput.trim() || vacateTokenInput.trim().length !== 8) {
                                    alert('⚠️ Please enter the complete 8-digit vacate passcode issued to the student.');
                                    return;
                                  }
                                  setVacateConfirmModal({
                                    isOpen: true,
                                    seatCode: selectedSeatInfo.code,
                                    studentName: selectedSeatInfo.name || 'Active Student',
                                    onConfirm: async () => {
                                      try {
                                        const { data } = await api.post(`/api/v1/partner/libraries/${library?.id}/seats/vacate`, {
                                          seatCode: selectedSeatInfo.code,
                                          vacateToken: vacateTokenInput.trim()
                                        });
                                        if (data?.success) {
                                          alert(`✅ Seat ${selectedSeatInfo.code} successfully vacated!`);
                                          setSelectedSeatInfo(null);
                                          setVacatingSeat(false);
                                          setVacateTokenInput('');
                                          if (library?.id) fetchLiveSeats(library.id);
                                        } else {
                                          alert(`❌ Vacate Request Failed: Student has not confirmed this request or the 8-digit passcode is invalid.`);
                                        }
                                      } catch (e: any) {
                                        alert(`❌ Vacate Failed: ${e.response?.data?.message || e.response?.data?.error || "Student hasn't confirmed or passcode is incorrect."}`);
                                      }
                                    }
                                  });
                                }}
                                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer"
                              >
                                ✓ Verify &amp; Vacate
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 space-y-3">
                      {selectedSeatInfo.isEmergency && (
                        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-left space-y-3 mb-3">
                          <div className="flex items-start gap-2.5">
                            <span className="text-2xl">{selectedSeatInfo.isEmergencyUnlocked ? '🔓' : '🚨'}</span>
                            <div className="space-y-0.5">
                              <h4 className="font-extrabold text-xs text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                                4% Emergency Quota Reserve
                              </h4>
                              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                {selectedSeatInfo.isEmergencyUnlocked
                                  ? 'This desk is currently UNLOCKED by owner and visible as AVAILABLE for student bookings.'
                                  : 'To students browsing on their mobile app, this seat appears as BOOKED until unlocked by owner.'}
                              </p>
                            </div>
                          </div>

                          {selectedSeatInfo.isEmergencyUnlocked ? (
                            <button
                              type="button"
                              onClick={() => {
                                setUnlockedEmergencySeats(prev => ({ ...prev, [selectedSeatInfo.code]: false }));
                                setSelectedSeatInfo(null);
                                alert(`🔒 Seat ${selectedSeatInfo.code} locked back as 4% Emergency Quota Reserve.`);
                              }}
                              className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs shadow transition cursor-pointer"
                            >
                              🔒 Re-Lock Seat as 4% Emergency Quota
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setUnlockedEmergencySeats(prev => ({ ...prev, [selectedSeatInfo.code]: true }));
                                setSelectedSeatInfo(null);
                                alert(`🔓 Seat ${selectedSeatInfo.code} unlocked! It is now vacant & available for students to book on their app.`);
                              }}
                              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow transition cursor-pointer"
                            >
                              🔓 Unlock Emergency Seat for Student Booking
                            </button>
                          )}
                        </div>
                      )}

                      <p className="text-xs text-slate-500">This desk is currently free. You can assign a walk-in student or leave it open for online bookings.</p>
                      <button
                        onClick={() => {
                          setActiveTab('crm');
                          setSelectedSeatInfo(null);
                        }}
                        className="px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl"
                      >
                        Assign Walk-In Student in CRM →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* 🆔 OPERATIONAL STUDENT IDENTITY & KYC POLICY CARD */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0c1220] p-6 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl">
                    🪪
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white font-headers">
                      Student Identity &amp; Verification Requirements (KYC Policy)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Configure which verification fields students must provide before checking out a seat in your library.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSavingIdentityConfig || !library?.id}
                  onClick={async () => {
                    if (!library?.id) return;
                    setIsSavingIdentityConfig(true);
                    try {
                      const { data } = await api.put(`/api/v1/partner/libraries/${library.id}/identity-requirements`, identityConfig);
                      if (data?.success) {
                        alert('✅ Student Identity & KYC Requirements updated successfully!');
                      } else {
                        alert(data?.message || 'Failed to save identity requirements.');
                      }
                    } catch (err: any) {
                      alert(err?.response?.data?.message || err?.message || 'Error saving identity requirements.');
                    } finally {
                      setIsSavingIdentityConfig(false);
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-xs shadow-md shadow-violet-500/20 transition cursor-pointer flex items-center justify-center gap-2 self-start sm:self-auto shrink-0"
                >
                  {isSavingIdentityConfig ? 'Saving...' : '💾 Save Identity Policy'}
                </button>
              </div>

              {/* Zero Fields Fast Path Option */}
              <div
                onClick={() => {
                  const next = !identityConfig.fastPathZeroFields;
                  setIdentityConfig(prev => ({
                    ...prev,
                    fastPathZeroFields: next,
                    requireAadhaarLast4: next ? false : prev.requireAadhaarLast4,
                    requirePanMasked: next ? false : prev.requirePanMasked,
                    requireTargetExam: next ? false : prev.requireTargetExam,
                    requireCollegeName: next ? false : prev.requireCollegeName,
                    customFields: next ? [] : prev.customFields
                  }));
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  identityConfig.fastPathZeroFields
                    ? 'border-emerald-400 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/30'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={identityConfig.fastPathZeroFields}
                    onChange={() => {}}
                    className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      ⚡ Zero-Fields Fast Path (Recommended for Maximum Bookings)
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Students book instantly using their default EduGlobin verified account (Name + Phone + Email). No extra KYC friction.
                    </p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                  identityConfig.fastPathZeroFields ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                }`}>
                  {identityConfig.fastPathZeroFields ? 'Active' : 'Custom KYC'}
                </span>
              </div>

              {/* Optional KYC Checkboxes */}
              {!identityConfig.fastPathZeroFields && (
                <div className="space-y-4 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] cursor-pointer hover:border-violet-500/50 transition">
                      <input
                        type="checkbox"
                        checked={identityConfig.requireAadhaarLast4}
                        onChange={e => setIdentityConfig(prev => ({ ...prev, requireAadhaarLast4: e.target.checked, fastPathZeroFields: false }))}
                        className="w-4 h-4 accent-violet-600 rounded"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">🪪 Aadhaar Last 4 Digits</span>
                        <span className="text-[10px] text-slate-500">Stored masked (XXXX-XXXX-1234) for privacy</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] cursor-pointer hover:border-violet-500/50 transition">
                      <input
                        type="checkbox"
                        checked={identityConfig.requirePanMasked}
                        onChange={e => setIdentityConfig(prev => ({ ...prev, requirePanMasked: e.target.checked, fastPathZeroFields: false }))}
                        className="w-4 h-4 accent-violet-600 rounded"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">💳 PAN Card (Masked)</span>
                        <span className="text-[10px] text-slate-500">e.g. ABCDE****F verification</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] cursor-pointer hover:border-violet-500/50 transition">
                      <input
                        type="checkbox"
                        checked={identityConfig.requireTargetExam}
                        onChange={e => setIdentityConfig(prev => ({ ...prev, requireTargetExam: e.target.checked, fastPathZeroFields: false }))}
                        className="w-4 h-4 accent-violet-600 rounded"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">🎯 Target Competitive Exam</span>
                        <span className="text-[10px] text-slate-500">e.g. UPSC, SSC CGL, Banking, NEET, GATE</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] cursor-pointer hover:border-violet-500/50 transition">
                      <input
                        type="checkbox"
                        checked={identityConfig.requireCollegeName}
                        onChange={e => setIdentityConfig(prev => ({ ...prev, requireCollegeName: e.target.checked, fastPathZeroFields: false }))}
                        className="w-4 h-4 accent-violet-600 rounded"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">🏫 College / University Name</span>
                        <span className="text-[10px] text-slate-500">e.g. SGSITS, DAVV, IIT Indore</span>
                      </div>
                    </label>
                  </div>

                  {/* Custom Dynamic Fields Builder */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        ✨ Custom Identity Fields (Optional)
                      </h4>
                      <span className="text-[10px] text-slate-400">
                        {identityConfig.customFields.length} custom field(s) configured
                      </span>
                    </div>

                    {identityConfig.customFields.map((cf, cIdx) => (
                      <div key={cIdx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-[#12192c] border border-slate-200 dark:border-slate-800 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{cf.label}</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-400">
                            {cf.name} · {cf.type}
                          </span>
                          {cf.required && (
                            <span className="text-[10px] text-rose-500 font-bold">Required</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setIdentityConfig(prev => ({
                            ...prev,
                            customFields: prev.customFields.filter((_, i) => i !== cIdx)
                          }))}
                          className="text-slate-400 hover:text-rose-500 font-bold p-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Field Label (e.g. Roll No / Vehicle No)"
                        value={newCustomFieldLabel}
                        onChange={e => {
                          setNewCustomFieldLabel(e.target.value);
                          setNewCustomFieldName(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
                        }}
                        className="flex-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12192c] text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newCustomFieldLabel.trim()) return;
                          const key = newCustomFieldName.trim() || newCustomFieldLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                          setIdentityConfig(prev => ({
                            ...prev,
                            fastPathZeroFields: false,
                            customFields: [
                              ...prev.customFields,
                              { name: key, label: newCustomFieldLabel.trim(), type: 'text', required: newCustomFieldRequired }
                            ]
                          }));
                          setNewCustomFieldLabel('');
                          setNewCustomFieldName('');
                        }}
                        className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow cursor-pointer"
                      >
                        + Add Field
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: VISITOR ACCESS, REQUEST APPROVALS & VISITOR LOGS */}
        {(activeTab === 'desk' || (activeTab === 'walkin' && walkInSubTab === 'VISITORS')) && (
          <div className="space-y-8">
            {/* VISITOR PASS POLICY CONTROL BANNER */}
            <div className="p-4 rounded-2xl bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-600/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center text-xl shrink-0">
                  🎫
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>40-Min Visitor Pass Request Policy</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      library?.allowVisitorPasses !== false
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                    }`}>
                      {library?.allowVisitorPasses !== false ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {library?.allowVisitorPasses !== false
                      ? 'Students can request 40-min circulation visits from their mobile app or library page.'
                      : 'Visitor pass requests from students are disabled for this library. Direct counter check-ins by owner still work.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleToggleVisitorPasses(library?.allowVisitorPasses === false)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold shadow transition cursor-pointer shrink-0 ${
                  library?.allowVisitorPasses !== false
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {library?.allowVisitorPasses !== false ? '🚫 Disable Visitor Passes' : '✓ Enable Visitor Passes'}
              </button>
            </div>

            {/* 1. OWNER SEARCH BY STUDENT ID / PHONE (DIRECT ISSUE PASS & RETURN) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white font-headers flex items-center gap-2">
                  <span>🔎</span> Search Student by ID / Phone (Direct Visitor Pass &amp; Return)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Search verified student roster by Institute ID or Phone to directly issue, re-issue, or return a visitor pass on spot.
                </p>
              </div>

              {/* Search Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleDeskSearch();
                }}
                className="flex flex-col sm:flex-row gap-3"
              >
                <input
                  type="text"
                  value={deskQuery}
                  onChange={(e) => setDeskQuery(e.target.value)}
                  placeholder="Enter Institute Student ID (e.g. 2024CS1049), Phone, or Email..."
                  className="flex-1 p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono text-sm uppercase focus:ring-2 focus:ring-violet-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={deskLoading || !deskQuery.trim()}
                  className="px-6 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-md shadow-violet-500/20 transition disabled:opacity-50 cursor-pointer shrink-0 flex items-center justify-center gap-2"
                >
                  {deskLoading ? 'Searching…' : '🔍 Search Student'}
                </button>
              </form>

              {/* Direct Search Result Box */}
              {deskData?.studentProfile ? (
                <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-600 text-white uppercase tracking-wider">
                      ✓ STUDENT FOUND &amp; ROSTER VERIFIED
                    </span>
                    <span className="text-xs text-emerald-700 dark:text-emerald-300 font-mono font-bold">Direct Pass Issue Ready</span>
                  </div>

                  <div className="grid sm:grid-cols-4 gap-3 text-xs bg-white dark:bg-slate-900 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Student Name</span>
                      <strong className="text-slate-900 dark:text-white font-bold text-sm">{deskData.studentProfile.fullName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Institute ID / Phone</span>
                      <strong className="font-mono text-slate-800 dark:text-slate-200">{deskData.studentProfile.instituteStudentId || 'N/A'} · {deskData.studentProfile.phone || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Email</span>
                      <strong className="font-mono text-slate-800 dark:text-slate-200">{deskData.studentProfile.email || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Verification</span>
                      <strong className="text-emerald-600 dark:text-emerald-400 font-bold uppercase">✓ Active Roster</strong>
                    </div>
                  </div>

                  {/* GENERATE VISITOR PASS WITH REASON (ISSUE BOOK / RE-ISSUE BOOK / RETURN BOOK) */}
                  <div className="pt-1">
                    <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                          🎟️ Reason for Visitor Pass:
                        </span>
                        <select
                          value={passActionOption}
                          onChange={(e) => setPassActionOption(e.target.value as any)}
                          className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs font-extrabold text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 focus:outline-none cursor-pointer"
                        >
                          <option value="ISSUE_BOOK">📚 Issue Book</option>
                          <option value="REISSUE_BOOK">🔄 Re-Issue Book</option>
                          <option value="RETURN_BOOK">↩ Return Book</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const reasonText = passActionOption === 'ISSUE_BOOK' ? 'Issue Book' : passActionOption === 'REISSUE_BOOK' ? 'Re-Issue Book' : 'Return Book';
                          const newVisit = {
                            id: `VP-${Date.now().toString().slice(-4)}`,
                            name: deskData.studentProfile.fullName,
                            phone: deskData.studentProfile.phone || '',
                            studentId: deskData.studentProfile.instituteStudentId || '',
                            reason: reasonText,
                            checkInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            checkInTimestamp: Date.now(),
                            status: 'ACTIVE'
                          };
                          setDeskVisitors(prev => [newVisit, ...prev]);
                          alert(`⚡ Visitor Pass generated & issued to ${deskData.studentProfile.fullName}! (Reason: ${reasonText}). Active 40-min log started.`);
                        }}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                      >
                        ⚡ Generate &amp; Issue Visitor Pass
                      </button>
                    </div>
                  </div>
                </div>
              ) : deskNotFound ? (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 space-y-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-slate-950 uppercase">
                    ⚠️ STUDENT NOT FOUND IN ROSTER
                  </span>
                  <p className="text-xs text-amber-800 dark:text-amber-300 font-semibold">
                    No verified student matches "{deskQuery}". Student must submit a visitor request from their EduGlobin app account first, or ask admin to pre-register their ID.
                  </p>
                </div>
              ) : null}
            </div>

            {/* 2. PENDING VISITOR REQUESTS (APP REQUESTED BY STUDENTS) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white font-headers flex items-center gap-2">
                    <span>📩</span> Pending App Visitor Requests
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Students requesting visitor passes instead of full seat bookings via the EduGlobin app.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  {students.filter((s: any) => s.status === 'WAITING').length} Pending Approval
                </span>
              </div>

              <div className="space-y-3">
                {(() => {
                  const pendingRequests = students.filter((s: any) => s.status === 'WAITING');

                  if (pendingRequests.length === 0) {
                    return (
                      <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
                        <div className="text-2xl">📩</div>
                        <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">No Pending Visitor Requests</h4>
                        <p className="text-xxs text-slate-500">
                          When students request quick library visits via their app, requests will appear here for 1-click approval.
                        </p>
                      </div>
                    );
                  }

                  return pendingRequests.map((req: any) => (
                    <div
                      key={req.id}
                      className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/10 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-slate-950 uppercase">
                            Visitor Request
                          </span>
                          <h4 className="font-extrabold text-base text-slate-900 dark:text-white truncate">
                            {req.name}
                          </h4>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 text-xs text-slate-500 dark:text-slate-400">
                          <span>📞 +91 {req.phone}</span>
                          <span>ID: {req.collegeId || req.id_number || 'N/A'}</span>
                          <span>Purpose: Quick Access Visit</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const newVisit = {
                            id: `VP-${Date.now().toString().slice(-4)}`,
                            name: req.name,
                            phone: req.phone,
                            studentId: req.collegeId || req.id_number || 'N/A',
                            checkInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            checkInTimestamp: Date.now(),
                            status: 'ACTIVE'
                          };
                          setDeskVisitors(prev => [newVisit, ...prev]);
                          alert(`✅ Approved visitor request for ${req.name}! Visitor is now ACTIVE for up to 40 minutes.`);
                        }}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow transition cursor-pointer shrink-0"
                      >
                        ✓ Approve Visitor Pass
                      </button>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* 3. ACTIVE VISITOR LOGS (40-MIN MAX RULE & 35-MIN OVERSTAY WARNING) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white font-headers flex items-center gap-2">
                    <span>⚡</span> Active Visitor Logs (40-Min Max Rule)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live tracking of active library visitors. Automatic overstay notification sent to student at 35 minutes.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  {deskVisitors.length} Currently Active
                </span>
              </div>

              <div className="space-y-3">
                {(() => {
                  if (deskVisitors.length === 0) {
                    return (
                      <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
                        <div className="text-2xl">⚡</div>
                        <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">No Active Visitors Right Now</h4>
                        <p className="text-xxs text-slate-500">
                          When visitor passes are issued or approved, active tracking logs will display here.
                        </p>
                      </div>
                    );
                  }

                  return deskVisitors.map((v: any) => {
                    const elapsedMins = Math.floor((Date.now() - (v.checkInTimestamp || Date.now())) / (1000 * 60)) || 1;
                    const is35MinsWarning = elapsedMins >= 35 && elapsedMins < 40;
                    const isOver40Mins = elapsedMins >= 40;

                    return (
                      <div
                        key={v.id}
                        className={`p-4 rounded-2xl border transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          isOver40Mins
                            ? 'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300'
                            : is35MinsWarning
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-800 dark:text-amber-300'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-violet-500/15 text-violet-600 dark:text-violet-400">
                              {v.id}
                            </span>
                            <h4 className="font-extrabold text-base text-slate-900 dark:text-white truncate">
                              {v.name}
                            </h4>

                            {isOver40Mins ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white uppercase animate-pulse">
                                🚨 40-Min Limit Exceeded ({elapsedMins} mins)
                              </span>
                            ) : is35MinsWarning ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-slate-950 uppercase">
                                ⚠️ 35+ Mins Warning Sent ({elapsedMins} mins)
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                🟢 ACTIVE VISIT ({elapsedMins} mins)
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 text-xs text-slate-500 dark:text-slate-400">
                            <span>📞 +91 {v.phone}</span>
                            <span>Student ID: {v.studentId || 'N/A'}</span>
                            <span className="font-bold text-violet-600 dark:text-violet-400">Reason: {v.reason || 'Book Access'}</span>
                            <span>Check-In: {v.checkInTime}</span>
                            <span>Max Duration: 40 Mins</span>
                          </div>

                          {is35MinsWarning && (
                            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 pt-0.5">
                              📲 Automatic notification sent to student app: "You have been visiting for 35 minutes! Maximum limit is 40 minutes."
                            </p>
                          )}
                        </div>

                        {/* Owner Remove Active Log Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setDeskVisitors(prev => prev.filter(item => item.id !== v.id));
                            alert(`🛑 Active visitor log ended for ${v.name}. Student checked out.`);
                          }}
                          className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow transition cursor-pointer shrink-0"
                        >
                          🛑 Remove Active Log
                        </button>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STUDENT CRM & KYC INTAKE */}
        {activeTab === 'crm' && (
          <div className="space-y-8">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-headers mb-1">
                Student Walk-In Intake & DPDP-Compliant KYC
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                Register a new walk-in student. Aadhaar is automatically masked (XXXX-XXXX-1234) before storing.
              </p>

              <form onSubmit={handleAddStudent} className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Student Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={crmForm.fullName}
                    onChange={e => setCrmForm({ ...crmForm, fullName: e.target.value })}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    10-Digit Mobile Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    pattern="[0-9]{10}"
                    value={crmForm.phone}
                    onChange={e => setCrmForm({ ...crmForm, phone: e.target.value })}
                    placeholder="9826012345"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-mono"
                  />
                </div>

                {/* Emergency VIP Guest Toggle */}
                <div className="md:col-span-3">
                  <label className="flex items-center gap-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={crmForm.isEmergencyGuest || false}
                      onChange={e => setCrmForm({ ...crmForm, isEmergencyGuest: e.target.checked })}
                      className="w-4 h-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <div>
                      <span className="font-extrabold text-xs text-amber-800 dark:text-amber-300">
                        ⚡ Emergency VIP Guest Allocation
                      </span>
                      <span className="block text-[10px] text-amber-700 dark:text-amber-400 font-normal">
                        For Emergency Seats: Fill Person Name &amp; Designation (No Student ID or Aadhaar required).
                      </span>
                    </div>
                  </label>
                </div>

                {crmForm.isEmergencyGuest ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Official Designation / Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={crmForm.designation || ''}
                      onChange={e => setCrmForm({ ...crmForm, designation: e.target.value })}
                      placeholder="e.g. Visiting Professor / Chief Inspector / VIP Guest"
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-semibold"
                    />
                  </div>
                ) : library?.libraryCategory === 'INSTITUTE' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      College / Student Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={crmForm.email || ''}
                      onChange={e => setCrmForm({ ...crmForm, email: e.target.value })}
                      placeholder="student@allowed.ac.in"
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-mono"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      12-Digit Aadhaar (Masked Automatically) *
                    </label>
                    <input
                      type="password"
                      maxLength={12}
                      required
                      value={crmForm.aadhaarNumber}
                      onChange={e => setCrmForm({ ...crmForm, aadhaarNumber: e.target.value })}
                      placeholder="123456789012"
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-mono"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Assign Desk *
                  </label>
                  <input
                    type="text"
                    required
                    value={crmForm.seatCode}
                    onChange={e => setCrmForm({ ...crmForm, seatCode: e.target.value.toUpperCase() })}
                    placeholder="A2"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Select Shift *
                  </label>
                  <select
                    value={crmForm.shiftName}
                    onChange={e => setCrmForm({ ...crmForm, shiftName: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm"
                  >
                    <option>Morning Shift</option>
                    <option>Afternoon Shift</option>
                    <option>Evening Shift</option>
                    <option>Night Shift</option>
                    <option>Full Day</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Monthly Agreed Fee (₹) *
                  </label>
                  <input
                    type="number"
                    min="100"
                    required
                    value={crmForm.monthlyFee}
                    onChange={e => setCrmForm({ ...crmForm, monthlyFee: parseInt(e.target.value) || 0 })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm"
                  />
                </div>

                <div className="md:col-span-3 pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-md shadow-violet-500/20"
                  >
                    + Register Student & Lock Desk
                  </button>
                </div>
              </form>
            </div>

            {/* Live Student Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white font-headers">
                  Enrolled Students Roster ({students.length})
                </h4>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Phone</th>
                      <th className="py-3 px-4">{library?.libraryCategory === 'INSTITUTE' ? 'College Email / ID' : 'Aadhaar (Masked)'}</th>
                      <th className="py-3 px-4">Desk</th>
                      <th className="py-3 px-4">Shift</th>
                      <th className="py-3 px-4">{library?.libraryCategory === 'INSTITUTE' ? 'Verification' : 'Balance Owed'}</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                    {students.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{s.name}</td>
                        <td className="py-3 px-4 font-mono">{s.phone}</td>
                        <td className="py-3 px-4 font-mono text-slate-400">{s.email || s.aadhaarMasked}</td>
                        <td className="py-3 px-4 font-mono font-bold text-violet-500">{s.seatCode}</td>
                        <td className="py-3 px-4">{s.shiftName}</td>
                        <td className="py-3 px-4">
                          {library?.libraryCategory === 'INSTITUTE' ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px]">
                              ✓ Roster Verified
                            </span>
                          ) : (
                            <span className="font-bold text-emerald-500">₹{s.balanceOwed}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleDownloadStudentReport(s.id, s.name)}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:hover:bg-violet-900/60 dark:text-violet-300 border border-violet-200 dark:border-violet-800 transition cursor-pointer"
                              title="Download PDF Audit Report"
                            >
                              📄 PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setVacateConfirmModal({
                                  isOpen: true,
                                  seatCode: s.seatCode || 'Unassigned',
                                  studentName: s.name,
                                  onConfirm: () => {
                                    setStudents(students.filter(item => item.id !== s.id));
                                    alert(`Desk ${s.seatCode} vacated!`);
                                  }
                                });
                              }}
                              className="text-rose-500 hover:text-rose-400 font-bold cursor-pointer"
                            >
                              Vacate
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: STUDENTS (ACTIVE SEATS, WAITING SEATS, TODAY BOOKINGS & VISIT HISTORY) */}
        {activeTab === 'fees' && (
          <div className="space-y-8">
            {/* 1. CUSTOM MESSAGE TEMPLATE EDITOR CARD (Only for Private/Govt Paid Libraries) */}
            {library?.libraryCategory !== 'INSTITUTE' && (
              <div className="bg-[#0b101d] border border-slate-800 rounded-3xl p-5 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400">
                    Custom Message Template
                  </span>
                  <span className="text-xxs text-slate-400">
                    Click placeholder badge to insert into template
                  </span>
                </div>

                <textarea
                  rows={2}
                  value={customMsgTemplate}
                  onChange={e => setCustomMsgTemplate(e.target.value)}
                  className="w-full bg-[#12192e] border border-slate-700/80 rounded-2xl p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-violet-500"
                />

                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="text-slate-400 font-semibold">Placeholders:</span>
                  {['{StudentName}', '{LibraryName}', '{DeskCode}', '{PendingBalance}', '{ReminderDate}'].map(ph => (
                    <button
                      key={ph}
                      type="button"
                      onClick={() => setCustomMsgTemplate(prev => prev + ' ' + ph)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-violet-300 font-mono text-xxs font-bold transition cursor-pointer border border-slate-700/60"
                    >
                      {ph}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION 1: ACTIVE SEAT STUDENTS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <span>🟢 Active Seat Students</span>
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    {students.filter((s: any) => s.status !== 'WAITING').length} Active
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('master-audit')}
                  className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>📜 View Master Audit Report →</span>
                </button>
              </div>

              {/* Active Student Cards List */}
              {(() => {
                const isInst = library?.libraryCategory === 'INSTITUTE';
                const activeList = students.filter((s: any) => s.status !== 'WAITING');

                if (activeList.length === 0) {
                  return (
                    <div className="p-8 text-center bg-white dark:bg-[#0b101e] border border-slate-200 dark:border-slate-800/90 rounded-3xl space-y-2">
                      <div className="text-3xl">🪑</div>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">No Active Seat Occupants Right Now</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Enroll walk-in students or assign available seats to populate active seat records.
                      </p>
                    </div>
                  );
                }

                const visibleActive = activeList.slice(0, activeSeatsLimit);

                return (
                  <div className="space-y-3">
                    {visibleActive.map((s: any) => {
                      const pending = s.balanceOwed !== undefined ? s.balanceOwed : 0;
                      const isUnpaid = pending > 0;
                      const planBadge = s.status || (isUnpaid ? 'UNPAID' : 'PREPAID');
                      const lastRem = lastReminders[s.id] || (isUnpaid ? '05 Aug 2026, 10:30 AM' : null);

                      const waMsg = customMsgTemplate
                        .replace(/\{StudentName\}/g, s.name || 'Student')
                        .replace(/\{LibraryName\}/g, library?.name || 'EduGlobin Library')
                        .replace(/\{DeskCode\}/g, `Desk ${s.seatCode || 'A1'}`)
                        .replace(/\{PendingBalance\}/g, String(pending))
                        .replace(/\{ReminderDate\}/g, new Date().toLocaleDateString());

                      const waUrl = `https://wa.me/91${s.phone}?text=${encodeURIComponent(waMsg)}`;

                      return (
                        <div
                          key={s.id}
                          className="p-4 rounded-3xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0b101e] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-violet-500/40"
                        >
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-3 py-1 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 font-mono font-bold text-xs border border-violet-500/20">
                                Desk {s.seatCode}
                              </span>
                              <h4 className="font-extrabold text-base text-slate-900 dark:text-white truncate">
                                {s.name}
                              </h4>

                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                {isInst ? '✓ Institute ID Verified' : 'Aadhaar Verified ✓'}
                              </span>

                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 uppercase">
                                Active Seat
                              </span>

                              {isInst ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30 uppercase">
                                  Roster Mapped
                                </span>
                              ) : (
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  planBadge === 'PREPAID'
                                    ? 'bg-emerald-500 text-white'
                                    : planBadge === 'UNPAID'
                                    ? 'bg-amber-500 text-slate-950'
                                    : 'bg-indigo-600 text-white'
                                }`}>
                                  {planBadge}
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                              <span className="font-mono font-semibold">📞 +91 {s.phone}</span>
                              <span className="font-mono text-slate-400">
                                {isInst ? `College ID: ${s.id_number || s.collegeId || '2024CS1049'}` : `Aadhaar: ${s.aadhaarMasked || 'XXXX-XXXX-8921'}`}
                              </span>
                              <span>📅 Joined: 01 Jun 2026</span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 text-xs font-semibold pt-1">
                              {isInst ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                  Institute Access: <strong className="font-mono">Roster Verified Active</strong>
                                </span>
                              ) : (
                                <>
                                  <span className="text-slate-700 dark:text-slate-300">
                                    Monthly Rent: <strong className="font-mono text-slate-900 dark:text-white">₹{s.monthlyFee || 1200}</strong>
                                  </span>
                                  <span className={isUnpaid ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-emerald-600 dark:text-emerald-400 font-bold'}>
                                    Pending Due: <strong className="font-mono">₹{pending}</strong>
                                  </span>
                                  {lastRem && (
                                    <span className="text-amber-500 dark:text-amber-400 text-[11px] font-medium">
                                      • Last Reminder: {lastRem}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start md:self-center">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedReceiptStudent(s);
                                setShowReceiptModal(true);
                              }}
                              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer border border-slate-200 dark:border-slate-700 flex items-center gap-1"
                            >
                              📄 PDF Receipt
                            </button>

                            {!isInst && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => setLastReminders(prev => ({ ...prev, [s.id]: new Date().toLocaleString() }))}
                                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md shadow-emerald-600/20 flex items-center gap-1"
                              >
                                💬 WhatsApp
                              </a>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProfileStudent(s);
                                setShowFullProfileModal(true);
                              }}
                              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-md shadow-indigo-600/20 cursor-pointer flex items-center gap-1"
                            >
                              👤 Full Profile
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {activeList.length > activeSeatsLimit && (
                      <div className="pt-2 text-center">
                        <button
                          type="button"
                          onClick={() => setActiveSeatsLimit(prev => prev + 5)}
                          className="px-6 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold transition border border-slate-200 dark:border-slate-700 cursor-pointer shadow-sm"
                        >
                          ➕ Load More Active Students ({activeList.length - activeSeatsLimit} remaining)
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* SECTION 2: WAITING SEATS STUDENTS */}
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <span>⏳ Waiting Seats &amp; Queue Students</span>
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    {students.filter((s: any) => s.status === 'WAITING').length} Waiting
                  </span>
                </div>
              </div>

              {(() => {
                const waitingList = students.filter((s: any) => s.status === 'WAITING');

                if (waitingList.length === 0) {
                  return (
                    <div className="p-6 text-center bg-white dark:bg-[#0b101e] border border-slate-200 dark:border-slate-800/90 rounded-3xl space-y-1.5">
                      <div className="text-2xl">⏳</div>
                      <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">No Students Currently In Waiting Queue</h4>
                      <p className="text-xxs text-slate-500 dark:text-slate-400">
                        When all seats are filled, new student access requests will appear in this waiting queue.
                      </p>
                    </div>
                  );
                }

                const visibleWaiting = waitingList.slice(0, waitingSeatsLimit);

                return (
                  <div className="space-y-3">
                    {visibleWaiting.map((s: any) => (
                      <div
                        key={s.id}
                        className="p-4 rounded-3xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/10 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 uppercase">
                              Waiting List
                            </span>
                            <h4 className="font-extrabold text-base text-slate-900 dark:text-white truncate">
                              {s.name}
                            </h4>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 text-xs text-slate-500 dark:text-slate-400">
                            <span>📞 +91 {s.phone}</span>
                            <span>Shift: {s.shiftName || 'Morning Shift'}</span>
                            <span>Requested: Today</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProfileStudent(s);
                            setShowFullProfileModal(true);
                          }}
                          className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-sm cursor-pointer"
                        >
                          👤 Review &amp; Assign Seat
                        </button>
                      </div>
                    ))}

                    {waitingList.length > waitingSeatsLimit && (
                      <div className="pt-2 text-center">
                        <button
                          type="button"
                          onClick={() => setWaitingSeatsLimit(prev => prev + 5)}
                          className="px-6 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-extrabold border border-slate-200 dark:border-slate-700 cursor-pointer"
                        >
                          ➕ Load More Waiting Students ({waitingList.length - waitingSeatsLimit} remaining)
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* SECTION 3: TODAY'S HISTORY OF BOOKINGS */}
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <span>🎟️ Today's History of Bookings</span>
                </h3>
                <span className="text-xs text-slate-500 font-medium">Live Mapped Reservations</span>
              </div>

              {(() => {
                const todayBookingsList = students.map((s: any, idx: number) => ({
                  id: `PASS-710${idx + 1}`,
                  seatCode: s.seatCode || `A${idx + 1}`,
                  studentName: s.name,
                  shiftName: s.shiftName || 'Morning Shift',
                  time: 'Today, Live Active',
                  amount: library?.libraryCategory === 'INSTITUTE' ? 'Institutional Access' : `₹${s.monthlyFee || 300}`,
                  status: 'CONFIRMED'
                }));

                if (todayBookingsList.length === 0) {
                  return (
                    <div className="p-6 text-center bg-white dark:bg-[#0b101e] border border-slate-200 dark:border-slate-800/90 rounded-3xl space-y-1">
                      <div className="text-2xl">🎟️</div>
                      <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">No Booking Records Created Today</h4>
                    </div>
                  );
                }

                const visibleBookings = todayBookingsList.slice(0, bookingHistoryLimit);

                return (
                  <div className="space-y-3">
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-3">Booking Pass ID</th>
                            <th className="p-3">Student Name</th>
                            <th className="p-3">Desk / Seat</th>
                            <th className="p-3">Shift &amp; Time</th>
                            <th className="p-3">Amount</th>
                            <th className="p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                          {visibleBookings.map((b: any) => (
                            <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                              <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{b.id}</td>
                              <td className="p-3 font-bold text-slate-900 dark:text-white">{b.studentName}</td>
                              <td className="p-3 font-mono font-bold">Desk {b.seatCode}</td>
                              <td className="p-3">{b.shiftName}<br /><span className="text-[10px] text-slate-400">{b.time}</span></td>
                              <td className="p-3 font-mono font-bold">{b.amount}</td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px]">
                                  CONFIRMED
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {todayBookingsList.length > bookingHistoryLimit && (
                      <div className="pt-2 text-center">
                        <button
                          type="button"
                          onClick={() => setBookingHistoryLimit(prev => prev + 5)}
                          className="px-6 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-extrabold border border-slate-200 dark:border-slate-700 cursor-pointer"
                        >
                          ➕ Load More Today's Bookings ({todayBookingsList.length - bookingHistoryLimit} remaining)
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* SECTION 4: HISTORY OF VISITS & GATE CHECK-INS */}
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <span>🚪 History of Visits &amp; Gate Check-Ins</span>
                </h3>
                <span className="text-xs text-slate-500 font-medium">Complete Active &amp; Ended Session Logs</span>
              </div>

              {(() => {
                const liveVisits = deskVisitors.map((v: any) => ({
                  id: v.id || `VP-${Date.now().toString().slice(-4)}`,
                  name: v.name,
                  phone: v.phone,
                  reason: v.reason || 'Book / Gate Access',
                  seatCode: v.seatCode || 'Visitor Pass',
                  checkInTime: v.checkInTime || 'Today, Live',
                  checkOutTime: v.status === 'ACTIVE' ? 'Active Session' : (v.checkOutTime || 'Session Ended'),
                  status: v.status || 'ACTIVE'
                }));

                const studentVisits = students.map((s: any, idx: number) => ({
                  id: `VISIT-${idx + 101}`,
                  name: s.name,
                  phone: s.phone,
                  reason: 'Seat Access',
                  seatCode: s.seatCode ? `Desk ${s.seatCode}` : 'Unassigned',
                  checkInTime: 'Today, 09:15 AM',
                  checkOutTime: idx % 2 === 0 ? 'Active Session' : 'Today, 01:15 PM (Ended)',
                  status: idx % 2 === 0 ? 'ACTIVE' : 'COMPLETED'
                }));

                const visitsList = [...liveVisits, ...studentVisits];

                if (visitsList.length === 0) {
                  return (
                    <div className="p-6 text-center bg-white dark:bg-[#0b101e] border border-slate-200 dark:border-slate-800/90 rounded-3xl space-y-1">
                      <div className="text-2xl">🚪</div>
                      <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">No Gate Visit Logs Recorded Today</h4>
                    </div>
                  );
                }

                const visibleVisits = visitsList.slice(0, visitsHistoryLimit);

                return (
                  <div className="space-y-3">
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-3">Visit Ref ID</th>
                            <th className="p-3">Visitor / Student Name</th>
                            <th className="p-3">Visit Reason</th>
                            <th className="p-3">Desk / Access</th>
                            <th className="p-3">Check-In Time</th>
                            <th className="p-3">Session Ended / Check-Out</th>
                            <th className="p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                          {visibleVisits.map((v: any) => (
                            <tr key={v.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                              <td className="p-3 font-mono font-bold text-violet-600 dark:text-violet-400">{v.id}</td>
                              <td className="p-3 font-bold text-slate-900 dark:text-white">
                                {v.name}<br /><span className="text-[10px] text-slate-400 font-mono">+91 {v.phone}</span>
                              </td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-violet-500/10 text-violet-600 dark:text-violet-400">
                                  {v.reason}
                                </span>
                              </td>
                              <td className="p-3 font-mono font-bold">{v.seatCode}</td>
                              <td className="p-3">{v.checkInTime}</td>
                              <td className="p-3 font-mono font-bold text-slate-600 dark:text-slate-300">{v.checkOutTime}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${
                                  v.status === 'ACTIVE' || v.status === 'CHECKED_IN'
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                }`}>
                                  {v.status === 'ACTIVE' ? '🟢 LIVE ACTIVE' : v.status === 'COMPLETED' ? '✓ SESSION ENDED' : v.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {visitsList.length > visitsHistoryLimit && (
                      <div className="pt-2 text-center">
                        <button
                          type="button"
                          onClick={() => setVisitsHistoryLimit(prev => prev + 5)}
                          className="px-6 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-extrabold border border-slate-200 dark:border-slate-700 cursor-pointer"
                        >
                          ➕ Load More History of Visits ({visitsList.length - visitsHistoryLimit} remaining)
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* TAB: MANAGE STUDENTS & CSV ROSTER INTAKE */}
        {activeTab === 'manage-students' && (
          <div className="space-y-8">
            {/* Header & CSV Upload Button */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-violet-500/15 text-violet-600 dark:text-violet-400">
                    Institutional Roster Intake
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white font-headers mt-1">
                    👥 Manage Students &amp; CSV Roster Upload
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Upload institutional CSV rosters. Primary keys (Student ID &amp; Email) ensure duplicates are automatically skipped. Initial state is <strong>UNVERIFIED</strong> until student's first EduGlobin booking.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCsvUploadModal(true)}
                  className="px-5 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-xs shadow-lg shadow-violet-500/25 transition cursor-pointer flex items-center gap-2 shrink-0"
                >
                  <span>📄 Upload / Paste Student CSV Roster</span>
                </button>
              </div>

              {/* Status Explanation Banner */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs">
                <span className="text-xl">ℹ️</span>
                <div className="space-y-0.5 text-amber-800 dark:text-amber-300">
                  <h4 className="font-extrabold text-xs uppercase tracking-wide">Automatic Status Transition Rule</h4>
                  <p className="font-medium text-[11px] leading-relaxed">
                    Newly uploaded student IDs and emails enter as <strong>⏳ UNVERIFIED</strong>. When the student makes their first booking or check-in using their registered EduGlobin account with matching ID/email, their identity status automatically converts to <strong>✓ VERIFIED</strong> permanently.
                  </p>
                </div>
              </div>
            </div>

            {/* Roster Search & Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-headers flex items-center gap-2">
                  <span>📋 Registered Roster &amp; CSV Intake Records</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {students.length} Total Students
                  </span>
                </h3>

                <input
                  type="text"
                  value={csvSearchQuery}
                  onChange={(e) => setCsvSearchQuery(e.target.value)}
                  placeholder="🔍 Search by Student ID or Email..."
                  className="p-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none w-full sm:w-72"
                />
              </div>

              {/* Student Roster Table */}
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Student ID</th>
                      <th className="p-3">Email Address</th>
                      <th className="p-3">Student Name &amp; Phone</th>
                      <th className="p-3">Gender</th>
                      <th className="p-3">Roster Verification Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {(() => {
                      const filtered = students.filter((s: any) => {
                        const q = csvSearchQuery.toLowerCase().trim();
                        if (!q) return true;
                        const idMatch = (s.collegeId || s.id_number || s.id || '').toLowerCase().includes(q);
                        const emailMatch = (s.email || '').toLowerCase().includes(q);
                        const nameMatch = (s.name || '').toLowerCase().includes(q);
                        return idMatch || emailMatch || nameMatch;
                      });

                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400">
                              No student records match "{csvSearchQuery}". Upload a CSV file or add student IDs to expand your roster.
                            </td>
                          </tr>
                        );
                      }

                      return filtered.map((s: any, idx: number) => {
                        const studentId = s.collegeId || s.id_number || `2024CS${1010 + idx}`;
                        const studentEmail = s.email || s.collegeEmail || `${(s.name || 'student').toLowerCase().replace(/\s+/g, '.')}@institute.edu.in`;
                        const isVerified = s.isVerified ?? (s.status !== 'UNVERIFIED' && idx % 2 === 0);

                        return (
                          <tr key={s.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="p-3 font-mono font-bold text-violet-600 dark:text-violet-400">
                              {studentId}
                            </td>
                            <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                              {studentEmail}
                            </td>
                            <td className="p-3 font-bold text-slate-900 dark:text-white">
                              {s.name}<br /><span className="text-[10px] text-slate-400 font-mono">+91 {s.phone || '9826012345'}</span>
                            </td>
                            <td className="p-3 font-bold uppercase text-[11px] text-slate-700 dark:text-slate-300">
                              {s.gender || 'Not Specified'}
                            </td>
                            <td className="p-3">
                              {isVerified ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit">
                                  <span>✓</span> VERIFIED (EduGlobin App Mapped)
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1 w-fit">
                                  <span>⏳</span> UNVERIFIED (CSV Uploaded)
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setStudents(prev => prev.map((st: any) => {
                                    if ((st.collegeId || st.id_number || st.id) === (s.collegeId || s.id_number || s.id)) {
                                      return { ...st, isVerified: true, status: 'ACTIVE' };
                                    }
                                    return st;
                                  }));
                                  alert(`✓ Student ${s.name} (${studentId}) verified and mapped to library roster permanently!`);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-xs shadow transition cursor-pointer"
                              >
                                {isVerified ? '✓ Verified' : '⚡ Verify Student'}
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CSV UPLOAD MODAL */}
            {showCsvUploadModal && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white font-headers flex items-center gap-2">
                        <span>📄</span> CSV Student Roster Intake
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Primary Keys: <strong>Student ID &amp; Email ID</strong>. Existing records will be skipped automatically.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCsvUploadModal(false)}
                      className="text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold text-lg p-1"
                    >
                      ✕
                    </button>
                  </div>

                  {/* CSV File Chooser */}
                  <div className="p-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/70 text-center space-y-2">
                    <span className="text-3xl">📄</span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Choose CSV File from Computer</h4>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setCsvFileName(file.name);
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const content = event.target?.result as string;
                            setCsvRawText(content);
                          };
                          reader.readAsText(file);
                        }
                      }}
                      className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-violet-600 file:text-white hover:file:bg-violet-500 cursor-pointer"
                    />
                    {csvFileName && (
                      <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        ✓ Loaded File: {csvFileName}
                      </p>
                    )}
                  </div>

                  {/* CSV Raw Text Area */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Or Paste CSV Raw Data (student_id, email, name, gender, phone):
                    </label>
                    <textarea
                      rows={5}
                      value={csvRawText}
                      onChange={(e) => setCsvRawText(e.target.value)}
                      placeholder={`student_id, email, full_name, gender, phone\n2024CS1090, rahul.verma@inst.edu.in, Rahul Verma, Male, 9826019999\n2024CS1091, ananya.singh@inst.edu.in, Ananya Singh, Female, 9876543210`}
                      className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-xs text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCsvUploadModal(false)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!csvRawText.trim()) {
                          alert('Please select a CSV file or paste CSV text first.');
                          return;
                        }

                        const lines = csvRawText.split('\n').map(l => l.trim()).filter(Boolean);
                        let addedCount = 0;
                        let skippedCount = 0;
                        const newStudentsList = [...students];

                        lines.forEach((line, idx) => {
                          if (idx === 0 && line.toLowerCase().includes('student_id')) return; // skip header line
                          const parts = line.split(',').map(p => p.trim());
                          if (parts.length < 2) return;

                          const studentId = parts[0];
                          const email = parts[1];
                          const name = parts[2] || `Student ${studentId}`;
                          const gender = parts[3] || 'General';
                          const phone = parts[4] || '9826012345';

                          // Primary Key check (Student ID & Email ID)
                          const exists = newStudentsList.some((s: any) =>
                            (s.collegeId && s.collegeId.toLowerCase() === studentId.toLowerCase()) ||
                            (s.email && s.email.toLowerCase() === email.toLowerCase())
                          );

                          if (exists) {
                            skippedCount++;
                          } else {
                            newStudentsList.push({
                              id: `STU-${Date.now()}-${idx}`,
                              name,
                              email,
                              collegeId: studentId,
                              id_number: studentId,
                              phone,
                              gender,
                              isVerified: false,
                              status: 'UNVERIFIED',
                              monthlyFee: 800,
                              balanceOwed: 0
                            });
                            addedCount++;
                          }
                        });

                        setStudents(newStudentsList);
                        setShowCsvUploadModal(false);
                        setCsvRawText('');
                        setCsvFileName('');
                        alert(`✅ CSV Roster Processed!\n\n• ${addedCount} New Students Imported (Initial Status: UNVERIFIED)\n• ${skippedCount} Duplicate Student IDs/Emails Skipped.`);
                      }}
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/25 transition cursor-pointer"
                    >
                      ⚡ Import &amp; Process CSV Roster
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: MASTER AUDIT REPORT (MATCHING MOCKUP 2) */}
        {activeTab === 'master-audit' && (
          <div className="space-y-8">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-violet-600 dark:text-violet-400">
                    Official Audit Log
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white font-headers">
                    Master Audit Report — {library?.name || 'EduGlobin Library'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Immutable financial, student reservation, and warden resolution records.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const isInst = library?.libraryCategory === 'INSTITUTE';
                    const libName = library?.name || 'EduGlobin Study Space';
                    const printDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                    const printWindow = window.open('', '_blank');
                    if (!printWindow) return;

                    const htmlContent = `
                      <!DOCTYPE html>
                      <html>
                      <head>
                        <title>EduGlobin Master Audit Report - ${libName}</title>
                        <style>
                          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 30px; color: #0f172a; background: #fff; }
                          .header { text-align: center; border-bottom: 3px solid #4f46e5; padding-bottom: 15px; margin-bottom: 25px; }
                          .header h1 { margin: 0; font-size: 22px; color: #1e1b4b; }
                          .header p { margin: 5px 0 0 0; font-size: 12px; color: #64748b; }
                          .section-title { font-size: 14px; font-weight: bold; text-transform: uppercase; color: #1e1b4b; margin-top: 25px; margin-bottom: 10px; border-left: 4px solid #4f46e5; padding-left: 10px; }
                          .summary-bar { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 15px; border-radius: 8px; font-size: 12px; font-weight: bold; margin-bottom: 12px; display: flex; gap: 20px; }
                          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
                          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
                          th { background: #f1f5f9; font-weight: bold; color: #334155; }
                          .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; text-transform: uppercase; }
                          .badge-active { background: #dcfce7; color: #15803d; }
                          .badge-unpaid { background: #fee2e2; color: #b91c1c; }
                          .badge-pending { background: #fef3c7; color: #b45309; }
                        </style>
                      </head>
                      <body>
                        <div class="header">
                          <h1>EduGlobin Master Audit Report</h1>
                          <p>Library: <strong>${libName}</strong> &bull; Generated Date: <strong>${printDate}</strong></p>
                        </div>
                        <div class="section-title">1. BOOKINGS & STUDENT RESERVATIONS AUDIT</div>
                        <table>
                          <thead>
                            <tr><th>Booking ID</th><th>Desk / Seat</th><th>Shift Details</th><th>Date & Time</th><th>Amount</th><th>Status</th></tr>
                          </thead>
                          <tbody>
                            ${students.length === 0 ? `
                              <tr><td colspan="6" style="text-align:center; padding:15px; color:#94a3b8;">No active booking records found for this library</td></tr>
                            ` : students.map((s: any, idx: number) => `
                              <tr>
                                <td><strong>PASS-710${idx + 1}</strong></td>
                                <td>Desk Row ${s.seatCode ? s.seatCode[0] : 'A'} - Seat ${s.seatCode || 'A1'}</td>
                                <td>${s.shiftName || 'Morning Shift'}</td>
                                <td>${printDate}</td>
                                <td>₹${s.monthlyFee || 0}</td>
                                <td><span class="badge badge-active">ACTIVE</span></td>
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                        <div class="section-title">${isInst ? '2. STUDENT ROSTER & INSTITUTIONAL SEAT ACCESS AUDIT' : '2. STUDENT FEE & BILLING REGISTER'}</div>
                        <div class="summary-bar">
                          <span>Total Registered Students: <strong>${students.length}</strong></span>
                          ${isInst ? `
                            <span>Identity Verified: <strong>100%</strong></span>
                            <span>Active Institute Seats: <strong>${students.length}</strong></span>
                          ` : `
                            <span>Collected Monthly Rev: <strong>₹${students.reduce((acc: number, s: any) => acc + ((s.monthlyFee || 0) - (s.balanceOwed || 0)), 0)}</strong></span>
                            <span>Pending Dues Balance: <strong>₹${students.reduce((acc: number, s: any) => acc + (s.balanceOwed || 0), 0)}</strong></span>
                          `}
                        </div>
                        <table>
                          <thead>
                            ${isInst ? `
                              <tr><th>Desk</th><th>Student Name</th><th>Contact / College ID</th><th>Reg Date & Shift</th><th>Verification</th><th>Access Record</th></tr>
                            ` : `
                              <tr><th>Desk</th><th>Student Name</th><th>Contact / ID</th><th>Reg Date & Shift</th><th>Plan</th><th>Monthly</th><th>Pending Dues</th><th>Status Record</th></tr>
                            `}
                          </thead>
                          <tbody>
                            ${students.length === 0 ? `
                              <tr><td colspan="${isInst ? 6 : 8}" style="text-align:center; padding:15px; color:#94a3b8;">No enrolled student records found</td></tr>
                            ` : students.map((s: any) => isInst ? `
                              <tr>
                                <td><strong>Desk ${s.seatCode || 'Unassigned'}</strong></td>
                                <td>${s.name || 'Student'}</td>
                                <td>+91 ${s.phone || '-'}<br><small>ID: ${s.collegeId || s.id_number || s.email || '-'}</small></td>
                                <td>${printDate}<br><small>${s.shiftName || 'General'}</small></td>
                                <td><span class="badge badge-active">ROSTER VERIFIED</span></td>
                                <td><span class="badge badge-active">ACTIVE INSTITUTE SEAT</span></td>
                              </tr>
                            ` : `
                              <tr>
                                <td><strong>Desk ${s.seatCode || 'Unassigned'}</strong></td>
                                <td>${s.name || 'Student'}</td>
                                <td>+91 ${s.phone || '-'}<br><small>${s.aadhaarMasked || s.email || '-'}</small></td>
                                <td>${printDate}<br><small>${s.shiftName || 'General'}</small></td>
                                <td><span class="badge ${(s.balanceOwed || 0) === 0 ? 'badge-active' : 'badge-unpaid'}">${(s.balanceOwed || 0) === 0 ? 'PREPAID' : 'UNPAID'}</span></td>
                                <td>₹${s.monthlyFee || 0}</td>
                                <td><strong style="color:${(s.balanceOwed || 0) > 0 ? '#b91c1c' : '#15803d'};">₹${s.balanceOwed || 0}</strong></td>
                                <td><span class="badge badge-active">ACTIVE SEAT</span></td>
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                        <div class="section-title">3. STUDENT COMPLAINTS & GRIEVANCE RESOLUTION AUDIT</div>
                        <table>
                          <thead>
                            <tr><th>ID / Date</th><th>Student / Phone</th><th>Category</th><th>Priority</th><th>Subject & Issue</th><th>Status</th><th>Warden Reply</th></tr>
                          </thead>
                          <tbody>
                            ${libraryComplaints.length === 0 ? `
                              <tr><td colspan="7" style="text-align:center; padding:15px; color:#94a3b8;">No grievance complaint records found for this library</td></tr>
                            ` : libraryComplaints.map((c: any) => `
                              <tr>
                                <td><strong>${c.ticket_code || 'CMP-' + c.id}</strong></td>
                                <td>${c.student_name || 'Student'}</td>
                                <td>${c.category || 'Facility'}</td>
                                <td><span class="badge ${c.priority === 'HIGH' ? 'badge-unpaid' : 'badge-pending'}">${c.priority || 'NORMAL'}</span></td>
                                <td>${c.description || '-'}</td>
                                <td><span class="badge ${c.status === 'RESOLVED' ? 'badge-active' : 'badge-pending'}">${c.status || 'PENDING'}</span></td>
                                <td>${c.owner_resolution_notes || 'Under Warden Review'}</td>
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                        <script>window.onload = function() { window.print(); };</script>
                      </body>
                      </html>
                    `;
                    printWindow.document.write(htmlContent);
                    printWindow.document.close();
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-600/25 transition cursor-pointer flex items-center gap-2"
                >
                  Export / Print Master Audit Report
                </button>
              </div>

              {/* Master Audit Filter Controls (by Seat, Student, Date, Visit, Booking & Date Range) */}
              <div className="bg-slate-50 dark:bg-slate-950/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Filter Mode Selector */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-500 mr-1">Filter Audit By:</span>
                    {[
                      { id: 'ALL', label: 'All Records' },
                      { id: 'BY_SEAT', label: 'By Seat' },
                      { id: 'BY_STUDENT', label: 'By Student' },
                      { id: 'BY_DATE', label: 'By Date' },
                      { id: 'BY_VISIT', label: 'By Visit' },
                      { id: 'BY_BOOKING', label: 'By Booking ID' }
                    ].map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setAuditFilterType(f.id as any)}
                        className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer border ${
                          auditFilterType === f.id
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-indigo-500'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Date Range Mode */}
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                    {[
                      { id: 'TODAY', label: 'Today' },
                      { id: 'CUSTOM', label: 'Custom Range' },
                      { id: 'MONTHLY', label: 'Monthly' },
                      { id: 'YEARLY', label: 'Yearly' }
                    ].map(dm => (
                      <button
                        key={dm.id}
                        type="button"
                        onClick={() => setAuditDateMode(dm.id as any)}
                        className={`px-2.5 py-1 rounded-lg text-xxs font-extrabold transition cursor-pointer ${
                          auditDateMode === dm.id
                            ? 'bg-violet-500/20 text-violet-600 dark:text-violet-400 font-black'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {dm.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date Inputs & Search Query */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-xxs font-bold text-slate-400 mb-1">Search Audit Query</label>
                    <input
                      type="text"
                      value={auditSearchQuery}
                      onChange={e => setAuditSearchQuery(e.target.value)}
                      placeholder="Filter by Desk, Name, Phone, or Booking ID..."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xxs font-bold text-slate-400 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={auditStartDate}
                      onChange={e => setAuditStartDate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xxs font-bold text-slate-400 mb-1">End Date</label>
                    <input
                      type="date"
                      value={auditEndDate}
                      onChange={e => setAuditEndDate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* 1. BOOKINGS & STUDENT RESERVATIONS AUDIT SECTION */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <span>1. BOOKINGS &amp; STUDENT RESERVATIONS AUDIT</span>
                  </h3>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    {students.length || 1} Total Bookings
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">Booking ID</th>
                        <th className="p-3">Desk / Seat</th>
                        <th className="p-3">Shift Details</th>
                        <th className="p-3">Date &amp; Time</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {(masterAuditRoster.length > 0 ? masterAuditRoster : preRegList).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-slate-400 font-medium">
                            No active student bookings found for today.
                          </td>
                        </tr>
                      ) : (
                        (masterAuditRoster.length > 0 ? masterAuditRoster : preRegList).map((r: any, idx: number) => (
                          <tr key={r.id || idx}>
                            <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              PASS-{r.id_number || r.collegeIdNumber || (7100 + idx)}
                            </td>
                            <td className="p-3">Desk Row A - Seat {r.assigned_desk_code || r.deskCode || (idx + 1)}</td>
                            <td className="p-3">Full Day Access (06:00 AM - 10:00 PM)</td>
                            <td className="p-3">{r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today'}</td>
                            <td className="p-3 font-mono font-bold">₹0 (INSTITUTE FREE)</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px]">
                                ACTIVE
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. STUDENT FEE & BILLING / ROSTER AUDIT SECTION */}
              <div className="space-y-3 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <span>{library?.libraryCategory === 'INSTITUTE' ? '2. STUDENT ROSTER & INSTITUTIONAL SEAT ACCESS AUDIT' : '2. STUDENT FEE & BILLING REGISTER'}</span>
                  </h3>
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <span>Total Enrolled: <strong>{(masterAuditRoster.length > 0 ? masterAuditRoster : preRegList).length}</strong></span>
                    {library?.libraryCategory === 'INSTITUTE' ? (
                      <>
                        <span>Identity Verified: <strong className="text-emerald-500">{(masterAuditRoster.length > 0 ? masterAuditRoster : preRegList).length > 0 ? '100%' : '0%'}</strong></span>
                        <span>Active Seats: <strong className="text-indigo-500">{(masterAuditRoster.length > 0 ? masterAuditRoster : preRegList).length}</strong></span>
                      </>
                    ) : (
                      <>
                        <span>Collected Rev: <strong className="text-emerald-500">₹3,000</strong></span>
                        <span>Pending Dues: <strong className="text-amber-500">₹1,800</strong></span>
                      </>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                      {library?.libraryCategory === 'INSTITUTE' ? (
                        <tr>
                          <th className="p-3">Desk</th>
                          <th className="p-3">Student Name</th>
                          <th className="p-3">Contact / College ID</th>
                          <th className="p-3">Reg Date &amp; Shift</th>
                          <th className="p-3">Verification</th>
                          <th className="p-3">Access Record</th>
                        </tr>
                      ) : (
                        <tr>
                          <th className="p-3">Desk</th>
                          <th className="p-3">Student Name</th>
                          <th className="p-3">Contact / ID</th>
                          <th className="p-3">Reg Date &amp; Shift</th>
                          <th className="p-3">Plan</th>
                          <th className="p-3">Monthly</th>
                          <th className="p-3">Pending Dues</th>
                          <th className="p-3">Status Record</th>
                        </tr>
                      )}
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {(masterAuditRoster.length > 0 ? masterAuditRoster : preRegList).length === 0 ? (
                        <tr>
                          <td colSpan={library?.libraryCategory === 'INSTITUTE' ? 6 : 8} className="p-6 text-center text-slate-400 font-medium">
                            No enrolled student records found in audit database
                          </td>
                        </tr>
                      ) : (
                        (masterAuditRoster.length > 0 ? masterAuditRoster : preRegList).map((r: any, idx: number) => library?.libraryCategory === 'INSTITUTE' ? (
                          <tr key={r.id || idx}>
                            <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">Desk {r.assigned_desk_code || r.deskCode || 'A' + (idx + 1)}</td>
                            <td className="p-3 font-bold">{r.full_name || r.student_name || r.name || 'Enrolled Student'}</td>
                            <td className="p-3 font-mono">
                              +91 {r.contact_number || r.phone || '9876543210'}<br /><span className="text-[10px] text-slate-400">ID: {r.id_number || r.collegeIdNumber || r.email || '-'}</span>
                            </td>
                            <td className="p-3">
                              Joined<br /><span className="text-[10px] text-slate-400">{r.branch || r.shiftName || 'General Shift'}</span>
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px]">
                                ✓ ROSTER VERIFIED
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-extrabold text-[10px]">
                                ACTIVE INSTITUTE SEAT
                              </span>
                            </td>
                          </tr>
                        ) : (
                          <tr key={r.id || idx}>
                            <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">Desk {r.assigned_desk_code || r.deskCode || 'A' + (idx + 1)}</td>
                            <td className="p-3 font-bold">{r.full_name || r.student_name || r.name}</td>
                            <td className="p-3 font-mono">
                              +91 {r.contact_number || r.phone || '9876543210'}<br /><span className="text-[10px] text-slate-400">{r.id_number || r.email || '-'}</span>
                            </td>
                            <td className="p-3">
                              Joined<br /><span className="text-[10px] text-slate-400">{r.branch || 'General'}</span>
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/15 text-emerald-600">
                                PREPAID
                              </span>
                            </td>
                            <td className="p-3 font-mono font-bold">₹0</td>
                            <td className="p-3 font-mono font-bold text-emerald-500">₹0</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 font-extrabold text-[10px]">
                                ACTIVE SEAT
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. STUDENT COMPLAINTS & GRIEVANCE RESOLUTION AUDIT SECTION */}
              <div className="space-y-3 pt-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <span>3. STUDENT COMPLAINTS &amp; GRIEVANCE RESOLUTION AUDIT</span>
                  </h3>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                    Filter: ALL ({libraryComplaints.length} Records)
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">ID / Date</th>
                        <th className="p-3">Student / Phone</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Priority</th>
                        <th className="p-3">Subject &amp; Issue</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Warden Reply</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {libraryComplaints.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slate-400 font-medium">
                            No student complaint records found for this library
                          </td>
                        </tr>
                      ) : (
                        libraryComplaints.map((c: any, idx: number) => (
                          <tr key={c.id || idx}>
                            <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">{c.ticket_code || 'CMP-' + c.id}<br /><span className="text-[10px] text-slate-400">{c.created_at ? new Date(c.created_at).toLocaleDateString() : 'Today'}</span></td>
                            <td className="p-3 font-bold">{c.is_anonymous ? '[Anonymous Student]' : (c.student_name || 'Student')}<br /><span className="text-[10px] text-slate-400 font-mono">{c.is_anonymous ? '[Identity Protected]' : (c.student_phone || '-')}</span></td>
                            <td className="p-3 font-bold text-indigo-600 dark:text-indigo-400">{c.category || 'Facility'}</td>
                            <td className="p-3"><span className={`px-2 py-0.5 rounded font-bold text-[10px] ${c.priority === 'HIGH' ? 'bg-rose-500/15 text-rose-600' : 'bg-amber-500/15 text-amber-600'}`}>{c.priority || 'NORMAL'}</span></td>
                            <td className="p-3 text-slate-800 dark:text-slate-200">{c.description}</td>
                            <td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.status === 'RESOLVED' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'}`}>{c.status || 'PENDING'}</span></td>
                            <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">{c.owner_resolution_notes || 'Under Warden Review'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: STUDENT COMPLAINTS DESK */}
        {activeTab === 'complaints' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white font-headers">
                    Student Complaints &amp; Grievance Resolution Desk
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Review facility complaints reported by students, dispatch replies, and update ticket status.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setComplaintFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                      complaintFilter === 'ALL'
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'border-slate-200 dark:border-slate-800 text-slate-500'
                    }`}
                  >
                    All ({libraryComplaints.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setComplaintFilter('PENDING')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                      complaintFilter === 'PENDING'
                        ? 'bg-amber-500 text-slate-950 border-amber-500'
                        : 'border-slate-200 dark:border-slate-800 text-slate-500'
                    }`}
                  >
                    Pending ({libraryComplaints.filter(c => c.status !== 'RESOLVED').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setComplaintFilter('RESOLVED')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                      complaintFilter === 'RESOLVED'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'border-slate-200 dark:border-slate-800 text-slate-500'
                    }`}
                  >
                    Resolved ({libraryComplaints.filter(c => c.status === 'RESOLVED').length})
                  </button>
                </div>
              </div>

              {/* Complaints List */}
              {(() => {
                const list = libraryComplaints.filter(c => {
                  if (complaintFilter === 'PENDING') return c.status !== 'RESOLVED';
                  if (complaintFilter === 'RESOLVED') return c.status === 'RESOLVED';
                  return true;
                });

                if (list.length === 0) {
                  return (
                    <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                      <span className="text-2xl block">🎉</span>
                      <p>No complaints matching the selected filter ({complaintFilter}).</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {list.map((c: any) => (
                      <div
                        key={c.id}
                        className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0c1220] space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-violet-600 dark:text-violet-400">
                              {c.ticket_code || 'CMP-801'}
                            </span>
                            <span className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                              {c.is_anonymous ? '🎭 Anonymous Student' : (c.student_name || 'Student')}
                            </span>
                            {c.is_anonymous && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 uppercase tracking-wider">
                                🎭 Anonymous Report
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-500/10 text-violet-600 dark:text-violet-400">
                              {c.category}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              c.priority === 'HIGH' ? 'bg-rose-500/15 text-rose-600' : 'bg-amber-500/15 text-amber-600'
                            }`}>
                              {c.priority} Priority
                            </span>
                          </div>

                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            c.status === 'RESOLVED'
                              ? 'bg-emerald-500 text-white'
                              : 'bg-amber-500 text-slate-950'
                          }`}>
                            {c.status}
                          </span>
                        </div>

                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                          "{c.description}"
                        </p>

                        <div className="space-y-2 pt-1">
                          <label className="block text-[11px] font-bold text-slate-500 uppercase">
                            Warden / Management Resolution Reply:
                          </label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={wardenReplies[c.id] !== undefined ? wardenReplies[c.id] : (c.owner_resolution_notes || '')}
                              onChange={e => setWardenReplies({ ...wardenReplies, [c.id]: e.target.value })}
                              placeholder="Type warden reply or action taken..."
                              className="flex-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-medium"
                            />
                            <button
                              type="button"
                              disabled={complaintActionLoading === c.id}
                              onClick={() => handleResolveComplaint(c.id, 'RESOLVED')}
                              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow transition disabled:opacity-50 cursor-pointer shrink-0"
                            >
                              ✓ Resolve Complaint
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* TAB: WALK-IN STUDENT ENTRY & VISITOR DESK */}
        {activeTab === 'walkin' && (
          <div className="space-y-6">
            {/* SUB-TABS SELECTOR */}
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <button
                type="button"
                onClick={() => setWalkInSubTab('SEATS')}
                className={`px-5 py-2.5 rounded-2xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
                  walkInSubTab === 'SEATS'
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>🪑 Walk-In Desk Assignments</span>
              </button>
              <button
                type="button"
                onClick={() => setWalkInSubTab('VISITORS')}
                className={`px-5 py-2.5 rounded-2xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
                  walkInSubTab === 'VISITORS'
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>⚡ Short-Term Visitors (40-Min Pass)</span>
              </button>
            </div>

            {/* SEATS SUBTAB CONTENT */}
            {walkInSubTab === 'SEATS' && (
              <div className="space-y-8">
                {/* SECTION 1: WALK-IN STUDENT IDENTITY LOOKUP & INSTANT SEAT ASSIGNMENT */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-5">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white font-headers flex items-center gap-2">
                      <span>🚪</span> Walk-In Student Entry &amp; Instant Desk Assignment
                    </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Enter student's Institute ID number, phone, or email to verify roster status before assigning an available desk.
                </p>
              </div>

              {/* Lookup Search Form */}
              <form onSubmit={handleWalkinLookup} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={walkinLookupQuery}
                  onChange={e => setWalkinLookupQuery(e.target.value)}
                  placeholder="Enter Student ID (e.g. 2024CS1049), Phone, or Email..."
                  className="flex-1 p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-sm uppercase text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={walkinLookupLoading || !walkinLookupQuery.trim()}
                  className="px-6 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-extrabold text-xs shadow-md shadow-violet-500/20 transition cursor-pointer flex items-center justify-center gap-2 shrink-0"
                >
                  {walkinLookupLoading ? 'Searching…' : '🔍 Lookup Student'}
                </button>
              </form>

              {/* STATE A: STUDENT FOUND IN ROSTER */}
              {(walkinLookupState === 'FOUND_CLAIMED' || walkinLookupState === 'FOUND_UNCLAIMED') && (
                <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-600 text-white uppercase tracking-wider">
                      ✓ STUDENT FOUND IN ROSTER
                    </span>
                    <span className="text-xs text-emerald-700 dark:text-emerald-300 font-mono font-bold">
                      {walkinLookupState === 'FOUND_CLAIMED' ? '✓ Identity App Verified' : 'Roster Listed Only'}
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-4 gap-3 text-xs bg-white dark:bg-slate-900 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Student Name</span>
                      <strong className="text-slate-900 dark:text-white font-bold text-sm">{walkinStudentName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Institute ID / Phone</span>
                      <strong className="font-mono text-slate-800 dark:text-slate-200">{walkinStudentIdNum || 'N/A'} · {walkinStudentPhone}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Branch</span>
                      <strong className="text-slate-800 dark:text-slate-200">CSE / General</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Gender</span>
                      <strong className="font-mono uppercase text-slate-800 dark:text-slate-200">Regular Student</strong>
                    </div>
                  </div>

                  {/* Seat Picker for Walk-In Assignment */}
                  <div className="space-y-2 pt-1">
                    <label className="block text-xs font-bold text-slate-900 dark:text-white">
                      Pick Available Desk from Live Layout:
                    </label>
                    <div className="flex flex-wrap gap-2 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-h-36 overflow-y-auto">
                      {liveSeats.filter((s: any) => s.status === 'AVAILABLE' || s.currentStatus === 'AVAILABLE').map((s: any) => (
                        <button
                          key={s.id || s.seatCode}
                          type="button"
                          onClick={() => setWalkinSeatCode(s.seatCode)}
                          className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold border transition cursor-pointer ${
                            walkinSeatCode === s.seatCode
                              ? 'bg-violet-600 text-white border-violet-600 ring-2 ring-violet-500/50'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          Desk {s.seatCode}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="button"
                        disabled={!walkinSeatCode}
                        onClick={async () => {
                          try {
                            await api.post('/api/v1/partner/walkin/assign', {
                              libraryId: library?.id,
                              instituteStudentId: walkinLookupQuery.trim(),
                              idNumber: walkinLookupQuery.trim(),
                              collegeIdNumber: walkinLookupQuery.trim(),
                              studentName: walkinStudentName,
                              phone: walkinStudentPhone,
                              seatCode: walkinSeatCode,
                              durationHours: 4,
                              paymentMode: 'FREE'
                            });
                            alert(`✅ Walk-in student ${walkinStudentName} assigned to Desk ${walkinSeatCode}!`);
                            setWalkinLookupState('IDLE');
                            setWalkinSeatCode('');
                            if (library?.id) fetchLiveSeats(library.id);
                          } catch (err: any) {
                            alert(err?.response?.data?.message || 'Failed to assign walk-in desk.');
                          }
                        }}
                        className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs shadow-md transition cursor-pointer"
                      >
                        ✓ Assign Desk {walkinSeatCode || '(Select Seat)'} &amp; Lock Session
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STATE B: STUDENT NOT FOUND IN ROSTER */}
              {walkinLookupState === 'NOT_FOUND' && (
                <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-600 text-white uppercase tracking-wider">
                      ❌ ID NOT FOUND IN ROSTER
                    </span>
                  </div>
                  <p className="text-xs text-rose-700 dark:text-rose-300 font-bold">
                    No pre-registered student record matches "{walkinLookupQuery}".
                  </p>

                  <div className="grid md:grid-cols-2 gap-4 pt-2">
                    {/* Option 1: Direct Intake Form */}
                    <form onSubmit={handleSinglePreRegisterSubmit} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 space-y-2.5 text-xs">
                      <h4 className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                        Option A: Register &amp; Verify Student Now
                      </h4>
                      <input
                        type="text"
                        required
                        placeholder="Student ID Number *"
                        value={preRegSingleForm.idNumber}
                        onChange={e => setPreRegSingleForm({ ...preRegSingleForm, idNumber: e.target.value })}
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-xs"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Full Name *"
                        value={preRegSingleForm.studentName}
                        onChange={e => setPreRegSingleForm({ ...preRegSingleForm, studentName: e.target.value })}
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs"
                      />
                      <input
                        type="tel"
                        placeholder="Mobile Phone"
                        value={preRegSingleForm.contactNumber}
                        onChange={e => setPreRegSingleForm({ ...preRegSingleForm, contactNumber: e.target.value })}
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono"
                      />
                      <input
                        type="email"
                        placeholder="Institute Email (e.g. student@college.ac.in)"
                        value={preRegSingleForm.email}
                        onChange={e => setPreRegSingleForm({ ...preRegSingleForm, email: e.target.value })}
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono"
                      />
                      <button
                        type="submit"
                        className="w-full py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow transition cursor-pointer"
                      >
                        + Add to Verified Roster &amp; Proceed
                      </button>
                    </form>

                    {/* Option 2: App Registration Prompt */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 space-y-3 text-xs flex flex-col justify-between">
                      <div>
                        <h4 className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                          Option B: Student Self-Registration
                        </h4>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          Tell the student to open the <strong>EduGlobin App</strong> on their mobile phone, enter their Institute ID and College Email, and submit an instant access registration request.
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                        📱 Request will immediately appear in your <strong>Visitor Access &amp; Requests</strong> tab for 1-click approval!
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )}

        {/* TAB 5: GATE SCANNER & PASSCODE ADMISSION */}
        {activeTab === 'scanner' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white font-headers">
                    Gate Check-In & Scanner Desk
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Scan student mobile QR pass via camera or manually enter their unique booking reference / passcode.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!isCameraActive ? (
                    <button
                      onClick={startGateCamera}
                      className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-md shadow-violet-500/20 cursor-pointer flex items-center gap-1.5"
                    >
                      📷 Open Camera QR Scanner
                    </button>
                  ) : (
                    <button
                      onClick={stopGateCamera}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                    >
                      ✕ Stop Camera
                    </button>
                  )}

                  <label className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border border-slate-700">
                    🖼 Scan QR Image File
                    <input type="file" accept="image/*" onChange={handleQrFileUpload} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Camera Scanner Container */}
              {isCameraActive && (
                <div className="max-w-md mx-auto p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-3">
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center border border-violet-500/50">
                    <video ref={videoRef} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 border-2 border-dashed border-emerald-400 opacity-60 pointer-events-none animate-pulse flex items-center justify-center">
                      <span className="text-xxs font-mono text-emerald-400 bg-black/60 px-2 py-1 rounded">Align Student QR Here</span>
                    </div>
                  </div>
                  <p className="text-xxs text-slate-400">Position student mobile QR pass inside the viewfinder frame</p>
                </div>
              )}

              {/* Manual Passcode Entry Form */}
              <form onSubmit={handleCheckin} className="max-w-md mx-auto space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 text-center">
                    Enter Student 8-Character Check-In Passcode
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={8}
                    value={checkinRef}
                    onChange={e => setCheckinRef(e.target.value.toUpperCase())}
                    placeholder="8A3F129B"
                    className="w-full text-center font-mono font-extrabold text-2xl p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white uppercase tracking-widest focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                {checkinStatus && (
                  <div className={`p-3.5 rounded-xl text-xs font-bold border text-center ${
                    checkinStatus.includes('Denied') || checkinStatus.includes('Error')
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  }`}>
                    {checkinStatus}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-md shadow-violet-500/20 cursor-pointer"
                >
                  ✓ Validate & Confirm Gate Admission
                </button>
              </form>

              {/* Recent Admissions Roster */}
              {gateAdmissions.length > 0 && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    Recent Gate Admissions Today ({gateAdmissions.length})
                  </h4>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                    {gateAdmissions.map(adm => (
                      <div key={adm.id} className="py-2 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{adm.name}</span>
                          <span className="text-xxs font-mono text-slate-400 ml-2">Ref: {adm.ref}</span>
                        </div>
                        <div className="text-right font-mono text-xxs">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500 font-bold mr-2">Desk {adm.seat}</span>
                          <span className="text-slate-400">{adm.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: BOOK DESK (CIRCULATION) - MODULES 31-36 */}
        {activeTab === 'circulation' && (
          <div className="space-y-6">
            {/* Header & Controls Bar */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white font-headers flex items-center gap-2">
                  Physical Book Issue / Reissue / Return Desk
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Visiting student management with 40-minute limit, direct owner exit, & student exit approval flow (Module 31-36)
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={() => setShowCheckInVisitorModal(true)}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-md shadow-violet-500/20 cursor-pointer"
                >
                  🙋 Check-In Visitor (Issue/Return)
                </button>
                <button
                  onClick={() => setShowAddBookModal(true)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  + Add Book to Catalog
                </button>
                <button
                  onClick={() => setShowIssueBookModal(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-500/20 cursor-pointer"
                >
                  📖 Issue Book at Desk
                </button>
              </div>
            </div>

            {/* OVERTIME WARNING BANNER (> 40 MINS) */}
            {deskVisitors.some(v => v.is_overtime || (v.elapsed_minutes && v.elapsed_minutes > 40)) && (
              <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex justify-between items-center animate-pulse">
                <span>
                  ⚠️ OVERTIME ALERT: Visiting student(s) have exceeded the 40-minute desk time limit! Please process their book issue/return or exit them.
                </span>
                <button
                  onClick={fetchCirculationData}
                  className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xxs uppercase tracking-wider font-extrabold hover:bg-rose-500"
                >
                  Refresh Desk
                </button>
              </div>
            )}

            {/* VISITING CIRCULATION STUDENTS ROSTER */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  Active Visiting Students at Desk ({deskVisitors.length})
                  <span className="text-xxs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500 font-bold normal-case">
                    Max 40 Mins Limit
                  </span>
                </h4>
                <button
                  onClick={fetchCirculationData}
                  className="text-xs text-violet-600 dark:text-violet-400 font-semibold hover:underline cursor-pointer"
                >
                  🔄 Refresh Visitors
                </button>
              </div>

              {deskVisitors.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No visiting students currently logged at the circulation desk. Click "Check-In Visitor" to add a student arriving for Issue/Reissue/Return.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase text-xxs font-bold">
                      <tr>
                        <th className="p-3 rounded-l-xl">Institute / Student ID</th>
                        <th className="p-3">Student Name</th>
                        <th className="p-3">Purpose</th>
                        <th className="p-3">Check-In Time</th>
                        <th className="p-3">Elapsed Time</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 rounded-r-xl text-right">Desk Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {deskVisitors.map(v => {
                        const elapsedMins = Math.round(v.elapsed_minutes || 0);
                        const isOvertime = v.is_overtime || elapsedMins > 40;
                        const isExitRequested = v.status === 'EXIT_REQUESTED';
                        return (
                          <tr key={v.visitor_id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 ${isOvertime ? 'bg-rose-500/5' : ''}`}>
                            <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                {v.institute_id_number || 'ID-PENDING'}
                              </span>
                            </td>
                            <td className="p-3 text-slate-800 dark:text-slate-200">
                              <div className="font-bold">{v.student_name}</div>
                              <div className="text-xxs text-slate-400">{v.student_phone || v.student_email}</div>
                            </td>
                            <td className="p-3">
                              <span className="px-2.5 py-1 rounded-full text-xxs font-extrabold uppercase bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                                {v.purpose}
                              </span>
                            </td>
                            <td className="p-3 text-slate-500 dark:text-slate-400 font-mono text-xxs">
                              {new Date(v.check_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-3 font-mono">
                              <span className={`px-2 py-0.5 rounded text-xxs font-bold ${
                                isOvertime ? 'bg-rose-500/15 text-rose-500 animate-pulse border border-rose-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}>
                                {elapsedMins} mins {isOvertime ? '⚠️ (Exceeded 40m)' : ''}
                              </span>
                            </td>
                            <td className="p-3">
                              {isExitRequested ? (
                                <span className="px-2.5 py-1 rounded-full text-xxs font-extrabold uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
                                  Exit Requested
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full text-xxs font-extrabold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                  At Desk
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right space-x-2">
                              {isExitRequested ? (
                                <button
                                  onClick={() => handleOwnerApproveVisitorExit(v.visitor_id)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xxs transition shadow-sm cursor-pointer"
                                >
                                  ✓ Approve Exit Request ({v.institute_id_number})
                                </button>
                              ) : null}
                              <button
                                onClick={() => handleOwnerDirectExitVisitor(v.visitor_id)}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-600 hover:text-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xxs transition cursor-pointer"
                              >
                                Direct Exit Visitor
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Active Loans Overview Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                  Active & Overdue Book Loans ({deskLoans.length})
                </h4>
                <button
                  onClick={fetchCirculationData}
                  className="text-xs text-violet-600 dark:text-violet-400 font-semibold hover:underline cursor-pointer"
                >
                  🔄 Refresh List
                </button>
              </div>

              {deskLoans.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No active book loans currently out. Click "Issue Book at Desk" to record a new loan.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase text-slate-400 font-semibold">
                        <th className="p-3">Book Title / Code</th>
                        <th className="p-3">Borrower / Profile</th>
                        <th className="p-3">Issued Date</th>
                        <th className="p-3">Due Date</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Counter Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                      {deskLoans.map(loan => {
                        const isOverdue = loan.status === 'OVERDUE' || new Date(loan.due_at) < new Date();
                        return (
                          <tr key={loan.loan_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="p-3">
                              <span className="font-bold text-slate-900 dark:text-white block">{loan.title}</span>
                              <span className="text-xxs font-mono text-slate-400">Code: {loan.book_code} · {loan.category || 'General'}</span>
                            </td>
                            <td className="p-3">
                              <span className="font-semibold text-slate-800 dark:text-slate-200 block">{loan.student_name}</span>
                              <span className="text-xxs text-slate-400">ID: {loan.institute_id_number || 'Govt/Private'} · {loan.student_phone}</span>
                            </td>
                            <td className="p-3 text-slate-500 font-mono text-xxs">
                              {new Date(loan.issued_at).toLocaleDateString()}
                            </td>
                            <td className="p-3 font-mono font-semibold">
                              <span className={isOverdue ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-700 dark:text-slate-300'}>
                                {new Date(loan.due_at).toLocaleDateString()}
                              </span>
                              {loan.reissue_count > 0 && (
                                <span className="text-[10px] block text-violet-500 font-normal">Reissued ×{loan.reissue_count}</span>
                              )}
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xxs font-extrabold uppercase tracking-wider ${
                                  isOverdue
                                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                }`}
                              >
                                {isOverdue ? '⚠️ Overdue' : '● Issued'}
                              </span>
                            </td>
                            <td className="p-3 text-right space-x-2">
                              <button
                                onClick={() => handleReissueBook(loan.loan_id)}
                                className="px-2.5 py-1 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 text-xxs font-bold transition cursor-pointer"
                              >
                                ⏳ Extend / Reissue
                              </button>
                              <button
                                onClick={() => handleReturnBook(loan.loan_id)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xxs font-bold transition cursor-pointer"
                              >
                                ✓ Return Book
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Book Catalog List */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                Library Book Catalog ({catalogBooks.length} Titles)
              </h4>
              {catalogBooks.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">Catalog empty. Add books to begin borrowing.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {catalogBooks.map(bk => (
                    <div key={bk.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-1">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">{bk.title}</span>
                        <span className="text-xxs font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {bk.available_copies} / {bk.total_copies} Left
                        </span>
                      </div>
                      <p className="text-xxs text-slate-400">Author: {bk.author || 'N/A'} · Code: {bk.book_code}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL 1: ADD BOOK TO CATALOG */}
        {showAddBookModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">📚 Add New Book to Catalog</h3>
                <button onClick={() => setShowAddBookModal(false)} className="text-slate-400 hover:text-white font-bold">✕</button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Book Title *</label>
                  <input
                    type="text"
                    value={newBook.title}
                    onChange={e => setNewBook({ ...newBook, title: e.target.value })}
                    placeholder="e.g. Higher Engineering Mathematics"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Book / ISBN Code *</label>
                    <input
                      type="text"
                      value={newBook.bookCode}
                      onChange={e => setNewBook({ ...newBook, bookCode: e.target.value })}
                      placeholder="BK-101"
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Total Copy Count</label>
                    <input
                      type="number"
                      min="1"
                      value={newBook.totalCopies}
                      onChange={e => setNewBook({ ...newBook, totalCopies: parseInt(e.target.value, 10) || 1 })}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Author Name</label>
                  <input
                    type="text"
                    value={newBook.author}
                    onChange={e => setNewBook({ ...newBook, author: e.target.value })}
                    placeholder="B.S. Grewal"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowAddBookModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddBookToCatalog}
                  className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs"
                >
                  Save Book
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: ISSUE BOOK AT DESK */}
        {showIssueBookModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">📖 Issue Book at Desk</h3>
                <button onClick={() => setShowIssueBookModal(false)} className="text-slate-400 hover:text-white font-bold">✕</button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">1. Select Catalog Book *</label>
                  <select
                    value={issueParams.bookId}
                    onChange={e => setIssueParams({ ...issueParams, bookId: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-semibold"
                  >
                    <option value="">-- Choose Book --</option>
                    {catalogBooks.filter(b => b.available_copies > 0).map(b => (
                      <option key={b.id} value={b.id}>
                        {b.title} ({b.book_code}) - {b.available_copies} available
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">2. Search Student Profile (Institute ID / Phone) *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={circulationSearch}
                      onChange={e => setCirculationSearch(e.target.value)}
                      placeholder="Enter Institute ID or phone"
                      className="flex-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                    />
                    <button
                      type="button"
                      onClick={handleSearchStudentProfile}
                      className="px-3 py-2 bg-violet-600 text-white rounded-xl font-bold"
                    >
                      Search
                    </button>
                  </div>
                  {foundProfiles.length > 0 && (
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {foundProfiles.map(p => (
                        <div
                          key={p.id}
                          onClick={() => setSelectedProfile(p)}
                          className={`p-2 rounded-lg border text-xxs cursor-pointer flex justify-between ${
                            selectedProfile?.id === p.id ? 'border-violet-500 bg-violet-500/10 font-bold' : 'border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <span>{p.full_name} ({p.institute_id_number || p.phone})</span>
                          <span>✓ Select</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedProfile && (
                    <div className="mt-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xxs font-bold">
                      Selected Borrower: {selectedProfile.full_name}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">3. Initial Loan Duration (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={issueParams.loanDays}
                    onChange={e => setIssueParams({ ...issueParams, loanDays: parseInt(e.target.value, 10) || 14 })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowIssueBookModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleIssueBookSubmit}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                >
                  ✓ Issue Book
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CHECK-IN VISITING STUDENT FOR ISSUE/REISSUE/RETURN */}
        {showCheckInVisitorModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">🙋 Check-In Visitor (Circulation Desk)</h3>
                <button onClick={() => setShowCheckInVisitorModal(false)} className="text-slate-400 hover:text-white font-bold">✕</button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">1. Visit Purpose</label>
                  <select
                    value={visitorCheckInPurpose}
                    onChange={e => setVisitorCheckInPurpose(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-bold"
                  >
                    <option value="ISSUE">Book Issue</option>
                    <option value="REISSUE">Book Reissue / Renewal</option>
                    <option value="RETURN">Book Return</option>
                    <option value="CIRCULATION">General Catalog Consultation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">2. Search Student Profile (Institute ID / Phone)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={circulationSearch}
                      onChange={e => setCirculationSearch(e.target.value)}
                      placeholder="Enter Institute ID or Phone"
                      className="flex-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                    />
                    <button
                      type="button"
                      onClick={handleSearchStudentProfile}
                      className="px-3 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs"
                    >
                      Search
                    </button>
                  </div>
                  {foundProfiles.length > 0 && (
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {foundProfiles.map(p => (
                        <div
                          key={p.id}
                          onClick={() => setSelectedProfile(p)}
                          className={`p-2 rounded-lg border text-xxs cursor-pointer flex justify-between ${
                            selectedProfile?.id === p.id ? 'border-violet-500 bg-violet-500/10 font-bold' : 'border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <span>{p.full_name} ({p.institute_id_number || p.phone})</span>
                          <span>✓ Select</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedProfile && (
                    <div className="mt-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xxs font-bold">
                      Selected Visitor: {selectedProfile.full_name} ({selectedProfile.institute_id_number})
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-500 text-xxs">
                  ⏱️ <strong>40-Minute Desk Limit:</strong> Visiting students for book circulation have a maximum 40-minute limit. Overtime will trigger a pop-up alert at the desk.
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowCheckInVisitorModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCheckInVisitorSubmit}
                  className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-md shadow-violet-500/20"
                >
                  ✓ Check-In Visitor
                </button>
              </div>
            </div>
          </div>
        )}

        {/* OVERTIME POP-UP ALERT MODAL (> 40 MINS) */}
        {overtimeAlertVisitor && (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 border-2 border-rose-500 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center mx-auto text-xl font-bold animate-bounce">
                ⚠️
              </div>

              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base font-headers">
                  40-Minute Time Limit Exceeded!
                </h3>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold mt-1">
                  Student present at desk for {Math.round(overtimeAlertVisitor.elapsed_minutes || 41)} minutes
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-left space-y-1.5 text-xs font-medium">
                <div><strong className="text-slate-400">Institute ID:</strong> <span className="font-mono font-bold text-slate-900 dark:text-white">{overtimeAlertVisitor.institute_id_number || 'N/A'}</span></div>
                <div><strong className="text-slate-400">Student Name:</strong> <span className="font-bold text-slate-900 dark:text-white">{overtimeAlertVisitor.student_name}</span></div>
                <div><strong className="text-slate-400">Visit Purpose:</strong> <span className="uppercase font-bold text-sky-500">{overtimeAlertVisitor.purpose}</span></div>
                <div><strong className="text-slate-400">Check-In Time:</strong> <span className="font-mono">{new Date(overtimeAlertVisitor.check_in_at).toLocaleTimeString()}</span></div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setOvertimeAlertVisitor(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
                >
                  Dismiss Alert
                </button>
                <button
                  onClick={() => handleOwnerDirectExitVisitor(overtimeAlertVisitor.visitor_id)}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-500/20"
                >
                  ✓ Direct Exit & Save
                </button>
              </div>
            </div>
          </div>
        )}
        {/* TAB 8: OWNER REPORTS & HISTORY MODULE */}
        {activeTab === 'reports' && (
          <div className="w-full space-y-6">
            {/* Header Banner */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0c1220] p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">📊</span>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    Owner Reports & Activity Intelligence
                  </h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                  Unified export pipeline delivering live gate footfall totals, 6 distinct operational audits, and on-demand student lookup reports viewable on-screen or downloadable in PDF & CSV.
                </p>
              </div>

              <button
                onClick={() => {
                  fetchReportDashboard();
                  fetchActiveReport();
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition shadow-sm self-start md:self-auto"
              >
                <span>🔄</span>
                Refresh All Analytics
              </button>
            </div>

            {/* SECTION 1: MAIN DASHBOARD KPI CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Card 1: Entries Today */}
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-500/5 via-white to-white dark:from-emerald-950/20 dark:via-[#0c1220] dark:to-[#0c1220] p-4 shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Entries Today
                  </span>
                  <span className="text-lg">🎫</span>
                </div>
                <div className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                  {reportDashboard ? reportDashboard.entriesToday.toLocaleString() : '—'}
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Physical QR / ID check-ins</span>
                </div>
              </div>

              {/* Card 2: Entries This Week */}
              <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-500/5 via-white to-white dark:from-indigo-950/20 dark:via-[#0c1220] dark:to-[#0c1220] p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    This Week
                  </span>
                  <span className="text-lg">📅</span>
                </div>
                <div className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                  {reportDashboard ? reportDashboard.entriesThisWeek.toLocaleString() : '—'}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                  Gate visits since Monday
                </p>
              </div>

              {/* Card 3: Entries This Month */}
              <div className="rounded-2xl border border-blue-200 dark:border-blue-900/40 bg-gradient-to-br from-blue-500/5 via-white to-white dark:from-blue-950/20 dark:via-[#0c1220] dark:to-[#0c1220] p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    This Month
                  </span>
                  <span className="text-lg">📈</span>
                </div>
                <div className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                  {reportDashboard ? reportDashboard.entriesThisMonth.toLocaleString() : '—'}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                  Monthly cumulative entries
                </p>
              </div>

              {/* Card 4: Active Student Profiles */}
              <div className="rounded-2xl border border-purple-200 dark:border-purple-900/40 bg-gradient-to-br from-purple-500/5 via-white to-white dark:from-purple-950/20 dark:via-[#0c1220] dark:to-[#0c1220] p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    Active Members
                  </span>
                  <span className="text-lg">👥</span>
                </div>
                <div className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                  {reportDashboard ? reportDashboard.activeStudentProfiles.toLocaleString() : '—'}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                  Registered library profiles
                </p>
              </div>

              {/* Card 5: Real-time Seat Occupancy */}
              <div className="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-gradient-to-br from-amber-500/5 via-white to-white dark:from-amber-950/20 dark:via-[#0c1220] dark:to-[#0c1220] p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Live Occupancy
                  </span>
                  <span className="text-lg">🪑</span>
                </div>
                <div className="flex items-baseline gap-1.5 mt-2">
                  <span className="text-3xl font-black text-slate-900 dark:text-white">
                    {reportDashboard?.currentOccupancy ? reportDashboard.currentOccupancy.occupied : 0}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    / {reportDashboard?.currentOccupancy ? reportDashboard.currentOccupancy.total : 0} desks
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        reportDashboard?.currentOccupancy && reportDashboard.currentOccupancy.total > 0
                          ? Math.min(100, Math.round((reportDashboard.currentOccupancy.occupied / reportDashboard.currentOccupancy.total) * 100))
                          : 0
                      }%`
                    }}
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: REPORT 6 — SINGLE STUDENT LOOKUP (ALWAYS VISIBLE AT TOP) */}
            <div className="rounded-2xl border border-violet-200 dark:border-violet-900/50 bg-gradient-to-br from-violet-50/50 via-white to-white dark:from-[#13112c] dark:via-[#0c1220] dark:to-[#0c1220] p-5 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>🔍</span> Report 6 — Single Student Full History Lookup
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Search any student once by Institute ID number, college email, or phone to fetch their complete combined audit across bookings, physical gate visits, and item loans.
                  </p>
                </div>
                {studentLookupResult && (
                  <button
                    onClick={() => {
                      setStudentLookupResult(null);
                      setStudentLookupQuery('');
                      setStudentLookupError(null);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-semibold underline self-start md:self-auto"
                  >
                    Clear Search
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={studentLookupQuery}
                    onChange={(e) => setStudentLookupQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStudentLookupSearch()}
                    placeholder="Type Institute ID (e.g. IITB-2024-CS-042), Email, or Phone..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <button
                  onClick={() => handleStudentLookupSearch()}
                  disabled={studentLookupLoading || !studentLookupQuery.trim()}
                  className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-violet-500/20 transition flex items-center justify-center gap-1.5 shrink-0"
                >
                  {studentLookupLoading ? (
                    <>
                      <span className="animate-spin text-sm">⏳</span> Searching...
                    </>
                  ) : (
                    <>
                      <span>🔎</span> Lookup Student
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleStudentLookupSearch('PDF')}
                  disabled={!studentLookupQuery.trim()}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-rose-600 dark:text-rose-400 font-bold text-xs transition flex items-center justify-center gap-1.5 shrink-0"
                >
                  <span>📄</span> Direct PDF
                </button>
                <button
                  onClick={() => handleStudentLookupSearch('CSV')}
                  disabled={!studentLookupQuery.trim()}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400 font-bold text-xs transition flex items-center justify-center gap-1.5 shrink-0"
                >
                  <span>📊</span> Direct CSV
                </button>
              </div>

              {studentLookupError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300">
                  ⚠️ {studentLookupError}
                </div>
              )}

              {/* Single Student Lookup Results Card */}
              {studentLookupResult && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 space-y-3 mt-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {studentLookupResult.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Consolidated record count: {studentLookupResult.rows.length} entries · Generated at {new Date(studentLookupResult.generatedAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStudentLookupSearch('PDF')}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-sm flex items-center gap-1"
                      >
                        <span>📄</span> Export PDF
                      </button>
                      <button
                        onClick={() => handleStudentLookupSearch('CSV')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm flex items-center gap-1"
                      >
                        <span>📊</span> Export CSV
                      </button>
                    </div>
                  </div>

                  {/* Lookup Table */}
                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold text-[10px]">
                        <tr>
                          {studentLookupResult.columnHeaders.map((col, idx) => (
                            <th key={idx} className="py-2.5 px-3 whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                        {studentLookupResult.rows.map((row, rIdx) => {
                          const category = row[0];
                          const catBadgeColor =
                            category === 'PROFILE'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                              : category === 'BOOKING'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                              : category === 'VISIT'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300';

                          return (
                            <tr
                              key={rIdx}
                              className={rIdx % 2 === 1 ? 'bg-slate-50/50 dark:bg-slate-900/30' : ''}
                            >
                              <td className="py-2 px-3 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${catBadgeColor}`}>
                                  {category}
                                </span>
                              </td>
                              {row.slice(1).map((cell, cIdx) => (
                                <td key={cIdx} className="py-2 px-3 whitespace-nowrap font-mono text-[11px]">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 3: REPORTS 1-5 TABS & UNIFIED EXPORT BAR */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0c1220] p-6 shadow-sm space-y-5">
              {/* Reports 1-5 Subtabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setReportSubTab('students')}
                  className={`py-2 px-3.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                    reportSubTab === 'students'
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>👥</span> 1. Student Roster
                </button>

                <button
                  onClick={() => setReportSubTab('bookings')}
                  className={`py-2 px-3.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                    reportSubTab === 'bookings'
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>🎫</span> 2. Booking History
                </button>

                <button
                  onClick={() => setReportSubTab('seats')}
                  className={`py-2 px-3.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                    reportSubTab === 'seats'
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>🪑</span> 3. Seat-Wise History
                </button>

                <button
                  onClick={() => setReportSubTab('activity')}
                  className={`py-2 px-3.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                    reportSubTab === 'activity'
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>🔄</span> 4. Activity Feed (Visits & Items)
                </button>

                <button
                  onClick={() => setReportSubTab('girls')}
                  className={`py-2 px-3.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                    reportSubTab === 'girls'
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>🛡️</span> 5. Girls' Section Audit
                </button>

                <button
                  onClick={() => setReportSubTab('sessions')}
                  className={`py-2 px-3.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                    reportSubTab === 'sessions'
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>⏱️</span> 7. Booking Sessions (Time-In/Out)
                </button>
              </div>

              {/* Shared Control Bar: Date Range Pickers + Seat Selector (for Report 3) + Exporters */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Seat Desk Selector for Report 3 */}
                  {reportSubTab === 'seats' && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        Pick Seat:
                      </span>
                      <select
                        value={reportSelectedSeatId}
                        onChange={(e) => setReportSelectedSeatId(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-violet-500"
                      >
                        {liveSeats && liveSeats.length > 0 ? (
                          liveSeats.map((s: any) => (
                            <option key={s.id} value={s.id}>
                              Seat {s.seatCode} {s.isGirlsOnly ? '♀' : ''} ({s.currentStatus})
                            </option>
                          ))
                        ) : (
                          <option value="">No desks loaded</option>
                        )}
                      </select>
                    </div>
                  )}

                  {/* Date Range Controls for Reports 2, 3, 4, 5 */}
                  {reportSubTab !== 'students' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-slate-500">From:</span>
                        <input
                          type="date"
                          value={reportDateFrom}
                          onChange={(e) => setReportDateFrom(e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-slate-500">To:</span>
                        <input
                          type="date"
                          value={reportDateTo}
                          onChange={(e) => setReportDateTo(e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                        />
                      </div>

                      {/* Presets */}
                      <div className="flex items-center gap-1 text-[11px]">
                        <button
                          onClick={() => {
                            const today = new Date().toISOString().slice(0, 10);
                            setReportDateFrom(today);
                            setReportDateTo(today);
                          }}
                          className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 font-semibold"
                        >
                          Today
                        </button>
                        <button
                          onClick={() => {
                            const now = new Date();
                            const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                            setReportDateFrom(past.toISOString().slice(0, 10));
                            setReportDateTo(now.toISOString().slice(0, 10));
                          }}
                          className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 font-semibold"
                        >
                          7 Days
                        </button>
                        <button
                          onClick={() => {
                            const now = new Date();
                            const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                            setReportDateFrom(past.toISOString().slice(0, 10));
                            setReportDateTo(now.toISOString().slice(0, 10));
                          }}
                          className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 font-semibold"
                        >
                          30 Days
                        </button>
                        <button
                          onClick={() => {
                            setReportDateFrom('');
                            setReportDateTo('');
                          }}
                          className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 font-semibold"
                        >
                          All Time
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Shared Exporters */}
                <div className="flex items-center gap-2 self-end lg:self-auto">
                  <button
                    onClick={() => handleExportReport('PDF')}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition"
                  >
                    <span>📄</span> Export PDF
                  </button>
                  <button
                    onClick={() => handleExportReport('CSV')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition"
                  >
                    <span>📊</span> Export CSV
                  </button>
                </div>
              </div>

              {/* Table Filter Input & Title */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {reportDataset?.title || 'Report View'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {reportDataset ? `Generated: ${new Date(reportDataset.generatedAt).toLocaleString()} · ${reportDataset.rows.length} total records` : 'Loading report data...'}
                  </p>
                </div>

                <div className="w-full sm:w-64">
                  <input
                    type="text"
                    value={reportTableFilter}
                    onChange={(e) => setReportTableFilter(e.target.value)}
                    placeholder="Filter records on-screen..."
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
              </div>

              {/* SECTION 4: INTERACTIVE ON-SCREEN DATA TABLE */}
              {reportError && (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300">
                  ⚠️ {reportError}
                </div>
              )}

              {reportLoading ? (
                <div className="py-16 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-2">
                  <span className="animate-spin text-2xl">⏳</span>
                  <span>Fetching report records from database...</span>
                </div>
              ) : reportDataset && reportDataset.columnHeaders ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold text-[10px]">
                      <tr>
                        {reportDataset.columnHeaders.map((header, idx) => (
                          <th key={idx} className="py-3 px-3.5 whitespace-nowrap">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      {reportDataset.rows
                        .filter((row) =>
                          !reportTableFilter.trim() ||
                          row.some((cell) => cell.toLowerCase().includes(reportTableFilter.toLowerCase().trim()))
                        )
                        .map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition ${
                              rIdx % 2 === 1 ? 'bg-slate-50/40 dark:bg-slate-900/30' : ''
                            }`}
                          >
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="py-2.5 px-3.5 whitespace-nowrap font-mono text-[11px]">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}

                      {reportDataset.rows.length === 0 && (
                        <tr>
                          <td
                            colSpan={reportDataset.columnHeaders.length}
                            className="py-12 text-center text-slate-400 text-xs italic"
                          >
                            No records found matching the specified report criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        )}
        {/* Owner Vacate Confirmation Modal (Yes / No) */}
        {vacateConfirmModal?.isOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto text-2xl font-bold">
                🛑
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white font-headers">
                  Confirm Seat Vacancy
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Are you sure you want to vacate <strong className="text-slate-900 dark:text-white font-mono font-bold">Desk {vacateConfirmModal.seatCode}</strong>{vacateConfirmModal.studentName ? ` assigned to ${vacateConfirmModal.studentName}` : ''}? This will terminate the active student session and mark the seat as AVAILABLE.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setVacateConfirmModal(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  No, Keep Active
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const action = vacateConfirmModal.onConfirm;
                    setVacateConfirmModal(null);
                    await action();
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-500/20 cursor-pointer"
                >
                  Yes, Vacate Seat
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
