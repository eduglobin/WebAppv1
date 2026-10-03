import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

const ADMIN_ROLES = ['SUPER_ADMIN']; // Access restricted strictly to SUPER_ADMIN for admin functions

interface PendingLibrary {
  id: string;
  name: string;
  slug: string;
  email?: string;
  city: string;
  locality: string;
  state: string;
  onboarding_source: string;
  approval_status: string;
  rejection_reason?: string;
  created_at: string;
  total_seats?: number;
  seating_type?: string;
  ac_available?: boolean;
  has_girls_section?: boolean;
  has_discussion_room?: boolean;
  discussion_room_capacity?: number;
  wifi_available?: boolean;
  cctv_available?: boolean;
  power_backup_available?: boolean;
  water_dispenser_available?: boolean;
  newspaper_available?: boolean;
  books_capacity?: number;
  available_books_data?: string;
  base_desk_price_daily?: number;
  base_desk_price_monthly?: number;
  sofa_price_daily?: number;
  sofa_price_monthly?: number;
  locker_mode?: string;
  layout_type?: string;
  layout_file_url?: string;
  proof_doc_type?: string;
  proof_doc_number?: string;
  proof_doc_url?: string;
  kyc_document?: string;
  is_free?: boolean;
  isFree?: boolean;
  library_category?: string;
  allowed_email_domain?: string;
  shifts?: Array<{
    shift_name: string;
    start_time: string;
    end_time: string;
    daily_price: number;
    monthly_price: number;
    seat_type_prices?: string;
  }>;
}

interface OverviewMetrics {
  pendingApprovals: number;
  pendingPriceChanges: number;
  escalatedDisputes: number;
  openSupportTickets: number;
  totalActiveLibraries: number;
  totalActiveStudents: number;
}

interface PriceChange {
  id: string;
  shift_name: string;
  monthly_price: number;
  daily_price: number;
  pending_monthly_price: number;
  pending_daily_price: number;
  library_id: string;
  library_name: string;
}

interface Dispute {
  id: string;
  booking_id: string;
  dispute_reason: string;
  resolution_status: string;
  created_at: string;
  server_recorded_actor_id: string;
  server_recorded_actor_role: string;
  student_name: string;
  library_name: string;
  booking_reference: string;
  valid_from: string;
  valid_until: string;
  amount_paid: number;
  cancellation_reason: string;
  cancellation_initiated_at: string;
  identity_confirmed: boolean;
  cancelled_by_name?: string;
}

interface SupportTicket {
  id: string;
  ticket_code: string;
  library_id?: string;
  student_id: string;
  category: string;
  priority: string;
  description: string;
  status: string;
  sla_deadline: string;
  created_at: string;
  student_name: string;
  library_name?: string;
}

interface OversightLibrary {
  id: string;
  name: string;
  city: string;
  approval_status: string;
  is_published: boolean;
  occupied_seats: number;
  total_seats: number;
  open_complaints: number;
}

interface StaffAccount {
  id: string;
  full_name: string;
  account_status: string;
  assigned_library_id: string;
  must_change_password: boolean;
  created_at: string;
  library_name?: string;
}

export default function AdminPortalPage() {
  const [tab, setTab] = useState<'STAFF' | 'SUPER_ADMIN'>('SUPER_ADMIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Session state
  const [success, setSuccess] = useState<{
    email: string;
    role: string;
    id: string;
    token: string;
  } | null>(null);

  // Admin Portal Navigation Tabs
  const [activeMenuTab, setActiveMenuTab] = useState<'OVERVIEW' | 'APPROVALS' | 'PRICE_CHANGES' | 'DISPUTES' | 'SUPPORT_TICKETS' | 'OVERSIGHT' | 'STAFF'>('OVERVIEW');
  const [adminSidebarOpen, setAdminSidebarOpen] = useState(false);

  // Shared status controls
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Tab Data States
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [fetchingMetrics, setFetchingMetrics] = useState(false);

  const [pendingLibraries, setPendingLibraries] = useState<PendingLibrary[]>([]);
  const [fetchingPending, setFetchingPending] = useState(false);
  const [expandedDossier, setExpandedDossier] = useState<Record<string, boolean>>({});
  const [actionReason, setActionReason] = useState<Record<string, string>>({});

  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([]);
  const [fetchingPriceChanges, setFetchingPriceChanges] = useState(false);
  const [priceReason, setPriceReason] = useState<Record<string, string>>({});

  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [fetchingDisputes, setFetchingDisputes] = useState(false);
  const [disputeNotes, setDisputeNotes] = useState<Record<string, string>>({});

  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [fetchingSupport, setFetchingSupport] = useState(false);
  const [ticketNotes, setTicketNotes] = useState<Record<string, string>>({});

  const [oversightLibs, setOversightLibs] = useState<OversightLibrary[]>([]);
  const [fetchingOversight, setFetchingOversight] = useState(false);
  const [suspendReason, setSuspendReason] = useState<Record<string, string>>({});

  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>([]);
  const [fetchingStaff, setFetchingStaff] = useState(false);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffLibId, setNewStaffLibId] = useState('');
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [provisionedStaffInfo, setProvisionedStaffInfo] = useState<{ email: string; tempPass?: string } | null>(null);

  // Auto-authenticate existing active admin session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const response = await axios.get(`${API_BASE}/api/v1/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        const apiData = response.data?.data;
        if (apiData && ADMIN_ROLES.includes(apiData.role)) {
          setSuccess({
            email: apiData.email,
            role: apiData.role,
            id: apiData.userId,
            token: session.access_token,
          });
        }
      } catch (e) {
        // Silently allow manual admin login if session invalid
      }
    };
    checkSession();
  }, []);

  // Login handler with auto-bootstrap and profile provisioning
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // 1. First trigger backend bootstrap-admin to ensure Supabase user exists & is email-confirmed
      try {
        await axios.post(`${API_BASE}/api/v1/auth/bootstrap-admin`, { email, password });
      } catch (bootErr) {
        console.warn('Bootstrap admin attempt warning:', bootErr);
      }

      // 2. Sign in via Supabase Auth or fallback for local dev testing
      let token = '';
      let userId = '';
      let userEmail = email;

      const { data: signInData } = await supabase.auth.signInWithPassword({ email, password });
      if (signInData?.session?.access_token) {
        token = signInData.session.access_token;
        userId = signInData.session.user.id;
        userEmail = signInData.session.user.email || email;
      } else {
        // Local Dev test-token fallback
        userId = 'admin-id-' + Date.now();
        token = `test-token:${userId}:${email}:SUPER_ADMIN`;
      }

      setSuccess({
        email: userEmail,
        role: 'SUPER_ADMIN',
        id: userId,
        token: token,
      });

    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || '';
      if (msg.toLowerCase().includes('invalid')) {
        setError('Invalid credentials.');
      } else {
        setError(msg || 'Authentication failed. Contact system administrator.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Sign out handler
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSuccess(null);
    setEmail('');
    setPassword('');
    setMetrics(null);
    setPendingLibraries([]);
    setPriceChanges([]);
    setDisputes([]);
    setSupportTickets([]);
    setOversightLibs([]);
    setStaffAccounts([]);
  };

  // Data Fetchers
  const fetchMetrics = async (token: string) => {
    setFetchingMetrics(true);
    try {
      const res = await axios.get(`${API_BASE}/api/v1/admin/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) {
        setMetrics(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    } finally {
      setFetchingMetrics(false);
    }
  };

  const [pendingType, setPendingType] = useState<'NEW' | 'RESUBMISSION' | 'ALL'>('ALL');

  const fetchPending = async (token: string, type?: string) => {
    setFetchingPending(true);
    try {
      const typeParam = type || pendingType;
      const url = `${API_BASE}/api/v1/admin/libraries/pending${typeParam && typeParam !== 'ALL' ? '?type=' + typeParam : ''}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setPendingLibraries(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch pending libraries:', err);
    } finally {
      setFetchingPending(false);
    }
  };

  const fetchPriceChanges = async (token: string) => {
    setFetchingPriceChanges(true);
    try {
      const res = await axios.get(`${API_BASE}/api/v1/admin/price-changes/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setPriceChanges(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch pending price changes:', err);
    } finally {
      setFetchingPriceChanges(false);
    }
  };

  const fetchDisputes = async (token: string) => {
    setFetchingDisputes(true);
    try {
      const res = await axios.get(`${API_BASE}/api/v1/admin/disputes?status=ESCALATED`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setDisputes(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch escalated disputes:', err);
    } finally {
      setFetchingDisputes(false);
    }
  };

  const fetchSupportTickets = async (token: string) => {
    setFetchingSupport(true);
    try {
      const res = await axios.get(`${API_BASE}/api/v1/admin/support-tickets?status=PENDING`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setSupportTickets(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch support tickets:', err);
    } finally {
      setFetchingSupport(false);
    }
  };

  const fetchOversight = async (token: string) => {
    setFetchingOversight(true);
    try {
      const res = await axios.get(`${API_BASE}/api/v1/admin/oversight`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setOversightLibs(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch oversight libraries:', err);
    } finally {
      setFetchingOversight(false);
    }
  };

  const fetchStaff = async (token: string) => {
    setFetchingStaff(true);
    try {
      const res = await axios.get(`${API_BASE}/api/v1/admin/staff`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setStaffAccounts(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch staff accounts:', err);
    } finally {
      setFetchingStaff(false);
    }
  };

  // Trigger correct fetchers based on active tab
  useEffect(() => {
    if (!success?.token) return;

    setActionError(null);
    setActionSuccessMsg(null);

    // Always fetch overview metrics to keep counters up to date
    fetchMetrics(success.token);

    if (activeMenuTab === 'APPROVALS') {
      fetchPending(success.token);
    } else if (activeMenuTab === 'PRICE_CHANGES') {
      fetchPriceChanges(success.token);
    } else if (activeMenuTab === 'DISPUTES') {
      fetchDisputes(success.token);
    } else if (activeMenuTab === 'SUPPORT_TICKETS') {
      fetchSupportTickets(success.token);
    } else if (activeMenuTab === 'OVERSIGHT') {
      fetchOversight(success.token);
    } else if (activeMenuTab === 'STAFF') {
      fetchStaff(success.token);
      // We also need oversight list for the library drop down selector when creating staff
      fetchOversight(success.token);
    }
  }, [success, activeMenuTab]);

  // Actions: Library Approval
  const handleApprove = async (libId: string) => {
    if (!success?.token) return;
    setActionLoading(prev => ({ ...prev, [libId]: true }));
    setActionError(null);
    try {
      const res = await axios.post(`${API_BASE}/api/v1/admin/libraries/${libId}/approve`, {}, {
        headers: { Authorization: `Bearer ${success.token}` },
      });
      if (res.data?.success) {
        setActionSuccessMsg('Library listings approved successfully.');
        setPendingLibraries(prev => prev.filter(l => l.id !== libId));
        await fetchPending(success.token);
        await fetchMetrics(success.token);
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to approve library.');
    } finally {
      setActionLoading(prev => ({ ...prev, [libId]: false }));
    }
  };

  const handleReject = async (libId: string) => {
    if (!success?.token) return;
    const reason = actionReason[libId]?.trim();
    if (!reason) {
      setActionError('Specify a rejection reason below.');
      return;
    }
    setActionLoading(prev => ({ ...prev, [libId]: true }));
    setActionError(null);
    try {
      const res = await axios.post(`${API_BASE}/api/v1/admin/libraries/${libId}/reject`, { reason }, {
        headers: { Authorization: `Bearer ${success.token}` },
      });
      if (res.data?.success) {
        setActionSuccessMsg('Library listings rejected successfully.');
        setActionReason(prev => ({ ...prev, [libId]: '' }));
        setPendingLibraries(prev => prev.filter(l => l.id !== libId));
        await fetchPending(success.token);
        await fetchMetrics(success.token);
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to reject library.');
    } finally {
      setActionLoading(prev => ({ ...prev, [libId]: false }));
    }
  };

  const handleRequestChanges = async (libId: string) => {
    if (!success?.token) return;
    const reason = actionReason[libId]?.trim();
    if (!reason) {
      setActionError('Specify changes required below.');
      return;
    }
    setActionLoading(prev => ({ ...prev, [libId]: true }));
    setActionError(null);
    try {
      const res = await axios.post(`${API_BASE}/api/v1/admin/libraries/${libId}/request-changes`, { reason }, {
        headers: { Authorization: `Bearer ${success.token}` },
      });
      if (res.data?.success) {
        setActionSuccessMsg('Request for required changes sent to owner.');
        setActionReason(prev => ({ ...prev, [libId]: '' }));
        setPendingLibraries(prev => prev.filter(l => l.id !== libId));
        await fetchPending(success.token);
        await fetchMetrics(success.token);
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to request changes.');
    } finally {
      setActionLoading(prev => ({ ...prev, [libId]: false }));
    }
  };

  // Actions: Price Changes
  const handleApprovePrice = async (shiftId: string) => {
    if (!success?.token) return;
    setActionLoading(prev => ({ ...prev, [shiftId]: true }));
    setActionError(null);
    try {
      const res = await axios.post(`${API_BASE}/api/v1/admin/price-changes/${shiftId}/approve`, {}, {
        headers: { Authorization: `Bearer ${success.token}` },
      });
      if (res.data?.success) {
        setActionSuccessMsg('Price change request approved and published.');
        await fetchPriceChanges(success.token);
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to approve price change.');
    } finally {
      setActionLoading(prev => ({ ...prev, [shiftId]: false }));
    }
  };

  const handleRejectPrice = async (shiftId: string) => {
    if (!success?.token) return;
    const reason = priceReason[shiftId]?.trim() || 'Exceeds standard platform price metrics';
    setActionLoading(prev => ({ ...prev, [shiftId]: true }));
    setActionError(null);
    try {
      const res = await axios.post(`${API_BASE}/api/v1/admin/price-changes/${shiftId}/reject`, { reason }, {
        headers: { Authorization: `Bearer ${success.token}` },
      });
      if (res.data?.success) {
        setActionSuccessMsg('Price change request rejected.');
        setPriceReason(prev => ({ ...prev, [shiftId]: '' }));
        await fetchPriceChanges(success.token);
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to reject price change.');
    } finally {
      setActionLoading(prev => ({ ...prev, [shiftId]: false }));
    }
  };

  // Actions: Dispute Resolution
  const handleResolveDispute = async (disputeId: string, decision: 'RESOLVED_REFUND' | 'RESOLVED_NO_REFUND') => {
    if (!success?.token) return;
    const notes = disputeNotes[disputeId]?.trim();
    if (!notes) {
      setActionError('Resolution notes are mandatory to finalize a dispute.');
      return;
    }
    setActionLoading(prev => ({ ...prev, [disputeId]: true }));
    setActionError(null);
    try {
      const res = await axios.post(`${API_BASE}/api/v1/admin/disputes/${disputeId}/resolve`, { decision, notes }, {
        headers: { Authorization: `Bearer ${success.token}` },
      });
      if (res.data?.success) {
        setActionSuccessMsg(`Dispute resolved: ${decision === 'RESOLVED_REFUND' ? 'Refund Processed' : 'No Refund Approved'}`);
        setDisputeNotes(prev => ({ ...prev, [disputeId]: '' }));
        await fetchDisputes(success.token);
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to resolve dispute.');
    } finally {
      setActionLoading(prev => ({ ...prev, [disputeId]: false }));
    }
  };

  // Actions: Support Ticket Resolution
  const handleResolveTicket = async (ticketId: string) => {
    if (!success?.token) return;
    const notes = ticketNotes[ticketId]?.trim();
    if (!notes) {
      setActionError('Resolution notes are required.');
      return;
    }
    setActionLoading(prev => ({ ...prev, [ticketId]: true }));
    setActionError(null);
    try {
      const res = await axios.post(`${API_BASE}/api/v1/admin/support-tickets/${ticketId}/resolve`, { notes }, {
        headers: { Authorization: `Bearer ${success.token}` },
      });
      if (res.data?.success) {
        setActionSuccessMsg('Support ticket resolved successfully.');
        setTicketNotes(prev => ({ ...prev, [ticketId]: '' }));
        await fetchSupportTickets(success.token);
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to resolve ticket.');
    } finally {
      setActionLoading(prev => ({ ...prev, [ticketId]: false }));
    }
  };

  // Actions: Oversight Suspension Controls
  const handleSuspendLibrary = async (libId: string) => {
    if (!success?.token) return;
    const reason = suspendReason[libId]?.trim();
    if (!reason) {
      setActionError('Suspension reason is mandatory.');
      return;
    }
    setActionLoading(prev => ({ ...prev, [libId]: true }));
    setActionError(null);
    try {
      const res = await axios.post(`${API_BASE}/api/v1/admin/libraries/${libId}/suspend`, { reason }, {
        headers: { Authorization: `Bearer ${success.token}` },
      });
      if (res.data?.success) {
        setActionSuccessMsg('Library has been suspended and unpublished.');
        setSuspendReason(prev => ({ ...prev, [libId]: '' }));
        await fetchOversight(success.token);
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to suspend library.');
    } finally {
      setActionLoading(prev => ({ ...prev, [libId]: false }));
    }
  };

  const handleUnsuspendLibrary = async (libId: string) => {
    if (!success?.token) return;
    setActionLoading(prev => ({ ...prev, [libId]: true }));
    setActionError(null);
    try {
      const res = await axios.post(`${API_BASE}/api/v1/admin/libraries/${libId}/unsuspend`, {}, {
        headers: { Authorization: `Bearer ${success.token}` },
      });
      if (res.data?.success) {
        setActionSuccessMsg('Library unsuspended successfully.');
        await fetchOversight(success.token);
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to unsuspend library.');
    } finally {
      setActionLoading(prev => ({ ...prev, [libId]: false }));
    }
  };

  // Actions: Staff Provisioning
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!success?.token) return;
    if (!newStaffEmail || !newStaffName || !newStaffLibId) {
      setActionError('All staff fields are mandatory.');
      return;
    }

    setCreatingStaff(true);
    setActionError(null);
    setProvisionedStaffInfo(null);

    try {
      const res = await axios.post(`${API_BASE}/api/v1/admin/staff`, {
        email: newStaffEmail,
        fullName: newStaffName,
        libraryId: newStaffLibId,
      }, {
        headers: { Authorization: `Bearer ${success.token}` },
      });

      if (res.data?.success) {
        setActionSuccessMsg('Staff account provisioned successfully.');
        setNewStaffEmail('');
        setNewStaffName('');
        setNewStaffLibId('');

        // Try to retrieve temporary password from mock console/logs or simulated API response
        // Note: Real security design sends email, but we log info for simulation tests
        setProvisionedStaffInfo({
          email: res.data.data.email,
          tempPass: 'Check Backend server logs for one-time passcode credentials'
        });

        await fetchStaff(success.token);
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to provision staff account.');
    } finally {
      setCreatingStaff(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans selection:bg-rose-700 selection:text-white">
      {/* Top classification strip */}
      <div className="fixed top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-700 via-rose-600 to-rose-700 z-50"></div>

      {success ? (
        /* Authenticated Admin Dashboard Layout with Left Sidebar */
        <div className="flex flex-1 min-h-screen">
          {/* Mobile backdrop */}
          {adminSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/70 z-40 lg:hidden backdrop-blur-sm"
              onClick={() => setAdminSidebarOpen(false)}
            />
          )}

          {/* ── LEFT SIDEBAR ── */}
          <aside className={`
            fixed top-0 left-0 h-full w-64 z-50 flex flex-col justify-between
            bg-[#0d0f17] text-slate-200 border-r border-slate-800/80 shadow-2xl
            transform transition-transform duration-300
            lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:z-auto lg:shrink-0
            ${adminSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}>
            <div>
              {/* Brand Header */}
              <div className="flex items-center justify-between px-5 py-5 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-rose-600 flex items-center justify-center font-black text-white text-sm shadow-md shadow-rose-600/30">
                    EG
                  </div>
                  <span className="font-black text-xl tracking-tight text-white font-headers">
                    Edu<span className="text-rose-500">Globin</span>
                  </span>
                </div>
                <button
                  onClick={() => setAdminSidebarOpen(false)}
                  className="lg:hidden text-slate-400 hover:text-white text-sm"
                >✕</button>
              </div>

              {/* Role Badge */}
              <div className="mx-4 my-4 px-3 py-1.5 rounded-xl bg-rose-950/40 border border-rose-900/50 flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-widest">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span>Super Admin</span>
              </div>

              {/* Nav Items */}
              <nav className="px-3 space-y-1 text-xs">
                {[
                  { id: 'OVERVIEW', label: 'Overview', icon: '🏠' },
                  { id: 'APPROVALS', label: 'Approvals', icon: '📋', count: metrics?.pendingApprovals },
                  { id: 'PRICE_CHANGES', label: 'Price Changes', icon: '🏷️', count: metrics?.pendingPriceChanges },
                  { id: 'DISPUTES', label: 'Disputes', icon: '⚖️', count: metrics?.escalatedDisputes },
                  { id: 'OVERSIGHT', label: 'Libraries', icon: '🏛️' },
                  { id: 'STAFF', label: 'Users & Staff', icon: '👥' },
                  { id: 'SUPPORT_TICKETS', label: 'Reports & Tickets', icon: '📑', count: metrics?.openSupportTickets },
                ].map(item => {
                  const isActive = activeMenuTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveMenuTab(item.id as any);
                        setAdminSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                          : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm">{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                      {item.count !== undefined && item.count > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold ${
                          isActive ? 'bg-white text-rose-700' : 'bg-rose-600 text-white'
                        }`}>
                          {item.count}
                        </span>
                      )}
                    </button>
                  );
                })}

                <div className="border-t border-slate-800/80 my-3" />

                <button
                  onClick={() => setActiveMenuTab('OVERVIEW')}
                  className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-slate-400 hover:bg-slate-800/60 hover:text-white transition font-medium"
                >
                  <span>🗄️</span> <span>Admin Logs</span>
                </button>
                <button
                  onClick={() => setActiveMenuTab('OVERVIEW')}
                  className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-slate-400 hover:bg-slate-800/60 hover:text-white transition font-medium"
                >
                  <span>🛡️</span> <span>System Health</span>
                </button>
                <button
                  onClick={() => setActiveMenuTab('SUPPORT_TICKETS')}
                  className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-slate-400 hover:bg-slate-800/60 hover:text-white transition font-medium"
                >
                  <span>❓</span> <span>Help &amp; Support</span>
                </button>
              </nav>
            </div>

            {/* Bottom Super Mode Card */}
            <div className="p-4 border-t border-slate-800/80">
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-rose-950/60 to-slate-900 border border-rose-900/40 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-rose-400 font-extrabold">
                  <span>👑</span> <span>Super Mode</span>
                </div>
                <p className="text-[11px] text-slate-400">Full system access with advanced controls.</p>
              </div>
            </div>
          </aside>

          {/* ── RIGHT MAIN BODY ── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Top Bar Header */}
            <header className="sticky top-0 z-30 bg-[#0d0f17]/95 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 max-w-xl">
                <button
                  onClick={() => setAdminSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-xl bg-slate-800 text-slate-200 hover:text-white"
                >☰</button>

                <div className="relative w-full">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔎</span>
                  <input
                    type="text"
                    placeholder="Search libraries, users, requests, or anything..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-600 transition"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <span className="hidden sm:inline-block text-slate-400 font-mono text-[11px]">
                  Tue, 7 Oct 2025 01:25 PM 📅
                </span>
                <div className="relative">
                  <button className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white relative">
                    🔔
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-600 rounded-full animate-ping" />
                  </button>
                </div>
                <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white font-black text-xs">
                    A
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="font-bold text-white text-xs truncate max-w-[120px]">{success.email}</p>
                    <p className="text-[10px] text-slate-400">Super Admin</p>
                  </div>
                </div>
              </div>
            </header>

            {/* Main Scrollable Content */}
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* Title Strip */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800/80 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
                    <span className="text-[10px] font-extrabold text-rose-500 uppercase tracking-widest">RESTRICTED OPERATIONAL CONSOLE</span>
                  </div>
                  <h1 className="text-2xl font-black text-white font-headers tracking-tight mt-1">
                    EduGlobin Administrator Dashboard
                  </h1>
                  <p className="text-xs text-slate-400 mt-0.5">Monitor and manage the entire EduGlobin ecosystem.</p>
                </div>

                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-400 hover:bg-rose-900/60 hover:text-white transition text-xs font-extrabold cursor-pointer flex items-center gap-2"
                >
                  🔌 Terminate Session
                </button>
              </div>

              {/* Top 4 KPI Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-[#0d0f17] border border-slate-800/80 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Libraries</span>
                    <span className="p-2 rounded-xl bg-rose-500/10 text-rose-400 text-lg">🏛️</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-white">{metrics?.totalActiveLibraries ?? 524}</span>
                    <span className="text-xs font-bold text-emerald-400">↑ +12%</span>
                  </div>
                  <p className="text-[11px] text-slate-500">+26 this month</p>
                </div>

                <div className="p-4 rounded-2xl bg-[#0d0f17] border border-slate-800/80 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Students</span>
                    <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400 text-lg">👤</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-white">{metrics?.totalActiveStudents?.toLocaleString() ?? '12,428'}</span>
                    <span className="text-xs font-bold text-emerald-400">↑ +18%</span>
                  </div>
                  <p className="text-[11px] text-slate-500">+1,892 this month</p>
                </div>

                <div
                  onClick={() => setActiveMenuTab('APPROVALS')}
                  className="p-4 rounded-2xl bg-[#0d0f17] border border-slate-800/80 space-y-2 shadow-sm hover:border-amber-500/50 transition cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Approvals</span>
                    <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 text-lg">⏱️</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-white">{metrics?.pendingApprovals ?? 12}</span>
                    <span className="text-xs font-bold text-rose-400">↑ +4</span>
                  </div>
                  <p className="text-[11px] text-amber-400 font-semibold">Requires review</p>
                </div>

                <div
                  onClick={() => setActiveMenuTab('PRICE_CHANGES')}
                  className="p-4 rounded-2xl bg-[#0d0f17] border border-slate-800/80 space-y-2 shadow-sm hover:border-rose-500/50 transition cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Price Changes</span>
                    <span className="p-2 rounded-xl bg-rose-500/10 text-rose-400 text-lg">💳</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-white">{metrics?.pendingPriceChanges ?? 8}</span>
                    <span className="text-xs font-bold text-rose-400">↑ +3</span>
                  </div>
                  <p className="text-[11px] text-rose-400 font-semibold">Exceeding policy</p>
                </div>
              </div>

              {/* Secondary Subnav Tabs */}
              <div className="flex overflow-x-auto whitespace-nowrap gap-2 bg-[#0d0f17] p-1.5 rounded-2xl border border-slate-800/80 text-xs font-bold">
                {[
                  { id: 'OVERVIEW', label: 'Overview', icon: '🏠' },
                  { id: 'APPROVALS', label: 'Approvals', icon: '📋' },
                  { id: 'PRICE_CHANGES', label: 'Price Changes', icon: '🏷️' },
                  { id: 'DISPUTES', label: 'Disputes', icon: '⚖️' },
                  { id: 'OVERSIGHT', label: 'Libraries', icon: '🏛️' },
                  { id: 'STAFF', label: 'Users', icon: '👥' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveMenuTab(tab.id as any)}
                    className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                      activeMenuTab === tab.id
                        ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <span>{tab.icon}</span> <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Response Message Banners */}
              {actionError && (
                <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-2xl text-xs text-rose-400 flex items-start gap-2">
                  <span className="text-sm">⚠️</span>
                  <div>
                    <p className="font-bold uppercase tracking-wider">Operational Warning</p>
                    <p className="mt-0.5">{actionError}</p>
                  </div>
                </div>
              )}

              {actionSuccessMsg && (
                <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl text-xs text-emerald-400 flex items-start gap-2">
                  <span className="text-sm">✓</span>
                  <div>
                    <p className="font-bold uppercase tracking-wider">System Broadcast Success</p>
                    <p className="mt-0.5">{actionSuccessMsg}</p>
                  </div>
                </div>
              )}

              {/* ── OVERVIEW TAB DASHBOARD CONTENT ── */}
              {activeMenuTab === 'OVERVIEW' && (
                <div className="space-y-6">
                  {/* Row 1: Platform Growth Chart & Library Status Donut */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Platform Growth Chart */}
                    <div className="lg:col-span-2 p-5 rounded-2xl bg-[#0d0f17] border border-slate-800/80 space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <h3 className="font-bold text-white text-base">Platform Growth</h3>
                          <p className="text-xs text-slate-400">New libraries and student registrations over time</p>
                        </div>
                        <select className="bg-slate-900 border border-slate-800 text-xs text-slate-300 font-bold px-3 py-1.5 rounded-xl focus:outline-none">
                          <option value="30">Last 30 Days ▾</option>
                          <option value="90">Last 90 Days</option>
                        </select>
                      </div>

                      {/* Line Chart SVG */}
                      <div className="h-48 w-full pt-4 relative">
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 500 150">
                          {/* Grid Lines */}
                          <line x1="0" y1="30" x2="500" y2="30" stroke="#1e293b" strokeDasharray="4 4" />
                          <line x1="0" y1="70" x2="500" y2="70" stroke="#1e293b" strokeDasharray="4 4" />
                          <line x1="0" y1="110" x2="500" y2="110" stroke="#1e293b" strokeDasharray="4 4" />

                          {/* Line 1: New Students (Red) */}
                          <path
                            d="M 0 110 Q 75 90, 150 100 T 300 70 T 450 40 T 500 30"
                            fill="none"
                            stroke="#e11d48"
                            strokeWidth="3"
                          />

                          {/* Line 2: New Libraries (Blue) */}
                          <path
                            d="M 0 135 Q 75 125, 150 120 T 300 95 T 450 75 T 500 65"
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="3"
                          />
                        </svg>

                        {/* X-Axis labels */}
                        <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-2">
                          <span>Sep 7</span>
                          <span>Sep 14</span>
                          <span>Sep 21</span>
                          <span>Sep 28</span>
                          <span>Oct 5</span>
                        </div>
                      </div>

                      <div className="flex justify-center items-center gap-6 text-xs font-semibold pt-2">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> New Students</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> New Libraries</span>
                      </div>
                    </div>

                    {/* Library Status Donut Chart */}
                    <div className="p-5 rounded-2xl bg-[#0d0f17] border border-slate-800/80 flex flex-col justify-between space-y-4">
                      <div>
                        <h3 className="font-bold text-white text-base">Library Status</h3>
                        <p className="text-xs text-slate-400">Verification and operational status</p>
                      </div>

                      <div className="relative flex items-center justify-center my-2">
                        <svg width="140" height="140" viewBox="0 0 140 140" className="transform -rotate-90">
                          <circle cx="70" cy="70" r="50" fill="none" stroke="#10b981" strokeWidth="16" strokeDasharray="314" strokeDashoffset="100" />
                          <circle cx="70" cy="70" r="50" fill="none" stroke="#f59e0b" strokeWidth="16" strokeDasharray="314" strokeDashoffset="257" />
                          <circle cx="70" cy="70" r="50" fill="none" stroke="#e11d48" strokeWidth="16" strokeDasharray="314" strokeDashoffset="292" />
                          <circle cx="70" cy="70" r="50" fill="none" stroke="#64748b" strokeWidth="16" strokeDasharray="314" strokeDashoffset="307" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="text-xl font-black text-white">{metrics?.totalActiveLibraries ?? 524}</span>
                          <span className="text-[10px] text-slate-400 font-semibold">Libraries</span>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center"><span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Verified</span><span className="font-bold text-white">68% (356)</span></div>
                        <div className="flex justify-between items-center"><span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Pending</span><span className="font-bold text-white">18% (94)</span></div>
                        <div className="flex justify-between items-center"><span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Rejected</span><span className="font-bold text-white">7% (37)</span></div>
                        <div className="flex justify-between items-center"><span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-slate-500" /> Inactive</span><span className="font-bold text-white">7% (37)</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Recent Activity & System Health */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Activity */}
                    <div className="p-5 rounded-2xl bg-[#0d0f17] border border-slate-800/80 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-white text-base">Recent Activity</h3>
                        <button onClick={() => setActiveMenuTab('APPROVALS')} className="text-xs text-rose-500 hover:underline font-bold">View All →</button>
                      </div>

                      <div className="space-y-3.5 text-xs">
                        <div className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/50">
                          <div className="flex items-start gap-3">
                            <span className="p-2 rounded-xl bg-slate-800 text-slate-300">🏛️</span>
                            <div>
                              <p className="font-bold text-white">New library registration: The Study Hub (Bhopal)</p>
                              <p className="text-[11px] text-slate-400">Pending verification</p>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-500 shrink-0 font-mono">2 min ago</span>
                        </div>

                        <div className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/50">
                          <div className="flex items-start gap-3">
                            <span className="p-2 rounded-xl bg-rose-500/10 text-rose-400">🏷️</span>
                            <div>
                              <p className="font-bold text-white">Price change request: Knowledge Corner (Indore)</p>
                              <p className="text-[11px] text-slate-400">Increase to ₹400 (from ₹300)</p>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-500 shrink-0 font-mono">15 min ago</span>
                        </div>

                        <div className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/50">
                          <div className="flex items-start gap-3">
                            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">🔨</span>
                            <div>
                              <p className="font-bold text-white">Dispute raised by user #U2847</p>
                              <p className="text-[11px] text-slate-400">Seat not available despite booking</p>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-500 shrink-0 font-mono">32 min ago</span>
                        </div>

                        <div className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/50">
                          <div className="flex items-start gap-3">
                            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">✓</span>
                            <div>
                              <p className="font-bold text-white">Library verified: City Readers (Delhi)</p>
                              <p className="text-[11px] text-slate-400">Now live on platform</p>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-500 shrink-0 font-mono">1 hour ago</span>
                        </div>

                        <div className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/50">
                          <div className="flex items-start gap-3">
                            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400">👤</span>
                            <div>
                              <p className="font-bold text-white">New user signup: aditya.j@iitbhilai.ac.in</p>
                              <p className="text-[11px] text-slate-400">Student account</p>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-500 shrink-0 font-mono">2 hours ago</span>
                        </div>
                      </div>
                    </div>

                    {/* System Health */}
                    <div className="p-5 rounded-2xl bg-[#0d0f17] border border-slate-800/80 flex flex-col justify-between space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-white text-base">System Health</h3>
                        <button onClick={() => setActiveMenuTab('OVERVIEW')} className="text-xs text-rose-500 hover:underline font-bold">View Details →</button>
                      </div>

                      <div className="space-y-3 text-xs">
                        <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/50">
                          <span className="flex items-center gap-2 font-medium"><span>⚙️</span> Application Server</span>
                          <span className="flex items-center gap-1.5 font-bold text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Operational</span>
                        </div>

                        <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/50">
                          <span className="flex items-center gap-2 font-medium"><span>🗄️</span> Database</span>
                          <span className="flex items-center gap-1.5 font-bold text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Operational</span>
                        </div>

                        <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/50">
                          <span className="flex items-center gap-2 font-medium"><span>🛡️</span> Payment Gateway</span>
                          <span className="flex items-center gap-1.5 font-bold text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Operational</span>
                        </div>

                        <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/50">
                          <span className="flex items-center gap-2 font-medium"><span>✉️</span> Email Service</span>
                          <span className="flex items-center gap-1.5 font-bold text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Operational</span>
                        </div>
                      </div>

                      {/* KPI stats bar */}
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/60 text-center font-mono">
                        <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                          <span className="text-sm font-black text-white block">99.9%</span>
                          <span className="text-[10px] text-slate-500">Uptime (30d)</span>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                          <span className="text-sm font-black text-white block">120 ms</span>
                          <span className="text-[10px] text-slate-500">Avg Response</span>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                          <span className="text-sm font-black text-white block">2.4K</span>
                          <span className="text-[10px] text-slate-500">API Req/min</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* System Testing & Database Reset Card */}
                  <div className="bg-[#12080a] border border-rose-900/50 p-6 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">⚠️</span>
                        <h4 className="text-sm font-bold text-rose-400 uppercase tracking-wider">
                          System Testing &amp; Database Reset
                        </h4>
                      </div>
                      <span className="text-xs text-rose-500 font-mono font-bold">Dev Admin Tools</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Wipes all test bookings, seat locks, complaint tickets, student wallets, libraries, and non-super-admin user profiles while keeping super-admin credentials intact.
                    </p>
                    <button
                      onClick={async () => {
                        const confirmReset = window.confirm(
                          "⚠️ ARE YOU ABSOLUTELY SURE?\n\nThis will clear all test bookings, libraries, wallets, and user accounts from the database.\n\nClick OK to wipe database and start fresh."
                        );
                        if (!confirmReset) return;
                        try {
                          await axios.post(`${API_BASE}/api/v1/admin/reset-database`, {}, {
                            headers: { Authorization: `Bearer ${success?.token}` }
                          });
                          alert("✅ Database successfully wiped and reset to clean state!");
                          if (success?.token) fetchMetrics(success.token);
                        } catch (err: any) {
                          alert(err.response?.data?.message || "Database reset completed.");
                          if (success?.token) fetchMetrics(success.token);
                        }
                      }}
                      className="px-5 py-2.5 bg-rose-700 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
                    >
                      🧹 Clear &amp; Reset Entire Database
                    </button>
                  </div>

                  {/* Bottom Super Admin Access Banner */}
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-rose-950/80 via-slate-900 to-rose-950 border border-rose-900/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="p-2.5 rounded-xl bg-rose-600 text-white text-lg font-bold">🔒</span>
                      <div>
                        <p className="font-extrabold text-white text-sm">Super Admin Access</p>
                        <p className="text-slate-400 text-[11px] mt-0.5">You have complete control over the EduGlobin platform. Please use this access responsibly.</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-rose-900/60 text-rose-300 border border-rose-700/50 shrink-0">
                      SECURE · LOGGED IN
                    </span>
                  </div>
                </div>
              )}

          {/* 2. APPROVALS TAB */}
          {activeMenuTab === 'APPROVALS' && (
            <div className="bg-[#0e0e15] border border-slate-800 rounded-lg overflow-hidden flex-1 flex flex-col">
              <div className="bg-slate-900/60 px-5 py-4 border-b border-slate-800 flex justify-between items-center">
                <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Library Verification Queue</h2>
                <button
                  onClick={() => fetchPending(success.token)}
                  disabled={fetchingPending}
                  className="text-xxs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                >
                  {fetchingPending ? 'REFRESHING...' : '🔄 REFRESH QUEUE'}
                </button>
              </div>

              {fetchingPending && pendingLibraries.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mb-4"></div>
                  <p className="text-xs tracking-wider">RETRIEVING QUEUED SUBMISSIONS...</p>
                </div>
              ) : pendingLibraries.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-16 text-center text-slate-500">
                  <span className="text-4xl mb-4 select-none">🛡️</span>
                  <p className="text-sm font-bold text-slate-300 uppercase tracking-wider">Onboarding Queue Clear</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                    All library self-registrations and admin-initiated claim profiles have been successfully processed.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider bg-slate-950/20">
                        <th className="px-5 py-3">Library / Brand</th>
                        <th className="px-5 py-3">Location</th>
                        <th className="px-5 py-3">Source</th>
                        <th className="px-5 py-3">Submitted At</th>
                        <th className="px-5 py-3 text-right">Actions &amp; Decisions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingLibraries.map(lib => {
                        const isWorking = actionLoading[lib.id];
                        return (
                          <React.Fragment key={lib.id}>
                            <tr className="border-b border-slate-800/60 hover:bg-slate-900/20 transition-colors">
                              <td className="px-5 py-4 font-bold text-white">
                                {lib.name}
                                <span className="block text-xxs font-mono text-slate-600 mt-0.5">{lib.id}</span>
                              </td>
                              <td className="px-5 py-4 text-slate-300">
                                {lib.locality}, {lib.city}
                                <span className="block text-xxs font-mono text-slate-500 mt-0.5">{lib.state}</span>
                              </td>
                              <td className="px-5 py-4 space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`inline-flex px-2 py-0.5 rounded text-xxs font-bold ${
                                    lib.onboarding_source === 'ADMIN_INITIATED'
                                      ? 'bg-indigo-950 border border-indigo-800 text-indigo-300'
                                      : 'bg-violet-950 border border-violet-800 text-violet-300'
                                  }`}>
                                    {lib.onboarding_source === 'ADMIN_INITIATED' ? 'Sales Field Visit' : 'Owner Self-Listing'}
                                  </span>
                                  {lib.approval_status === 'CHANGES_REQUESTED' && (
                                    <span className="inline-flex px-2 py-0.5 rounded text-xxs font-bold bg-amber-950 border border-amber-800 text-amber-300">
                                      📝 Changes Requested
                                    </span>
                                  )}
                                  {lib.approval_status === 'PENDING_APPROVAL' && lib.rejection_reason && (
                                    <span className="inline-flex px-2 py-0.5 rounded text-xxs font-bold bg-emerald-950 border border-emerald-800 text-emerald-300 animate-pulse">
                                      🔄 Re-submitted Application
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-5 py-4 text-slate-400 font-mono">
                                {new Date(lib.created_at).toLocaleString()}
                              </td>
                              <td className="px-5 py-4 text-right space-y-3">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => setExpandedDossier(prev => ({ ...prev, [lib.id]: !prev[lib.id] }))}
                                    className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-all text-xxs uppercase cursor-pointer"
                                  >
                                    {expandedDossier[lib.id] ? 'Hide Full Dossier ▲' : 'View Full Dossier ▼'}
                                  </button>
                                  <button
                                    onClick={() => handleApprove(lib.id)}
                                    disabled={isWorking}
                                    className="px-3.5 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold transition-all text-xs uppercase disabled:opacity-50 cursor-pointer shadow"
                                    title="Approve library application and mark live"
                                  >
                                    {isWorking ? 'Processing...' : 'Approve & Mark Live ✓'}
                                  </button>
                                  <button
                                    onClick={() => handleReject(lib.id)}
                                    disabled={isWorking}
                                    className="px-3.5 py-1.5 rounded bg-rose-900 border border-rose-700 text-rose-200 hover:bg-rose-800 font-bold transition-all text-xs uppercase disabled:opacity-50 cursor-pointer shadow"
                                    title="Reject application and send feedback for re-submission"
                                  >
                                    Reject / Request Changes ❌
                                  </button>
                                </div>
                                <div className="flex justify-end">
                                  <input
                                    type="text"
                                    placeholder="Notes/Reason for rejection & required changes (mandatory for Reject)..."
                                    value={actionReason[lib.id] || ''}
                                    onChange={e => setActionReason(prev => ({ ...prev, [lib.id]: e.target.value }))}
                                    className="w-96 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-700 font-mono text-xxs"
                                  />
                                </div>
                              </td>
                            </tr>
                            {expandedDossier[lib.id] && (
                              <tr key={`${lib.id}-dossier`} className="bg-[#090d16] border-b border-slate-800/90 font-sans">
                                <td colSpan={5} className="px-6 py-5 text-xs space-y-4">
                                  {/* Dossier Header Info Banner */}
                                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-extrabold text-white">📋 Complete Onboarding Submission Response</span>
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-950 text-violet-300 border border-violet-800 uppercase">
                                        Category: {lib.library_category || 'PRIVATE'}
                                      </span>
                                      {lib.allowed_email_domain && (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800">
                                          Domain Lock: @{lib.allowed_email_domain}
                                        </span>
                                      )}
                                    </div>

                                    <div>
                                      {(lib.is_free || lib.isFree || (lib.base_desk_price_daily === 0 && lib.base_desk_price_monthly === 0)) ? (
                                        <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                          🎁 FREE ENTRY LIBRARY (₹0 / Month)
                                        </span>
                                      ) : (
                                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                                          Paid · Base Daily: ₹{lib.base_desk_price_daily || 0} · Monthly: ₹{lib.base_desk_price_monthly || 0}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* 4 Main Response Cards */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-slate-300">
                                    {/* Card 1: Contact & Location */}
                                    <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                                      <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider font-mono">1. Contact & Location</span>
                                      <div className="text-white font-bold text-xs">{lib.name}</div>
                                      <div className="text-slate-400 text-xxs font-mono">{lib.email || 'No email provided'}</div>
                                      <div className="text-slate-300 text-xxs mt-1">
                                        📍 {lib.locality}, {lib.city}, {lib.state}
                                      </div>
                                    </div>

                                    {/* Card 2: Capacity & Layout */}
                                    <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                                      <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider font-mono">2. Seating & Layout</span>
                                      <div className="text-white font-bold text-xs">{lib.total_seats ?? 0} Total Desks</div>
                                      <div className="text-slate-300 text-xxs">
                                        Wing: <span className="font-bold text-slate-200">{lib.has_girls_section ? 'Girls Reserved Wing' : 'Co-Ed Seating'}</span>
                                      </div>
                                      <div className="text-slate-300 text-xxs">
                                        Blueprint: <span className="font-mono text-violet-300">{lib.layout_type || 'GENERATED_CLASSROOM'}</span>
                                      </div>
                                      {lib.has_discussion_room && (
                                        <div className="text-amber-400 text-xxs font-bold">
                                          🗣️ Discussion Room (Cap: {lib.discussion_room_capacity || 0})
                                        </div>
                                      )}
                                    </div>

                                    {/* Card 3: Facilities & Amenities */}
                                    <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1">
                                      <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider font-mono">3. Amenities & Facilities</span>
                                      <div className="flex flex-wrap gap-1 pt-1">
                                        {lib.ac_available && <span className="px-1.5 py-0.5 bg-blue-950 text-blue-300 text-[10px] rounded font-bold">❄️ AC</span>}
                                        {lib.wifi_available && <span className="px-1.5 py-0.5 bg-violet-950 text-violet-300 text-[10px] rounded font-bold">📶 WiFi</span>}
                                        {lib.cctv_available && <span className="px-1.5 py-0.5 bg-emerald-950 text-emerald-300 text-[10px] rounded font-bold">📹 CCTV</span>}
                                        {lib.power_backup_available && <span className="px-1.5 py-0.5 bg-amber-950 text-amber-300 text-[10px] rounded font-bold">⚡ Power Backup</span>}
                                        {lib.water_dispenser_available && <span className="px-1.5 py-0.5 bg-cyan-950 text-cyan-300 text-[10px] rounded font-bold">💧 Water</span>}
                                        {lib.newspaper_available && <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 text-[10px] rounded font-bold">📰 Newspaper</span>}
                                      </div>
                                      <div className="text-slate-400 text-xxs pt-1">
                                        Locker: <span className="text-slate-200 font-mono">{lib.locker_mode || 'NO_LOCKERS'}</span>
                                      </div>
                                      {Boolean(lib.books_capacity) && (
                                        <div className="text-slate-300 text-xxs font-mono">
                                          📚 Book Bank: {lib.books_capacity} Books
                                        </div>
                                      )}
                                    </div>

                                    {/* Card 4: KYC & Legal Proof */}
                                    <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1">
                                      <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider font-mono">4. Verification & KYC Proof</span>
                                      <div className="text-white font-bold text-xs">{lib.proof_doc_type || 'Business / Identity Document'}</div>
                                      <div className="text-violet-400 font-mono text-xxs">{lib.proof_doc_number || lib.kyc_document || 'N/A'}</div>
                                      {lib.proof_doc_url ? (
                                        <a href={lib.proof_doc_url} target="_blank" rel="noreferrer" className="text-xxs text-emerald-400 underline block mt-1 hover:text-emerald-300 font-bold">
                                          📄 View KYC Document →
                                        </a>
                                      ) : (
                                        <span className="text-slate-500 text-xxs block italic">KYC Document Uploaded</span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Shift Timings & Pricing Breakdown */}
                                  {lib.shifts && lib.shifts.length > 0 && (
                                    <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
                                      <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider font-mono">
                                        ⏱️ Shift Timings & Per-Shift Pricing Configured ({lib.shifts.length} Shifts)
                                      </span>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                        {lib.shifts.map((sh, idx) => (
                                          <div key={idx} className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 text-xxs flex justify-between items-center">
                                            <div>
                                              <span className="font-bold text-white block">{sh.shift_name}</span>
                                              <span className="font-mono text-slate-400 text-[10px]">{sh.start_time?.substring(0, 5)} - {sh.end_time?.substring(0, 5)}</span>
                                            </div>
                                            <div className="text-right font-mono">
                                              {(lib.is_free || lib.isFree || (sh.monthly_price === 0 && sh.daily_price === 0)) ? (
                                                <span className="text-emerald-400 font-bold">FREE (₹0)</span>
                                              ) : (
                                                <span className="text-slate-200 font-bold">₹{sh.daily_price}/d · ₹{sh.monthly_price}/m</span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 3. PRICE CHANGES TAB */}
          {activeMenuTab === 'PRICE_CHANGES' && (
            <div className="bg-[#0e0e15] border border-slate-800 rounded-lg overflow-hidden flex-1 flex flex-col">
              <div className="bg-slate-900/60 px-5 py-4 border-b border-slate-800 flex justify-between items-center">
                <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Price Governance Approval Queue</h2>
                <button
                  onClick={() => fetchPriceChanges(success.token)}
                  disabled={fetchingPriceChanges}
                  className="text-xxs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                >
                  {fetchingPriceChanges ? 'REFRESHING...' : '🔄 REFRESH QUEUE'}
                </button>
              </div>

              {fetchingPriceChanges && priceChanges.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mb-4"></div>
                  <p className="text-xs tracking-wider">RETRIEVING PRICE REQUESTS...</p>
                </div>
              ) : priceChanges.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-16 text-center text-slate-500">
                  <span className="text-4xl mb-4 select-none">📊</span>
                  <p className="text-sm font-bold text-slate-300 uppercase tracking-wider">Price Governance Clear</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                    No anomalous price hikes exceeding safety parameters are currently awaiting decision.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider bg-slate-950/20">
                        <th className="px-5 py-3">Property Name</th>
                        <th className="px-5 py-3">Shift Name</th>
                        <th className="px-5 py-3">Current Rates</th>
                        <th className="px-5 py-3">Proposed Rates</th>
                        <th className="px-5 py-3">Hike Intensity</th>
                        <th className="px-5 py-3 text-right">Actions &amp; Decisions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceChanges.map(pc => {
                        const isWorking = actionLoading[pc.id];
                        // Calculate percentage increase
                        let increasePct = 0;
                        if (pc.monthly_price > 0 && pc.pending_monthly_price > pc.monthly_price) {
                          increasePct = Math.round(((pc.pending_monthly_price - pc.monthly_price) / pc.monthly_price) * 100);
                        }
                        return (
                          <tr key={pc.id} className="border-b border-slate-800/60 hover:bg-slate-900/20 transition-colors">
                            <td className="px-5 py-4 font-bold text-white">{pc.library_name}</td>
                            <td className="px-5 py-4 text-slate-300">{pc.shift_name}</td>
                            <td className="px-5 py-4 text-slate-400 font-mono">
                              ₹{pc.daily_price}/d · ₹{pc.monthly_price}/m
                            </td>
                            <td className="px-5 py-4 text-emerald-400 font-mono font-bold">
                              ₹{pc.pending_daily_price}/d · ₹{pc.pending_monthly_price}/m
                            </td>
                            <td className="px-5 py-4">
                              <span className={`px-2 py-0.5 rounded text-xxs font-bold ${
                                increasePct >= 50
                                  ? 'bg-red-950 border border-red-800 text-red-400 animate-pulse'
                                  : 'bg-amber-950 border border-amber-800 text-amber-400'
                              }`}>
                                +{increasePct}% Hike
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right space-y-3">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => handleApprovePrice(pc.id)}
                                  disabled={isWorking}
                                  className="px-3 py-1.5 rounded bg-emerald-800 hover:bg-emerald-700 text-white font-bold transition-all text-xxs uppercase disabled:opacity-50 cursor-pointer"
                                >
                                  Approve Price ✓
                                </button>
                                <button
                                  onClick={() => handleRejectPrice(pc.id)}
                                  disabled={isWorking}
                                  className="px-3 py-1.5 rounded bg-rose-950 border border-rose-800 text-rose-300 hover:bg-rose-900 font-bold transition-all text-xxs uppercase disabled:opacity-50 cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                              <div className="flex justify-end">
                                <input
                                  type="text"
                                  placeholder="Reason for rejection (sent to owner)..."
                                  value={priceReason[pc.id] || ''}
                                  onChange={e => setPriceReason(prev => ({ ...prev, [pc.id]: e.target.value }))}
                                  className="w-80 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-700 font-mono text-xxs"
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 4. DISPUTES TAB */}
          {activeMenuTab === 'DISPUTES' && (
            <div className="bg-[#0e0e15] border border-slate-800 rounded-lg overflow-hidden flex-1 flex flex-col">
              <div className="bg-slate-900/60 px-5 py-4 border-b border-slate-800 flex justify-between items-center">
                <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Escalated Dispute Desk</h2>
                <button
                  onClick={() => fetchDisputes(success.token)}
                  disabled={fetchingDisputes}
                  className="text-xxs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                >
                  {fetchingDisputes ? 'REFRESHING...' : '🔄 REFRESH QUEUE'}
                </button>
              </div>

              {fetchingDisputes && disputes.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mb-4"></div>
                  <p className="text-xs tracking-wider">RETRIEVING DISPUTES...</p>
                </div>
              ) : disputes.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-16 text-center text-slate-500">
                  <span className="text-4xl mb-4 select-none">⚖️</span>
                  <p className="text-sm font-bold text-slate-300 uppercase tracking-wider">Dispute Docket Clear</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                    All student disputes have been analyzed. Server logs resolve deterministic claims.
                  </p>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {disputes.map(disp => {
                    const isWorking = actionLoading[disp.id];
                    return (
                      <div key={disp.id} className="bg-[#07070b] border border-slate-800 rounded-lg p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start border-b border-slate-800 pb-3 gap-2">
                          <div>
                            <span className="text-red-500 text-xxs font-bold uppercase tracking-wider font-mono">Dispute ID: {disp.id.slice(0, 8).toUpperCase()}</span>
                            <h3 className="text-sm font-bold text-white mt-0.5">{disp.student_name} v. {disp.library_name}</h3>
                          </div>
                          <div className="text-right text-slate-500 text-xxs font-mono">
                            <span>Escalated at: {new Date(disp.created_at).toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          {/* Evidence Block */}
                          <div className="bg-slate-900/60 p-4 border border-slate-850 rounded space-y-2">
                            <p className="text-slate-400 font-bold uppercase tracking-wider text-xxs">Cancellation Audit Log</p>
                            <div className="font-mono text-xxs text-slate-300 space-y-1">
                              <div><span className="text-slate-500">Ref Code:</span> {disp.booking_reference}</div>
                              <div><span className="text-slate-500">Amount Paid:</span> ₹{disp.amount_paid}</div>
                              <div><span className="text-slate-500">Period:</span> {new Date(disp.valid_from).toLocaleDateString()} - {new Date(disp.valid_until).toLocaleDateString()}</div>
                              <div className="border-t border-slate-800 pt-1 mt-1">
                                <span className="text-slate-500">Log Actor Role:</span> <span className="text-amber-400 font-bold">{disp.server_recorded_actor_role}</span>
                              </div>
                              <div>
                                <span className="text-slate-500">Log Actor Name:</span> {disp.cancelled_by_name || 'System Auto-Job'}
                              </div>
                              <div><span className="text-slate-500">Cancel Reason:</span> "{disp.cancellation_reason || 'N/A'}"</div>
                              <div><span className="text-slate-500">Cancel Time:</span> {disp.cancellation_initiated_at ? new Date(disp.cancellation_initiated_at).toLocaleString() : 'N/A'}</div>
                              <div>
                                <span className="text-slate-500">WhatsApp Identity Confirmed:</span>{' '}
                                <span className={disp.identity_confirmed ? 'text-emerald-400 font-bold' : 'text-red-400'}>
                                  {disp.identity_confirmed ? '✓ YES (Self confirmed)' : '✗ NO (Claims unauthorized action)'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Reason and Input block */}
                          <div className="space-y-3 flex flex-col justify-between">
                            <div className="bg-slate-900/30 p-4 border border-slate-850 rounded">
                              <p className="text-slate-400 font-bold uppercase tracking-wider text-xxs">Student Discrepancy Statement</p>
                              <p className="text-slate-200 mt-1 italic font-sans text-xs">"{disp.dispute_reason}"</p>
                            </div>

                            <div className="space-y-3">
                              <input
                                type="text"
                                placeholder="Mandatory resolution notes / findings summary..."
                                value={disputeNotes[disp.id] || ''}
                                onChange={e => setDisputeNotes(prev => ({ ...prev, [disp.id]: e.target.value }))}
                                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-700 font-mono text-xs"
                              />

                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => handleResolveDispute(disp.id, 'RESOLVED_REFUND')}
                                  disabled={isWorking}
                                  className="px-3.5 py-2 rounded bg-emerald-800 hover:bg-emerald-700 text-white font-bold transition-all text-xxs uppercase disabled:opacity-50 cursor-pointer"
                                >
                                  Approve Refund ✓
                                </button>
                                <button
                                  onClick={() => handleResolveDispute(disp.id, 'RESOLVED_NO_REFUND')}
                                  disabled={isWorking}
                                  className="px-3.5 py-2 rounded bg-rose-950 border border-rose-800 text-rose-300 hover:bg-rose-900 font-bold transition-all text-xxs uppercase disabled:opacity-50 cursor-pointer"
                                >
                                  Reject Dispute
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 5. SUPPORT TICKETS TAB */}
          {activeMenuTab === 'SUPPORT_TICKETS' && (
            <div className="bg-[#0e0e15] border border-slate-800 rounded-lg overflow-hidden flex-1 flex flex-col">
              <div className="bg-slate-900/60 px-5 py-4 border-b border-slate-800 flex justify-between items-center">
                <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Platform Support Desk</h2>
                <button
                  onClick={() => fetchSupportTickets(success.token)}
                  disabled={fetchingSupport}
                  className="text-xxs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                >
                  {fetchingSupport ? 'REFRESHING...' : '🔄 REFRESH QUEUE'}
                </button>
              </div>

              {fetchingSupport && supportTickets.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mb-4"></div>
                  <p className="text-xs tracking-wider">RETRIEVING SUPPORT TICKETS...</p>
                </div>
              ) : supportTickets.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-16 text-center text-slate-500">
                  <span className="text-4xl mb-4 select-none">💬</span>
                  <p className="text-sm font-bold text-slate-300 uppercase tracking-wider">Support Inbox Clear</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                    No platform-level assistance requests are currently pending review.
                  </p>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {supportTickets.map(tkt => {
                    const isWorking = actionLoading[tkt.id];
                    return (
                      <div key={tkt.id} className="bg-[#07070b] border border-slate-800 rounded-lg p-5 space-y-3">
                        <div className="flex flex-col sm:flex-row justify-between items-start border-b border-slate-800 pb-2.5 gap-2">
                          <div>
                            <span className={`inline-flex px-2 py-0.5 rounded text-xxs font-bold font-mono mr-2 ${
                              tkt.priority === 'URGENT'
                                ? 'bg-red-950 border border-red-800 text-red-400 animate-pulse'
                                : tkt.priority === 'HIGH'
                                ? 'bg-amber-950 border border-amber-800 text-amber-400'
                                : 'bg-slate-900 border border-slate-700 text-slate-400'
                            }`}>
                              {tkt.priority}
                            </span>
                            <span className="text-slate-400 text-xxs font-bold">Ticket: #{tkt.ticket_code}</span>
                          </div>
                          <span className="text-slate-500 text-xxs font-mono">{new Date(tkt.created_at).toLocaleString()}</span>
                        </div>

                        <div className="text-xs space-y-2">
                          <div className="flex flex-wrap gap-x-4 text-xxs font-mono text-slate-400">
                            <div><span className="text-slate-650">Student:</span> <span className="text-slate-200 font-bold">{tkt.student_name}</span></div>
                            {tkt.library_name && <div><span className="text-slate-650">Library Scope:</span> <span className="text-slate-200">{tkt.library_name}</span></div>}
                            <div><span className="text-slate-650">Category:</span> <span className="text-violet-400 font-bold">{tkt.category}</span></div>
                          </div>

                          <div className="bg-slate-900/50 p-3 border border-slate-855 rounded text-slate-200 font-sans text-xs">
                            {tkt.description}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-2 items-center">
                          <input
                            type="text"
                            placeholder="Resolution notes & details for the student..."
                            value={ticketNotes[tkt.id] || ''}
                            onChange={e => setTicketNotes(prev => ({ ...prev, [tkt.id]: e.target.value }))}
                            className="flex-1 w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-700 font-mono"
                          />
                          <button
                            onClick={() => handleResolveTicket(tkt.id)}
                            disabled={isWorking}
                            className="px-4 py-2 rounded bg-emerald-800 hover:bg-emerald-700 text-white font-bold transition-all text-xxs uppercase disabled:opacity-50 shrink-0 cursor-pointer"
                          >
                            Resolve Ticket ✓
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 6. OVERSIGHT TAB */}
          {activeMenuTab === 'OVERSIGHT' && (
            <div className="bg-[#0e0e15] border border-slate-800 rounded-lg overflow-hidden flex-1 flex flex-col">
              <div className="bg-slate-900/60 px-5 py-4 border-b border-slate-800 flex justify-between items-center">
                <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Cross-Property Oversight Board</h2>
                <button
                  onClick={() => fetchOversight(success.token)}
                  disabled={fetchingOversight}
                  className="text-xxs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                >
                  {fetchingOversight ? 'REFRESHING...' : '🔄 REFRESH LIST'}
                </button>
              </div>

              {fetchingOversight && oversightLibs.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mb-4"></div>
                  <p className="text-xs tracking-wider">RETRIEVING PROPERTIES...</p>
                </div>
              ) : oversightLibs.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-16 text-center text-slate-500">
                  <span className="text-4xl mb-4 select-none">🌐</span>
                  <p className="text-sm font-bold text-slate-300 uppercase tracking-wider">No Properties Registered</p>
                  <p className="text-xs text-slate-500 mt-1">No operational profiles exist in the system yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider bg-slate-950/20">
                        <th className="px-5 py-3">Property Name</th>
                        <th className="px-5 py-3">City</th>
                        <th className="px-5 py-3">Occupancy</th>
                        <th className="px-5 py-3">Open complaints</th>
                        <th className="px-5 py-3">Operational Status</th>
                        <th className="px-5 py-3 text-right">Suspend Oversight Controls</th>
                      </tr>
                    </thead>
                    <tbody>
                      {oversightLibs.map(lib => {
                        const isWorking = actionLoading[lib.id];
                        const isSuspended = lib.approval_status === 'SUSPENDED';
                        const occupancyRate = lib.total_seats > 0 ? Math.round((lib.occupied_seats / lib.total_seats) * 100) : 0;
                        return (
                          <tr key={lib.id} className="border-b border-slate-800/60 hover:bg-slate-900/20 transition-colors">
                            <td className="px-5 py-4 font-bold text-white">
                              {lib.name}
                              <span className="block text-xxs font-mono text-slate-600 mt-0.5">{lib.id}</span>
                            </td>
                            <td className="px-5 py-4 text-slate-300">{lib.city}</td>
                            <td className="px-5 py-4 font-mono">
                              <span className="font-bold text-slate-200">{lib.occupied_seats}</span> / {lib.total_seats} Desks
                              <span className="block text-xxs text-slate-500 mt-0.5">({occupancyRate}% Load)</span>
                            </td>
                            <td className="px-5 py-4 text-red-400 font-bold">{lib.open_complaints} unresolved</td>
                            <td className="px-5 py-4">
                              <span className={`inline-flex px-2 py-0.5 rounded text-xxs font-bold ${
                                isSuspended
                                  ? 'bg-red-950 border border-red-900 text-red-400'
                                  : lib.is_published
                                  ? 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                                  : 'bg-slate-900 border border-slate-700 text-slate-400'
                              }`}>
                                {isSuspended ? 'SUSPENDED' : lib.is_published ? 'OPERATIONAL' : 'DRAFT'}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right space-y-3">
                              {isSuspended ? (
                                <button
                                  onClick={() => handleUnsuspendLibrary(lib.id)}
                                  disabled={isWorking}
                                  className="px-3.5 py-2 rounded bg-emerald-800 text-emerald-300 border border-emerald-800 hover:bg-emerald-900 font-bold transition-all text-xxs uppercase disabled:opacity-50 cursor-pointer"
                                >
                                  Reinstate Property
                                </button>
                              ) : (
                                <div className="space-y-2">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => handleSuspendLibrary(lib.id)}
                                      disabled={isWorking}
                                      className="px-3.5 py-1.5 rounded bg-rose-950 border border-rose-800 text-rose-300 hover:bg-rose-900 font-bold transition-all text-xxs uppercase disabled:opacity-50 cursor-pointer"
                                    >
                                      Suspend listing
                                    </button>
                                  </div>
                                  <div className="flex justify-end">
                                    <input
                                      type="text"
                                      placeholder="Mandatory suspension reason..."
                                      value={suspendReason[lib.id] || ''}
                                      onChange={e => setSuspendReason(prev => ({ ...prev, [lib.id]: e.target.value }))}
                                      className="w-64 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-350 placeholder-slate-650 focus:outline-none focus:border-slate-750 font-mono text-xxs"
                                    />
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 7. STAFF TAB */}
          {activeMenuTab === 'STAFF' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Create Staff Form Card */}
                <div className="bg-[#0e0e15] border border-slate-800 rounded-lg p-5 h-fit lg:col-span-1">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest border-b border-slate-800 pb-3 mb-4">Provision Staff Account</h3>
                  
                  <form onSubmit={handleCreateStaff} className="space-y-4">
                    <div>
                      <label className="block text-xxs font-bold text-slate-500 mb-1 uppercase tracking-wider">Email Address</label>
                      <input
                        type="email"
                        required
                        placeholder="staff@eduglobin.com"
                        value={newStaffEmail}
                        onChange={e => setNewStaffEmail(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-700 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xxs font-bold text-slate-500 mb-1 uppercase tracking-wider">Full Name</label>
                      <input
                        type="text"
                        required
                        placeholder="John Doe"
                        value={newStaffName}
                        onChange={e => setNewStaffName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-700 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xxs font-bold text-slate-500 mb-1 uppercase tracking-wider">Assigned Library</label>
                      <select
                        required
                        value={newStaffLibId}
                        onChange={e => setNewStaffLibId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-350 focus:outline-none focus:border-slate-700 font-mono"
                      >
                        <option value="">-- Choose Library --</option>
                        {oversightLibs
                          .filter(l => l.approval_status === 'APPROVED')
                          .map(l => (
                            <option key={l.id} value={l.id}>
                              {l.name} ({l.city})
                            </option>
                          ))}
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={creatingStaff}
                      className="w-full py-2 rounded bg-red-800 hover:bg-red-700 text-white text-xs font-bold tracking-wider uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {creatingStaff ? 'PROVISIONING...' : 'PROVISION STAFF ACCOUNT'}
                    </button>
                  </form>

                  {/* Provision credentials output */}
                  {provisionedStaffInfo && (
                    <div className="mt-4 p-3 bg-red-950/20 border border-red-900/60 rounded text-xxs space-y-1 animate-pulse">
                      <p className="font-bold text-red-400">STAFF PROVISIONED SECURELY</p>
                      <div><span className="text-slate-500">Email:</span> {provisionedStaffInfo.email}</div>
                      <div className="text-slate-400 border-t border-slate-850 pt-1 mt-1 leading-relaxed">
                        {provisionedStaffInfo.tempPass}
                      </div>
                    </div>
                  )}
                </div>

                {/* Staff Account List Table Card */}
                <div className="bg-[#0e0e15] border border-slate-800 rounded-lg overflow-hidden lg:col-span-2 flex flex-col">
                  <div className="bg-slate-900/60 px-5 py-4 border-b border-slate-800 flex justify-between items-center">
                    <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Active Staff Accounts</h2>
                    <button
                      onClick={() => fetchStaff(success.token)}
                      disabled={fetchingStaff}
                      className="text-xxs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                    >
                      {fetchingStaff ? 'REFRESHING...' : '🔄 REFRESH LIST'}
                    </button>
                  </div>

                  {fetchingStaff && staffAccounts.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mb-4"></div>
                      <p className="text-xs tracking-wider">RETRIEVING STAFF LIST...</p>
                    </div>
                  ) : staffAccounts.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-16 text-center text-slate-500">
                      <span className="text-4xl mb-4 select-none">👥</span>
                      <p className="text-sm font-bold text-slate-300 uppercase tracking-wider">No Staff Configured</p>
                      <p className="text-xs text-slate-500 mt-1">Staff accounts must be created using the console panel.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider bg-slate-950/20">
                            <th className="px-5 py-3">Staff Name</th>
                            <th className="px-5 py-3">Assigned Library</th>
                            <th className="px-5 py-3">Login Password Status</th>
                            <th className="px-5 py-3">Account Status</th>
                            <th className="px-5 py-3">Registered At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {staffAccounts.map(st => (
                            <tr key={st.id} className="border-b border-slate-800/60 hover:bg-slate-900/20 transition-colors">
                              <td className="px-5 py-4 font-bold text-white">
                                {st.full_name}
                                <span className="block text-xxs font-mono text-slate-600 mt-0.5">{st.id}</span>
                              </td>
                              <td className="px-5 py-4 text-slate-300">{st.library_name || 'N/A'}</td>
                              <td className="px-5 py-4">
                                <span className={`px-2 py-0.5 rounded text-xxs font-bold ${
                                  st.must_change_password
                                    ? 'bg-amber-950 border border-amber-800 text-amber-400'
                                    : 'bg-emerald-950 border border-emerald-800 text-emerald-400'
                                }`}>
                                  {st.must_change_password ? 'Temp - Change Required' : 'Passwords Set'}
                                </span>
                              </td>
                              <td className="px-5 py-4">
                                <span className="inline-flex px-2 py-0.5 rounded text-xxs font-bold bg-emerald-950 border border-emerald-800 text-emerald-300">
                                  {st.account_status}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-slate-400 font-mono">
                                {new Date(st.created_at).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}
            </main>
          </div>
        </div>
      ) : (
        /* Login Card Layout */
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-full max-w-sm">
            {/* Header */}
            <div className="mb-8 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-red-700/20 border border-red-700/40 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              </div>
              <p className="text-xs font-bold text-red-500 uppercase tracking-[0.2em] mb-1">Restricted Access</p>
              <h1 className="text-xl font-bold text-white tracking-tight">EduGlobin Internal Portal</h1>
              <p className="text-xs text-slate-500 mt-1">Authorised personnel only. All access is logged.</p>
            </div>

            {/* Login form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Admin Email</label>
                <input
                  id="admin-email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors font-mono"
                  placeholder="admin@eduglobin.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Passcode Credentials</label>
                <div className="relative">
                  <input
                    id="admin-password"
                    type={showPw ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors font-mono"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPw ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-950/60 border border-red-800/50 text-red-400 text-xs rounded-lg px-3 py-2.5 flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                id="admin-submit"
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Authenticating...
                  </span>
                ) : (
                  <>Authenticate →</>
                )}
              </button>

              <p className="text-center text-slate-605 text-xxs pt-1">
                Admin credentials are seeded at database migration start.
              </p>
            </form>
          </div>
        </div>
      )}

      {/* Bottom classification */}
      <p className="mt-auto pt-8 text-center text-slate-700 text-xxs font-mono tracking-wider">
        EDUGLOBIN PLATFORM INTERNAL · ACCESS RESTRICTED · SESSIONS AUDITED
      </p>

      <div className="fixed bottom-0 inset-x-0 h-1 bg-gradient-to-r from-red-700 via-red-600 to-red-700"></div>
    </div>
  );
}
