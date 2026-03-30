'use client';

import React, { useEffect, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Eye, Pencil, Trash2, Bell, X, Globe, Camera } from 'lucide-react';
import { ProtectedRoute, NoAppEmptyState, ConfirmModal } from '@/components';
import Navigation from '@/components/Navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useLeadService, useIntegrationService } from '@/services';
import type { Lead } from '@/models/Lead';
import { toast } from 'react-toastify';

export default function LeadsPage() {
  type SourceTab = 'all' | 'web' | 'whatsapp' | 'instagram' | 'facebook';
  const { user } = useAuth();
  const { currentApp, isLoading: isLoadingApp } = useApp();
  const { isOpen: isSidebarOpen } = useSidebar();
  const [items, setItems] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pageByTab, setPageByTab] = useState<Record<SourceTab, number>>({
    all: 1,
    web: 1,
    whatsapp: 1,
    instagram: 1,
    facebook: 1,
  });
  const [limit, setLimit] = useState(10);
  const [totalByTab, setTotalByTab] = useState<Record<SourceTab, number | null>>({
    all: null,
    web: null,
    whatsapp: null,
    instagram: null,
    facebook: null,
  });

  const [q, setQ] = useState('');
  const [activeSourceTab, setActiveSourceTab] = useState<SourceTab>('all');
  const [leadType] = useState('');
  const [serviceType] = useState('');
  const [sortBy] = useState('leadDateTime');
  const [sortOrder] = useState<'asc' | 'desc'>('desc');

  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<Lead | null>(null);
  const [isSwitchHistoryOpen, setIsSwitchHistoryOpen] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Lead | null>(null);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // WebSocket for real-time updates
  const [wsConnected, setWsConnected] = useState(false);
  const [newLeadNotification, setNewLeadNotification] = useState<Lead | null>(null);
  const wsRef = useRef<any>(null);
  
  // Integration settings for button colors
  const [primaryColor, setPrimaryColor] = useState('#c01721');
  const sourceChannelFilter = activeSourceTab === 'all' ? undefined : activeSourceTab;
  const page = pageByTab[activeSourceTab] || 1;
  const total = totalByTab[activeSourceTab] ?? null;

  // Load integration settings for primary color
  useEffect(() => {
    const loadSettings = async () => {
      if (!currentApp?.id) return;
      try {
        const svc = await useIntegrationService();
        const res = await svc.getSettings(currentApp.id);
        const integration = res.data?.integration;
        if (integration?.primaryColor) {
          setPrimaryColor(integration.primaryColor);
        }
      } catch (e) {
        console.error('Failed to load integration settings:', e);
      }
    };
    loadSettings();
  }, [currentApp?.id]);

  // Load leads data
  useEffect(() => {
    const load = async () => {
      if (!currentApp?.id) return;
      setLoading(true);
      setError('');
      try {
        const svc = await useLeadService();
        const res = await svc.listByApp(currentApp.id, {
          page, limit,
          q: q || undefined,
          sourceChannel: sourceChannelFilter,
          leadType: leadType || undefined,
          serviceType: serviceType || undefined,
          sortBy: sortBy || undefined,
          sortOrder,
        });
        setItems(res.data?.leads || []);
        const totalCount = res.data?.pagination?.total ?? res.data?.count;
        setTotalByTab(prev => ({
          ...prev,
          [activeSourceTab]: typeof totalCount === 'number' ? totalCount : null,
        }));
      } catch (e: any) {
        setError(e?.message || 'Failed to load leads');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentApp?.id, page, limit, q, sourceChannelFilter, leadType, serviceType, sortBy, sortOrder]);

  // Socket.IO connection for real-time lead updates
  useEffect(() => {
    if (!currentApp?.id) return;

    // Connect to same port as API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const baseUrl = apiUrl.replace('/api/v1', '');

    // Import Socket.IO client dynamically
    import('socket.io-client').then(({ io }) => {
      const socket = io(baseUrl);
      wsRef.current = socket;

      socket.on('connect', () => {
        setWsConnected(true);
        console.log('Socket.IO connected for leads updates');
        
        // Join the user room
        if (user?._id) socket.emit('join', user._id);
      });

      socket.on('new_lead', (data) => {
        const newLead = data.lead as Lead;
        
        // Add new lead to the beginning of the list
        setItems(prevItems => [newLead, ...prevItems]);
        
        // Show notification
        setNewLeadNotification(newLead);
        
        // Auto-hide notification after 5 seconds
        setTimeout(() => {
          setNewLeadNotification(null);
        }, 5000);
        
        // Update total count
        setTotalByTab(prev => ({
          ...prev,
          [activeSourceTab]: prev[activeSourceTab] !== null ? (prev[activeSourceTab] as number) + 1 : 1,
        }));
      });

      socket.on('disconnect', () => {
        setWsConnected(false);
        console.log('Socket.IO disconnected for leads updates');
      });

      socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
        setWsConnected(false);
      });

    }).catch((error) => {
      console.error('Failed to load Socket.IO client:', error);
    });

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
    };
  }, [user?._id]);

  // Format inline bullet points (•) so each starts on a new line
  const formatBulletPoints = (str: string) => str.replace(/ • /g, '\n• ');

  // Render text with URLs as clickable links (opens in new tab)
  const renderTextWithLinks = (str: string, keyPrefix: string): React.ReactNode => {
    const formatted = formatBulletPoints(str);
    const urlRegex = /https?:\/\/[^\s]+/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let urlMatch: RegExpExecArray | null;
    while ((urlMatch = urlRegex.exec(formatted)) !== null) {
      if (urlMatch.index > lastIndex) {
        parts.push(formatted.slice(lastIndex, urlMatch.index));
      }
      const rawUrl = urlMatch[0];
      const href = rawUrl.replace(/[.,;?!)]+$/, '');
      parts.push(
        <a
          key={`${keyPrefix}-url-${urlMatch.index}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline break-all hover:text-blue-800"
        >
          {rawUrl}
        </a>
      );
      lastIndex = urlMatch.index + rawUrl.length;
    }
    if (lastIndex < formatted.length) {
      parts.push(formatted.slice(lastIndex));
    }
    if (parts.length === 0) return formatted;
    return <span key={keyPrefix} className="whitespace-pre-wrap">{parts}</span>;
  };

  const renderBotContent = (text: string) => {
    const parts: React.ReactNode[] = [];
    // Updated regex to handle both formats:
    // 1. <button>text</button> (simple format)
    // 2. <button value="something">text</button> (with value attribute)
    const regex = /<button(?:\s+value=["']([^"']*)["'])?>([\s\S]*?)<\/button>/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        const chunk = text.slice(lastIndex, match.index).trim();
        if (chunk) parts.push(renderTextWithLinks(chunk, `t-${lastIndex}`));
      }
      
      // Extract button text and value
      const buttonValue = match[1] || ''; // value attribute
      const buttonText = (match[2] || '').trim(); // text content
      
      if (buttonText) {
        // Use button value if available, otherwise use button text
        const clickValue = buttonValue || buttonText;
        
        parts.push(
          <button
            key={`b-${match.index}`}
            className="block w-full text-left rounded-full text-white text-xs sm:text-sm font-medium px-3 sm:px-3 py-2 sm:py-1.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 active:translate-y-px transition mt-1 whitespace-normal break-words"
            style={{ 
              backgroundColor: primaryColor,
              '--hover-color': primaryColor + 'dd'
            } as React.CSSProperties}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = primaryColor + 'dd';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = primaryColor;
            }}
            disabled
          >
            {buttonText}
          </button>
        );
      }
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < text.length) {
      const rest = text.slice(lastIndex).trim();
      if (rest) parts.push(renderTextWithLinks(rest, `t-${lastIndex}`));
    }
    
    if (parts.length === 0) return renderTextWithLinks(text, 'only');
    return <div className="flex flex-wrap items-start gap-2">{parts}</div>;
  };

  const statusLabel = (status?: string) => {
    if (status === 'complete') return 'Complete';
    if (status === 'in_progress') return 'In Progress';
    return 'Interacting';
  };

  const statusClass = (status?: string) => {
    if (status === 'complete') return 'bg-green-100 text-green-700';
    if (status === 'in_progress') return 'bg-blue-100 text-blue-700';
    return 'bg-yellow-100 text-yellow-700';
  };

  const channelLabel = (source?: string) => {
    if (!source) return 'Unknown';
    if (source === 'web') return 'Web';
    if (source === 'whatsapp') return 'WhatsApp';
    if (source === 'instagram') return 'Instagram';
    if (source === 'facebook' || source === 'messenger') return 'Facebook';
    return source;
  };

  const interactionLabel = (value?: string) => {
    if (!value) return 'Widget Opened';
    return value
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const openView = (lead: Lead) => { setViewItem(lead); setIsViewOpen(true); };
  const closeView = () => { setIsViewOpen(false); setViewItem(null); setIsSwitchHistoryOpen(false); };

  const openEdit = (lead: Lead) => { setEditItem(lead); setIsEditOpen(true); };
  const closeEdit = () => { setIsEditOpen(false); setEditItem(null); };

  const openConfirm = (id: string) => { setDeleteId(id); setIsConfirmOpen(true); };
  const closeConfirm = () => { setIsConfirmOpen(false); setDeleteId(null); };

  const submitEdit = async () => {
    if (!editItem?._id) return;
    setSaving(true);
    setError('');
    try {
      const svc = await useLeadService();
      const payload: Partial<Lead> = {
        title: editItem.title,
        summary: editItem.summary,
        description: editItem.description,
        leadName: editItem.leadName,
        leadPhoneNumber: editItem.leadPhoneNumber,
        leadEmail: editItem.leadEmail,
        leadType: editItem.leadType,
        serviceType: editItem.serviceType,
      };
      await svc.update(editItem._id, payload);
      // reload current page
      const res = await svc.listByApp(currentApp!.id, { page, limit, q: q || undefined, sourceChannel: sourceChannelFilter, leadType: leadType || undefined, serviceType: serviceType || undefined, sortBy: sortBy || undefined, sortOrder });
      setItems(res.data?.leads || []);
      const totalCount = res.data?.pagination?.total ?? res.data?.count;
      setTotalByTab(prev => ({
        ...prev,
        [activeSourceTab]: typeof totalCount === 'number' ? totalCount : prev[activeSourceTab],
      }));
      setIsEditOpen(false);
      setEditItem(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to update lead');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setSaving(true);
    setError('');
    try {
      const svc = await useLeadService();
      await svc.remove(id);
      let targetPage = page;
      if (items.length === 1 && page > 1) targetPage = page - 1;
      const res = currentApp?.id
        ? await svc.listByApp(currentApp.id, { page: targetPage, limit, q: q || undefined, sourceChannel: sourceChannelFilter, leadType: leadType || undefined, serviceType: serviceType || undefined, sortBy: sortBy || undefined, sortOrder })
        : await svc.listByUser(user!._id, { page: targetPage, limit, q: q || undefined, sourceChannel: sourceChannelFilter, leadType: leadType || undefined, serviceType: serviceType || undefined, sortBy: sortBy || undefined, sortOrder });
      setItems(res.data?.leads || []);
      setPageByTab(prev => ({ ...prev, [activeSourceTab]: targetPage }));
      const totalCount = res.data?.pagination?.total ?? res.data?.count;
      setTotalByTab(prev => ({
        ...prev,
        [activeSourceTab]: typeof totalCount === 'number' ? totalCount : prev[activeSourceTab],
      }));
      setIsConfirmOpen(false);
      setDeleteId(null);
      toast.success('Lead deleted successfully');
    } catch (e: any) {
      setError(e?.message || 'Failed to delete lead');
      toast.error(e?.message || 'Failed to delete lead');
    } finally {
      setSaving(false);
    }
  };

  // Show loading spinner while apps are loading
  if (isLoadingApp) {
    return (
      <ProtectedRoute>
        <div className="bg-white min-h-screen">
          <Navigation />
          <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#c01721]"></div>
                <p className="mt-4 text-gray-600">Loading...</p>
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  // Show empty state if no app is selected (after loading completes)
  if (!currentApp || !currentApp.id) {
    return (
      <ProtectedRoute>
        <div className="bg-white min-h-screen">
          <Navigation />
          <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <NoAppEmptyState
                title="View and Manage Your Leads"
                description="Create an app first to start capturing and managing leads from your chatbot. Each app tracks leads independently with industry-specific lead types and categorization."
              />
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="bg-white min-h-screen">
        <Navigation />
        <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
            <p className="text-gray-600">Browse, filter, view, edit or delete your captured leads.</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-4">
            <div className="grid grid-cols-1 gap-3 items-end">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Search</label>
                <input className="w-full border border-gray-300 rounded px-3 py-2" placeholder="e.g. implant" value={q} onChange={(e) => { setPageByTab(prev => ({ ...prev, [activeSourceTab]: 1 })); setQ(e.target.value); }} />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-2 mb-4">
            <div className="flex flex-wrap gap-2">
              {([
                { id: 'all', label: 'All', icon: Globe, iconBg: 'bg-gradient-to-r from-slate-500 to-slate-700' },
                { id: 'web', label: 'Web Chatbot', icon: Globe, iconBg: 'bg-gradient-to-r from-sky-500 to-blue-600' },
                { id: 'whatsapp', label: 'WhatsApp', icon: Globe, iconBg: 'bg-gradient-to-r from-green-500 to-emerald-600' },
                { id: 'instagram', label: 'Instagram', icon: Camera, iconBg: 'bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-400' },
                { id: 'facebook', label: 'Facebook', icon: Globe, iconBg: 'bg-gradient-to-r from-blue-600 to-indigo-700' },
              ] as const).map((tab) => {
                const Icon = tab.icon;
                const active = activeSourceTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs sm:text-sm transition ${
                      active
                        ? 'text-white border-transparent'
                        : 'text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    style={active ? { backgroundColor: primaryColor } : undefined}
                    onClick={() => {
                      setActiveSourceTab(tab.id);
                    }}
                  >
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-white shadow-sm ${tab.iconBg}`}>
                      {tab.id === 'whatsapp' ? (
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                          <path d="M12.02 2a9.94 9.94 0 0 0-8.51 15.11L2 22l5-1.46a9.97 9.97 0 1 0 5.02-18.54Zm0 17.98a7.98 7.98 0 0 1-4.07-1.11l-.29-.17-2.97.87.8-2.89-.19-.3a7.98 7.98 0 1 1 6.72 3.6Z" />
                          <path d="M17.47 14.38c-.27-.13-1.6-.79-1.84-.88-.25-.09-.43-.13-.61.13-.18.25-.7.88-.85 1.06-.16.18-.31.2-.58.07-.27-.13-1.12-.41-2.14-1.31-.79-.7-1.33-1.57-1.48-1.83-.16-.27-.02-.41.11-.54.12-.12.27-.31.4-.47.13-.16.18-.27.27-.45.09-.18.04-.34-.02-.47-.07-.13-.61-1.47-.84-2.01-.22-.53-.44-.45-.61-.46h-.52c-.18 0-.47.07-.71.34-.25.27-.95.93-.95 2.27s.98 2.64 1.11 2.82c.13.18 1.9 2.9 4.6 4.07.64.28 1.14.45 1.53.58.64.2 1.22.17 1.68.1.51-.08 1.6-.65 1.82-1.28.22-.63.22-1.17.16-1.28-.07-.11-.25-.18-.52-.31Z" />
                        </svg>
                      ) : tab.id === 'facebook' ? (
                        <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" aria-hidden="true">
                          <path d="M24 12a12 12 0 10-13.88 11.86v-8.39H7.08V12h3.04V9.36c0-3 1.79-4.66 4.53-4.66 1.31 0 2.68.23 2.68.23v2.95h-1.5c-1.48 0-1.94.92-1.94 1.86V12h3.3l-.53 3.47h-2.77v8.39A12 12 0 0024 12z" />
                        </svg>
                      ) : (
                        <Icon className="h-3 w-3" />
                      )}
                    </span>
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {error && <div className="error-message mb-4">{error}</div>}

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-6 flex items-center justify-center"><div className="loading-spinner"></div></div>
            ) : items.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-sm">No leads found</div>
            ) : (
              <>
                {/* ── Mobile card list ── */}
                <ul className="divide-y divide-gray-100 sm:hidden">
                  {items.map(l => (
                    <li key={l._id} className="p-4 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{l.leadName || 'Anonymous Visitor'}</p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{interactionLabel(l.initialInteraction || l.title || 'Widget Opened')}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusClass(l.status)}`}>{statusLabel(l.status)}</span>
                          {activeSourceTab === 'all' && (
                            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{channelLabel(l.sourceChannel)}</span>
                          )}
                          {l.location?.country && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{l.location.country}</span>
                          )}
                        </div>
                        {l.leadDateTime && (
                          <p className="text-xs text-gray-400 mt-1">{new Date(l.leadDateTime).toLocaleDateString()}</p>
                        )}
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button aria-label="View lead" title="View" className="inline-flex items-center justify-center border border-gray-200 rounded-lg h-8 w-8 text-gray-600 hover:bg-gray-50" onClick={() => openView(l)}>
                          <Eye className="h-4 w-4" />
                        </button>
                        <button aria-label="Edit lead" title="Edit" className="inline-flex items-center justify-center border border-gray-200 rounded-lg h-8 w-8 text-gray-600 hover:bg-gray-50" onClick={() => openEdit(l)}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button aria-label="Delete lead" title="Delete" className="inline-flex items-center justify-center border border-gray-200 rounded-lg h-8 w-8 text-red-400 hover:bg-red-50" onClick={() => openConfirm(l._id!)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* ── Desktop table ── */}
                <table className="hidden sm:table w-full text-sm">
                  <thead>
                    <tr className="text-left border-b bg-gray-50">
                      <th className="px-4 py-3 font-medium text-gray-600">Visitor</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                      {activeSourceTab === 'all' && (
                        <th className="px-4 py-3 font-medium text-gray-600">Channel</th>
                      )}
                      <th className="px-4 py-3 font-medium text-gray-600">Interacted With</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Location</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Date</th>
                      <th className="px-4 py-3 w-32"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(l => (
                      <tr key={l._id} className="border-b last:border-b-0 hover:bg-gray-50/50">
                        <td className="px-4 py-3 max-w-[200px] truncate">{l.leadName || 'Anonymous Visitor'}</td>
                        <td className="px-4 py-3 text-gray-600"><span className={`text-xs px-2 py-0.5 rounded-full ${statusClass(l.status)}`}>{statusLabel(l.status)}</span></td>
                        {activeSourceTab === 'all' && (
                          <td className="px-4 py-3 text-gray-600">{channelLabel(l.sourceChannel)}</td>
                        )}
                        <td className="px-4 py-3 text-gray-600">
                          <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-xs">
                            {interactionLabel(l.initialInteraction || l.title || 'Widget Opened')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{l.location?.country || '-'}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{l.leadDateTime ? new Date(l.leadDateTime).toLocaleString() : '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <button aria-label="View lead" title="View" className="inline-flex items-center justify-center border border-gray-200 rounded-md h-8 w-8 text-gray-600 hover:bg-gray-50" onClick={() => openView(l)}>
                              <Eye className="h-4 w-4" />
                            </button>
                            <button aria-label="Edit lead" title="Edit" className="inline-flex items-center justify-center border border-gray-200 rounded-md h-8 w-8 text-gray-600 hover:bg-gray-50" onClick={() => openEdit(l)}>
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button aria-label="Delete lead" title="Delete" className="inline-flex items-center justify-center border border-gray-200 rounded-md h-8 w-8 text-red-400 hover:bg-red-50" onClick={() => openConfirm(l._id!)}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              Page {page}{total !== null && total >= 0 ? ` of ${Math.max(1, Math.ceil(total / limit))}` : ''}
              {total !== null && <span className="ml-1 text-gray-400">({total} total)</span>}
            </p>
            <div className="flex items-center gap-2">
              <select className="border border-gray-300 rounded-lg px-2 py-1 text-xs h-8" value={limit} onChange={(e) => { setPageByTab(prev => ({ ...prev, [activeSourceTab]: 1 })); setLimit(parseInt(e.target.value, 10)); }}>
                <option value={5}>5 / page</option>
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
              <button aria-label="Previous page" className="inline-flex items-center justify-center border border-gray-300 rounded-lg h-8 w-8 text-gray-700 disabled:opacity-40" disabled={page <= 1 || loading} onClick={() => setPageByTab(prev => ({ ...prev, [activeSourceTab]: Math.max(1, (prev[activeSourceTab] || 1) - 1) }))}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button aria-label="Next page" className="inline-flex items-center justify-center border border-gray-300 rounded-lg h-8 w-8 text-gray-700 disabled:opacity-40" disabled={(total !== null ? page >= Math.max(1, Math.ceil(total / limit)) : items.length < limit) || loading} onClick={() => setPageByTab(prev => ({ ...prev, [activeSourceTab]: (prev[activeSourceTab] || 1) + 1 }))}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {isViewOpen && viewItem && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
              <div className="absolute inset-0 bg-black/30" onClick={closeView}></div>
              <div className="relative bg-white w-full sm:max-w-3xl rounded-t-2xl sm:rounded-xl shadow-lg border border-gray-200 p-4 sm:p-5 max-h-[92vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">Lead details</h2>
                  <button className="text-gray-500" onClick={closeView}>✕</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="text-sm">
                    <div className="text-gray-700 font-medium mb-1">Status</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50"><span className={`text-xs px-2 py-0.5 rounded-full ${statusClass(viewItem.status)}`}>{statusLabel(viewItem.status)}</span></div>
                  </div>
                  <div className="text-sm">
                    <div className="text-gray-700 font-medium mb-1">Location</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50">{viewItem.location?.country || viewItem.location?.countryCode || '-'}</div>
                  </div>
                  <div className="md:col-span-2 text-sm">
                    <div className="text-gray-700 font-medium mb-1">Initial interaction</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50">{viewItem.initialInteraction || '-'}</div>
                  </div>
                  <div className="md:col-span-2 text-sm">
                    <div className="text-gray-700 font-medium mb-1">Clicked items</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50">{viewItem.clickedItems && viewItem.clickedItems.length > 0 ? viewItem.clickedItems.join(' → ') : '-'}</div>
                  </div>
                  {viewItem.appointmentDetails && (
                    <div className="md:col-span-2 text-sm">
                      <div className="text-gray-700 font-medium mb-1">Appointment details</div>
                      <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50">
                        <div>Event: {viewItem.appointmentDetails.eventId || '-'}</div>
                        <div>Start: {viewItem.appointmentDetails.start ? new Date(viewItem.appointmentDetails.start).toLocaleString() : '-'}</div>
                        <div>End: {viewItem.appointmentDetails.end ? new Date(viewItem.appointmentDetails.end).toLocaleString() : '-'}</div>
                        <div>Confirmed: {viewItem.appointmentDetails.confirmed ? 'Yes' : 'No'}</div>
                        {viewItem.appointmentDetails.link && (
                          <a href={viewItem.appointmentDetails.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Open calendar event</a>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="md:col-span-2 text-sm">
                    <div className="text-gray-700 font-medium mb-1">Title</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50">{viewItem.title}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-gray-700 font-medium mb-1">Lead name</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50">{viewItem.leadName || 'Not provided'}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-gray-700 font-medium mb-1">Lead phone</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50">{viewItem.leadPhoneNumber || 'Not provided'}</div>
                  </div>
                  <div className="text-sm md:col-span-2">
                    <div className="text-gray-700 font-medium mb-1">Lead email</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50">{viewItem.leadEmail || 'Not provided'}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-gray-700 font-medium mb-1">Lead type</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50">{viewItem.leadType || '-'}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-gray-700 font-medium mb-1">Service type</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50">{viewItem.serviceType || '-'}</div>
                  </div>
                  <div className="md:col-span-2 text-sm">
                    <div className="text-gray-700 font-medium mb-1">Lead type switch history</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50 flex items-center justify-between gap-3">
                      <span className="text-gray-600">
                        {viewItem.leadTypeSwitchHistory && viewItem.leadTypeSwitchHistory.length > 0
                          ? `${viewItem.leadTypeSwitchHistory.length} switch event(s)`
                          : 'No switch history'}
                      </span>
                      <button
                        type="button"
                        className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => setIsSwitchHistoryOpen(true)}
                        disabled={!viewItem.leadTypeSwitchHistory || viewItem.leadTypeSwitchHistory.length === 0}
                      >
                        View Switch History
                      </button>
                    </div>
                  </div>
                  <div className="text-sm">
                    <div className="text-gray-700 font-medium mb-1">Lead source</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50">{viewItem.sourceChannel || '-'}</div>
                  </div>
                  <div className="md:col-span-2 text-sm">
                    <div className="text-gray-700 font-medium mb-1">Summary</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50 whitespace-pre-wrap">{viewItem.summary || '-'}</div>
                  </div>
                  <div className="md:col-span-2 text-sm">
                    <div className="text-gray-700 font-medium mb-1">Description</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50 whitespace-pre-wrap">{viewItem.description || '-'}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-gray-700 font-medium mb-1">Lead date</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50">{viewItem.leadDateTime ? new Date(viewItem.leadDateTime).toLocaleString() : '-'}</div>
                  </div>
                  {viewItem.history && viewItem.history.length > 0 && (
                    <div className="md:col-span-2 text-sm">
                      <div className="text-gray-700 font-medium mb-2">Conversation History</div>
                      <div className="border border-gray-200 rounded-lg bg-gray-50 p-4 max-h-96 overflow-y-auto pb-6">
                        <div className="space-y-3">
                          {viewItem.history.map((message, index) => (
                            <div
                              key={index}
                              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                                  message.role === 'user'
                                    ? 'text-white'
                                    : 'bg-white text-gray-800 border border-gray-200'
                                }`}
                                style={message.role === 'user' ? { backgroundColor: primaryColor } : {}}
                              >
                                <div className="text-xs font-semibold mb-1 opacity-80">
                                  {message.role === 'user' ? 'Customer' : 'Assistant'}
                                </div>
                                {message.role === 'assistant'
                                  ? renderBotContent(message.content)
                                  : <div className="whitespace-pre-wrap text-sm">{message.content}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex justify-end">
                  <button className="btn-secondary" onClick={closeView}>Close</button>
                </div>
              </div>
            </div>
          )}

          {isViewOpen && isSwitchHistoryOpen && viewItem && (
            <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={() => setIsSwitchHistoryOpen(false)}></div>
              <div className="relative bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-xl shadow-lg border border-gray-200 p-4 sm:p-5 max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Lead Type Switch History</h3>
                  <button className="text-gray-500" onClick={() => setIsSwitchHistoryOpen(false)}>✕</button>
                </div>
                <div className="space-y-2">
                  {(viewItem.leadTypeSwitchHistory || []).map((entry, idx) => (
                    <div key={`${entry.at || 'switch'}-${idx}`} className="border border-gray-200 rounded px-3 py-2 bg-gray-50 text-sm">
                      <div className="font-medium text-gray-800">
                        {(entry.from || 'Unknown')} {'->'} {(entry.to || 'Unknown')}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {entry.at ? new Date(entry.at).toLocaleString() : 'Time unavailable'}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <button className="btn-secondary" onClick={() => setIsSwitchHistoryOpen(false)}>Close</button>
                </div>
              </div>
            </div>
          )}

          {isEditOpen && editItem && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
              <div className="absolute inset-0 bg-black/30" onClick={closeEdit}></div>
              <div className="relative bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-xl shadow-lg border border-gray-200 p-4 sm:p-5 max-h-[92vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">Edit lead</h2>
                  <button className="text-gray-500" onClick={closeEdit}>✕</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input className="border border-gray-300 rounded px-3 py-2 md:col-span-2" placeholder="Title" value={editItem.title} onChange={(e) => setEditItem({ ...editItem, title: e.target.value })} />
                  <input className="border border-gray-300 rounded px-3 py-2" placeholder="Lead name" value={editItem.leadName || ''} onChange={(e) => setEditItem({ ...editItem, leadName: e.target.value })} />
                  <input className="border border-gray-300 rounded px-3 py-2" placeholder="Lead phone number" value={editItem.leadPhoneNumber || ''} onChange={(e) => setEditItem({ ...editItem, leadPhoneNumber: e.target.value })} />
                  <input className="border border-gray-300 rounded px-3 py-2 md:col-span-2" placeholder="Lead email" value={editItem.leadEmail || ''} onChange={(e) => setEditItem({ ...editItem, leadEmail: e.target.value })} />
                  <input className="border border-gray-300 rounded px-3 py-2" placeholder="Lead type" value={editItem.leadType || ''} onChange={(e) => setEditItem({ ...editItem, leadType: e.target.value })} />
                  <input className="border border-gray-300 rounded px-3 py-2" placeholder="Service type" value={editItem.serviceType || ''} onChange={(e) => setEditItem({ ...editItem, serviceType: e.target.value })} />
                  <textarea className="w-full border border-gray-300 rounded px-3 py-2 md:col-span-2" rows={3} placeholder="Summary" value={editItem.summary || ''} onChange={(e) => setEditItem({ ...editItem, summary: e.target.value })}></textarea>
                  <textarea className="w-full border border-gray-300 rounded px-3 py-2 md:col-span-2" rows={4} placeholder="Description" value={editItem.description || ''} onChange={(e) => setEditItem({ ...editItem, description: e.target.value })}></textarea>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button className="btn-secondary" onClick={closeEdit}>Cancel</button>
                  <button className="btn-primary" onClick={submitEdit} disabled={saving}>{saving ? 'Saving...' : 'Update'}</button>
                </div>
              </div>
            </div>
          )}

          <ConfirmModal
            isOpen={isConfirmOpen}
            onClose={closeConfirm}
            onConfirm={() => deleteId && remove(deleteId)}
            title="Delete Lead"
            message={(() => {
              const lead = deleteId ? items.find(l => l._id === deleteId) : null;
              const label = lead ? [lead.title, lead.leadName].filter(Boolean).join(' – ').trim() || 'Lead' : 'this lead';
              return `Are you sure you want to delete ${label ? `"${label}"` : 'this lead'}? This action cannot be undone.`;
            })()}
            confirmText="Delete Lead"
            cancelText="Cancel"
            confirmButtonClass="btn-danger"
            isLoading={saving}
          />

          {/* New Lead Notification */}
          {newLeadNotification && (
            <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <Bell className="w-5 h-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">New Lead Captured!</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    <strong>{newLeadNotification.title}</strong>
                    {newLeadNotification.leadName && (
                      <span> from {newLeadNotification.leadName}</span>
                    )}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => {
                        openView(newLeadNotification);
                        setNewLeadNotification(null);
                      }}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => setNewLeadNotification(null)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setNewLeadNotification(null)}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}


