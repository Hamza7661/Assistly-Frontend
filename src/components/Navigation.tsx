'use client';

import { useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import { useRouter } from 'next/navigation';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Lead[]>([]);
  const [notificationPage, setNotificationPage] = useState(0);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(true);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [readLeadMap, setReadLeadMap] = useState<Record<string, string>>({});
  const [isReadStateHydrated, setIsReadStateHydrated] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const bellMenuRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<any>(null);

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
    const name = (lead.leadName || '').trim().toLowerCase();
    return `fp:${email}|${phone}|${name}`;
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
    const key = leadIdentityKey(lead);
    return !!(key && readLeadMap[key]);
  };

  const markLeadAsRead = (lead: Lead) => {
    const key = leadIdentityKey(lead);
    if (!key) return;
    setReadLeadMap((prev) => ({
      ...prev,
      [key]: new Date().toISOString(),
    }));
  };

  const markAllAsRead = () => {
    const now = new Date().toISOString();
    setReadLeadMap((prev) => {
      const next = { ...prev };
      notifications.forEach((lead) => {
        const key = leadIdentityKey(lead);
        if (key) next[key] = now;
      });
      return next;
    });
  };

  const handleNotificationClick = (lead: Lead) => {
    markLeadAsRead(lead);
    setIsNotificationOpen(false);
    if (lead._id) {
      router.push(`/leads?leadId=${encodeURIComponent(lead._id)}`);
      return;
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

  const readStorageKey =
    user?._id && currentApp?.id ? `lead-activity-read:${user._id}:${currentApp.id}` : null;

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
    if (!readStorageKey) {
      setReadLeadMap({});
      setIsReadStateHydrated(false);
      return;
    }
    try {
      const raw = localStorage.getItem(readStorageKey);
      setReadLeadMap(raw ? JSON.parse(raw) : {});
    } catch {
      setReadLeadMap({});
    } finally {
      setIsReadStateHydrated(true);
    }
  }, [readStorageKey]);

  useEffect(() => {
    if (!readStorageKey || !isReadStateHydrated) return;
    localStorage.setItem(readStorageKey, JSON.stringify(readLeadMap));
  }, [readStorageKey, isReadStateHydrated, readLeadMap]);

  useEffect(() => {
    if (!currentApp?.id) {
      setNotifications([]);
      setNotificationPage(0);
      setHasMoreNotifications(true);
      return;
    }
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
          setNotifications((prev) => upsertLeads(prev, [incoming]));
        });
      })
      .catch((error) => {
        console.error('Failed to initialize notification socket:', error);
      });

    return () => {
      isCancelled = true;
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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowUnreadOnly((prev) => !prev)}
                          className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                            showUnreadOnly
                              ? 'text-[#c01721] border-[#c01721]/30 bg-[#c01721]/5'
                              : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {showUnreadOnly ? 'Showing unread' : 'Unread only'}
                        </button>
                        <p className="text-xs text-gray-500">
                          {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                        </p>
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="text-xs font-medium text-[#c01721] hover:underline"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="max-h-96 overflow-y-auto" onScroll={handleNotificationScroll}>
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
                            className={`w-full text-left px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 ${
                              isRead ? 'bg-white' : 'bg-blue-50/50'
                            }`}
                          >
                            <p className={`text-sm ${isRead ? 'text-gray-700' : 'text-gray-900 font-medium'}`}>
                              {(lead.leadName || 'Anonymous Visitor').trim() || 'Anonymous Visitor'}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {lead.title || lead.summary || 'New lead activity'}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-1">
                              {when ? new Date(when).toLocaleString() : 'Just now'}
                            </p>
                          </button>
                        );
                      })}

                      {loadingNotifications && (
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
