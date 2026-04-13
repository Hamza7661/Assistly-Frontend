'use client';

import { useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useApp } from '@/contexts/AppContext';
import { useLeadService } from '@/services';
import type { Lead } from '@/models/Lead';
import AppSelector from './AppSelector';
import Logo from './Logo';
import Sidebar from './Sidebar';
import { 
  Menu, 
  X, 
  LogOut, 
  User,
  Bell,
  CheckCheck,
  Funnel,
  FunnelX,
  Globe,
  Camera,
  Phone,
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function Navigation() {
  const PAGE_SIZE = 15;
  const READ_DISPLAY_LIMIT = 15;
  const { user, logout } = useAuth();
  const { currentApp } = useApp();
  const { isOpen: isSidebarOpen, toggle: toggleSidebar } = useSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Lead[]>([]);
  const [notificationPage, setNotificationPage] = useState(0);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(true);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [readLeadMap, setReadLeadMap] = useState<Record<string, string>>({});
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const bellMenuRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<any>(null);
  const pendingReadIdsRef = useRef<Set<string>>(new Set());
  const flushReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogout = () => {
    logout();
    router.push('/signin');
  };

  const handleNavigation = (href: string) => {
    router.push(href);
    setIsMobileMenuOpen(false);
    setIsMobileSidebarOpen(false);
  };

  const leadIdentityKey = (lead?: Lead | null) => {
    if (!lead) return '';
    if (lead._id) return `id:${lead._id}`;
    if (lead.createdAt) return `created:${lead.createdAt}`;
    if (lead.leadDateTime) return `leadDate:${lead.leadDateTime}`;
    const email = (lead.leadEmail || '').trim().toLowerCase();
    const phone = (lead.leadPhoneNumber || '').trim();
    const channel = (lead.sourceChannel || '').trim().toLowerCase();
    return `fp:${email}|${phone}|${channel}`;
  };

  const leadReadKeys = (lead?: Lead | null) => {
    if (!lead) return [];
    const keys = new Set<string>();
    if (lead._id) keys.add(`id:${lead._id}`);
    const primary = leadIdentityKey(lead);
    if (primary) keys.add(primary);
    return Array.from(keys);
  };

  const syncReadState = async (leadIds: string[]) => {
    if (!currentApp?.id || leadIds.length === 0) return;
    try {
      const svc = await useLeadService();
      const res = await svc.getReadStateByApp(currentApp.id, leadIds);
      const reads = res.data?.reads || {};
      setReadLeadMap((prev) => {
        const next = { ...prev };
        Object.entries(reads).forEach(([leadId, readAt]) => {
          next[`id:${leadId}`] = String(readAt);
        });
        return next;
      });
    } catch (e) {
      console.error('Failed to sync read state:', e);
    }
  };

  const fetchReadStateMap = async (leadIds: string[]) => {
    if (!currentApp?.id || leadIds.length === 0) return {} as Record<string, string>;
    try {
      const svc = await useLeadService();
      const res = await svc.getReadStateByApp(currentApp.id, leadIds);
      const reads = res.data?.reads || {};
      const next: Record<string, string> = {};
      Object.entries(reads).forEach(([leadId, readAt]) => {
        next[`id:${leadId}`] = String(readAt);
      });
      return next;
    } catch (e) {
      console.error('Failed to fetch read state map:', e);
      return {};
    }
  };

  const flushPendingReadIds = async () => {
    if (!currentApp?.id) return;
    const ids = Array.from(pendingReadIdsRef.current);
    if (ids.length === 0) return;
    pendingReadIdsRef.current.clear();
    try {
      const svc = await useLeadService();
      await svc.markReadByApp(currentApp.id, ids);
    } catch (e) {
      console.error('Failed to persist read state:', e);
      ids.forEach((id) => pendingReadIdsRef.current.add(id));
    }
  };

  const scheduleFlushPendingReads = () => {
    if (flushReadTimerRef.current) return;
    flushReadTimerRef.current = setTimeout(async () => {
      flushReadTimerRef.current = null;
      await flushPendingReadIds();
    }, 350);
  };

  const leadTimestamp = (lead?: Lead | null) => {
    const raw = lead?.leadDateTime || lead?.createdAt || lead?.updatedAt;
    if (!raw) return 0;
    const parsed = new Date(raw).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const upsertLeads = (base: Lead[], incoming: Lead[]) => {
    const map = new Map<string, Lead>();
    [...incoming, ...base].forEach((lead) => {
      const key = leadIdentityKey(lead);
      if (!key) return;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, lead);
        return;
      }
      const next =
        leadTimestamp(lead) >= leadTimestamp(existing)
          ? { ...existing, ...lead }
          : { ...lead, ...existing };
      map.set(key, next);
    });
    return Array.from(map.values()).sort((a, b) => leadTimestamp(b) - leadTimestamp(a));
  };

  const isLeadRead = (lead: Lead) => {
    const keys = leadReadKeys(lead);
    return keys.some((key) => !!readLeadMap[key]);
  };

  const markLeadAsRead = (lead: Lead) => {
    const keys = leadReadKeys(lead);
    if (keys.length === 0) return;
    const now = new Date().toISOString();
    setReadLeadMap((prev) => ({ ...prev, ...Object.fromEntries(keys.map((key) => [key, now])) }));
    if (lead._id) {
      pendingReadIdsRef.current.add(lead._id);
      scheduleFlushPendingReads();
    }
  };

  const markAllAsRead = () => {
    const now = new Date().toISOString();
    const idsToMark = new Set<string>();
    setReadLeadMap((prev) => {
      const next = { ...prev };
      notifications.forEach((lead) => {
        leadReadKeys(lead).forEach((key) => {
          next[key] = now;
        });
        if (lead._id) idsToMark.add(lead._id);
      });
      return next;
    });
    idsToMark.forEach((id) => pendingReadIdsRef.current.add(id));
    scheduleFlushPendingReads();
  };

  const handleNotificationClick = (lead: Lead) => {
    markLeadAsRead(lead);
    setIsNotificationOpen(false);

    if (typeof window !== 'undefined') {
      const payload = {
        leadId: lead._id || null,
        lead,
        ts: Date.now(),
      };
      if (pathname === '/leads') {
        sessionStorage.removeItem('assistly:pendingLeadOpen');
        window.dispatchEvent(new CustomEvent('assistly:open-lead-detail', { detail: payload }));
        return;
      }
      sessionStorage.setItem('assistly:pendingLeadOpen', JSON.stringify(payload));
    }

    router.push('/leads');
  };

  const visibleNotifications = useMemo(() => {
    const unread = notifications.filter((lead) => !isLeadRead(lead));
    const read = notifications.filter((lead) => isLeadRead(lead));
    if (showUnreadOnly) return unread;
    return [...unread, ...read.slice(0, READ_DISPLAY_LIMIT)];
  }, [notifications, readLeadMap, showUnreadOnly]);

  const unreadCount = useMemo(
    () => notifications.filter((lead) => !isLeadRead(lead)).length,
    [notifications, readLeadMap]
  );

  const leadStatusPillClass = (status?: Lead['status']) => {
    if (status === 'confirmed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'complete') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (status === 'in_progress' || status === 'interacting') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-gray-50 text-gray-600 border-gray-200';
  };

  const leadStatusLabel = (status?: Lead['status']) => {
    if (status === 'in_progress') return 'In Progress';
    if (status === 'interacting') return 'Interacting';
    if (status === 'confirmed') return 'Confirmed';
    if (status === 'complete') return 'Completed';
    return 'Unknown';
  };

  const channelLabel = (source?: string) => {
    const s = (source || '').trim().toLowerCase();
    if (!s) return 'Unknown';
    if (s === 'web') return 'Web';
    if (s === 'whatsapp') return 'WhatsApp';
    if (s === 'instagram') return 'Instagram';
    if (s === 'facebook' || s === 'messenger') return 'Facebook';
    if (s === 'voice') return 'Voice';
    return s;
  };

  const channelIcon = (source?: string) => {
    const s = (source || '').trim().toLowerCase();
    if (s === 'facebook' || s === 'messenger') {
      return (
        <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" aria-hidden="true">
          <path d="M24 12a12 12 0 10-13.88 11.86v-8.39H7.08V12h3.04V9.36c0-3 1.79-4.66 4.53-4.66 1.31 0 2.68.23 2.68.23v2.95h-1.5c-1.48 0-1.94.92-1.94 1.86V12h3.3l-.53 3.47h-2.77v8.39A12 12 0 0024 12z" />
        </svg>
      );
    }
    if (s === 'instagram') return <Camera className="h-3 w-3" aria-hidden />;
    if (s === 'whatsapp') return <Phone className="h-3 w-3" aria-hidden />;
    if (s === 'web') return <Globe className="h-3 w-3" aria-hidden />;
    if (s === 'voice') return <Phone className="h-3 w-3" aria-hidden />;
    return <Globe className="h-3 w-3" aria-hidden />;
  };

  const channelPillClass = (source?: string) => {
    const s = (source || '').trim().toLowerCase();
    if (s === 'facebook' || s === 'messenger') return 'border-blue-200 bg-blue-50 text-blue-700';
    if (s === 'instagram') return 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700';
    if (s === 'whatsapp') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (s === 'voice') return 'border-amber-200 bg-amber-50 text-amber-700';
    if (s === 'web') return 'border-slate-200 bg-slate-100 text-slate-700';
    return 'border-gray-200 bg-gray-50 text-gray-700';
  };

  const loadNotifications = async (targetPage: number, append: boolean) => {
    if (!currentApp?.id || loadingNotifications) return;
    setLoadingNotifications(true);
    try {
      const svc = await useLeadService();
      const res = await svc.listByApp(currentApp.id, {
        page: targetPage,
        limit: PAGE_SIZE,
        sortBy: 'leadDateTime',
        sortOrder: 'desc',
      });
      const leads = res.data?.leads || [];
      const totalPages = res.data?.pagination?.totalPages;
      const leadIds = leads.map((lead: Lead) => lead._id).filter((id: string | undefined): id is string => !!id);
      const readMapForPage = await fetchReadStateMap(leadIds);
      if (Object.keys(readMapForPage).length > 0) {
        setReadLeadMap((prev) => ({ ...prev, ...readMapForPage }));
      }
      setNotifications((prev) => (append ? upsertLeads(prev, leads) : upsertLeads([], leads)));
      setNotificationPage(targetPage);
      if (typeof totalPages === 'number') {
        setHasMoreNotifications(targetPage < totalPages);
      } else {
        setHasMoreNotifications(leads.length === PAGE_SIZE);
      }
    } catch (e) {
      console.error('Failed to load lead notifications:', e);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const handleNotificationScroll = (e: UIEvent<HTMLDivElement>) => {
    if (!hasMoreNotifications || loadingNotifications) return;
    const target = e.currentTarget;
    const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 40;
    if (nearBottom) {
      loadNotifications(notificationPage + 1, true);
    }
  };

  // Close menus on outside click
  useEffect(() => {
    if (!isUserMenuOpen && !isNotificationOpen) return;
    const handler = (e: MouseEvent) => {
      const node = e.target as Node;
      if (userMenuRef.current && !userMenuRef.current.contains(node)) {
        setIsUserMenuOpen(false);
      }
      if (bellMenuRef.current && !bellMenuRef.current.contains(node)) {
        setIsNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isUserMenuOpen, isNotificationOpen]);

  useEffect(() => {
    setReadLeadMap({});
  }, [currentApp?.id, user?._id]);

  useEffect(() => {
    if (!currentApp?.id) {
      setNotifications([]);
      setNotificationPage(0);
      setHasMoreNotifications(true);
      return;
    }
    // Preload notifications so bell count is correct without opening the menu.
    void loadNotifications(1, false);
    let isCancelled = false;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const baseUrl = apiUrl.replace('/api/v1', '');

    import('socket.io-client')
      .then(({ io }) => {
        if (isCancelled) return;
        const socket = io(baseUrl);
        wsRef.current = socket;
        socket.on('connect', () => {
          if (user?._id) socket.emit('join', user._id);
        });
        socket.on('new_lead', (data) => {
          const incoming = data?.lead as Lead | undefined;
          if (!incoming) return;
          // Ignore leads for other apps to keep unread count app-scoped.
          if (incoming.appId && String(incoming.appId) !== String(currentApp.id)) return;
          setNotifications((prev) => upsertLeads(prev, [incoming]));
        });
      })
      .catch((error) => {
        console.error('Failed to initialize notification socket:', error);
      });

    return () => {
      isCancelled = true;
      if (flushReadTimerRef.current) {
        clearTimeout(flushReadTimerRef.current);
        flushReadTimerRef.current = null;
      }
      void flushPendingReadIds();
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
    };
  }, [currentApp?.id, user?._id]);

  return (
    <>
      {/* Top Bar with App Selector */}
      <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-40">
        {/* Row 1: Logo + toggles + user menu (h-16) */}
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left: Logo and Sidebar Toggle */}
            <div className="flex items-center">
              {/* Desktop sidebar toggle */}
              <button
                onClick={toggleSidebar}
                className="hidden lg:flex p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md mr-3"
                aria-label="Toggle sidebar"
              >
                {isSidebarOpen ? (
                  <ChevronLeft className="h-6 w-6" />
                ) : (
                  <ChevronRight className="h-6 w-6" />
                )}
              </button>
              
              {/* Mobile sidebar toggle */}
              <button
                onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
                className="lg:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md mr-3"
              >
                {isMobileSidebarOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
              
              <div 
                onClick={() => handleNavigation('/dashboard')}
                className="cursor-pointer hover:opacity-80 transition-opacity flex items-center"
              >
                <Logo width={150} height={50} className="w-auto h-auto" />
              </div>
            </div>

            {/* Center: App Selector (Desktop only) */}
            <div className="hidden lg:flex items-center flex-1 justify-center px-4">
              <AppSelector />
            </div>

            {/* Right: Notifications + User Menu */}
            <div className="flex items-center gap-2">
              <div className="relative" ref={bellMenuRef}>
                <button
                  onClick={() => {
                    const next = !isNotificationOpen;
                    setIsNotificationOpen(next);
                    if (next && notifications.length === 0 && !loadingNotifications) {
                      loadNotifications(1, false);
                    }
                  }}
                  className="relative inline-flex items-center justify-center h-9 w-9 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
                  aria-label="Lead activity notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#c01721] text-white text-[10px] leading-[18px] text-center font-semibold">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {isNotificationOpen && (
                  <div className="absolute right-0 mt-2 w-[360px] max-w-[90vw] bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">Lead Activity</p>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setShowUnreadOnly((prev) => !prev)}
                          title={showUnreadOnly ? 'Show all activity' : 'Show unread only'}
                          aria-label={showUnreadOnly ? 'Show all activity' : 'Show unread only'}
                          className={`inline-flex items-center justify-center h-7 w-7 rounded-full border ${
                            showUnreadOnly
                              ? 'text-[#c01721] border-[#c01721]/30 bg-[#c01721]/10'
                              : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {showUnreadOnly ? <FunnelX className="h-3.5 w-3.5" /> : <Funnel className="h-3.5 w-3.5" />}
                        </button>
                        <p className="text-xs text-gray-500">
                          {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                        </p>
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            title="Mark all as read"
                            aria-label="Mark all as read"
                            className="inline-flex items-center justify-center h-7 w-7 rounded-full border border-[#c01721]/25 text-[#c01721] hover:bg-[#c01721]/10"
                          >
                            <CheckCheck className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="max-h-96 overflow-y-auto" onScroll={handleNotificationScroll}>
                      {loadingNotifications && visibleNotifications.length === 0 && (
                        <div className="px-3 py-2 space-y-2" aria-hidden="true">
                          {[0, 1, 2].map((idx) => (
                            <div
                              key={`notif-skeleton-${idx}`}
                              className="rounded-md border border-gray-100 p-2.5 animate-pulse"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="h-3.5 w-32 bg-gray-200 rounded" />
                                <div className="h-4 w-12 bg-gray-200 rounded-full" />
                              </div>
                              <div className="mt-2 h-3 w-48 bg-gray-200 rounded" />
                              <div className="mt-2 h-2.5 w-24 bg-gray-100 rounded" />
                            </div>
                          ))}
                        </div>
                      )}

                      {visibleNotifications.length === 0 && !loadingNotifications && (
                        <p className="px-3 py-6 text-sm text-gray-500 text-center">No activity yet</p>
                      )}

                      {visibleNotifications.map((lead) => {
                        const isRead = isLeadRead(lead);
                        const when = lead.leadDateTime || lead.createdAt;
                        return (
                          <button
                            key={leadIdentityKey(lead)}
                            onClick={() => handleNotificationClick(lead)}
                            className={`w-full text-left px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors border-l-4 ${
                              isRead
                                ? 'bg-white border-l-transparent'
                                : 'bg-[#c01721]/10 border-l-[#c01721]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm truncate ${isRead ? 'text-gray-600' : 'text-gray-900 font-semibold'}`}>
                                {(lead.leadName || 'Anonymous Visitor').trim() || 'Anonymous Visitor'}
                              </p>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full border whitespace-nowrap ${
                                  isRead
                                    ? 'text-gray-500 border-gray-200 bg-gray-50'
                                    : 'text-[#c01721] border-[#c01721]/25 bg-[#c01721]/10'
                                }`}
                              >
                                {isRead ? 'Read' : 'Unread'}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border whitespace-nowrap ${leadStatusPillClass(lead.status)}`}>
                                {leadStatusLabel(lead.status)}
                              </span>
                              <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border whitespace-nowrap ${channelPillClass(lead.sourceChannel)}`}>
                                {channelIcon(lead.sourceChannel)}
                                {channelLabel(lead.sourceChannel)}
                              </span>
                              <p className={`text-xs truncate ${isRead ? 'text-gray-500' : 'text-gray-700'}`}>
                                {lead.title || lead.summary || 'New lead activity'}
                              </p>
                            </div>
                            <p className={`text-[11px] mt-1 ${isRead ? 'text-gray-400' : 'text-[#c01721]'}`}>
                              {when ? new Date(when).toLocaleString() : 'Just now'}
                            </p>
                          </button>
                        );
                      })}

                      {loadingNotifications && visibleNotifications.length > 0 && (
                        <p className="px-3 py-2 text-xs text-gray-500 text-center">Loading more...</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#c01721]"
                >
                  <div className="h-8 w-8 bg-[#c01721] rounded-full flex items-center justify-center mr-2">
                    <span className="text-sm font-bold text-white">
                      {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                    </span>
                  </div>
                  <span className="hidden md:block text-gray-700 font-medium">
                    {user?.firstName} {user?.lastName}
                  </span>
                  <ChevronDown className="hidden md:block h-4 w-4 ml-1 text-gray-400" />
                </button>

                {/* User Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                    <button
                      onClick={() => {
                        handleNavigation('/settings');
                        setIsUserMenuOpen(false);
                      }}
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-[#c01721]/10 hover:text-[#c01721] w-full text-left"
                    >
                      <User className="h-4 w-4 mr-2" />
                      Account Settings
                    </button>
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsUserMenuOpen(false);
                      }}
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-[#c01721]/10 hover:text-[#c01721] w-full text-left"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: App Selector (Mobile only, h-12) */}
        <div className="lg:hidden border-t border-gray-100 px-4 h-12 flex items-center">
          <AppSelector />
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className={`hidden lg:block fixed top-16 bottom-0 z-30 overflow-y-auto overflow-x-hidden bg-white border-r border-gray-200 transition-all duration-300 ease-in-out group ${
        isSidebarOpen ? 'left-0 w-64' : 'left-0 w-16 hover:w-64'
      }`}>
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <>
          <div 
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className="lg:hidden fixed left-0 top-28 bottom-0 z-50 w-64">
            <Sidebar />
          </div>
        </>
      )}
    </>
  );
}
