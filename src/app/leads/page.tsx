'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Eye, Pencil, Trash2, Bell, X, Globe, Camera, Phone, Copy, ExternalLink, Mail, User, Monitor, MousePointerClick, CalendarDays, CalendarCheck, Maximize2 } from 'lucide-react';
import { ProtectedRoute, NoAppEmptyState, ConfirmModal } from '@/components';
import Navigation from '@/components/Navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useLeadService, useIntegrationService } from '@/services';
import type { Lead } from '@/models/Lead';
import { toast } from 'react-toastify';
import { COUNTRY_INFO, getCountryInfo } from '@/enums/Region';

export default function LeadsPage() {
  type SourceTab = 'all' | 'web' | 'whatsapp' | 'instagram' | 'facebook' | 'voice';
  type StatusFilter = 'all' | 'interacting' | 'in_progress' | 'confirmed' | 'complete';
  type DatePreset = 'all' | 'today' | 'last7' | 'thisMonth' | 'custom';
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
    voice: 1,
  });
  const [limit, setLimit] = useState(10);
  const [totalByTab, setTotalByTab] = useState<Record<SourceTab, number | null>>({
    all: null,
    web: null,
    whatsapp: null,
    instagram: null,
    facebook: null,
    voice: null,
  });

  const [q, setQ] = useState('');
  const [activeSourceTab, setActiveSourceTab] = useState<SourceTab>('all');
  const [leadType] = useState('');
  const [serviceType] = useState('');
  const [sortBy] = useState('leadDateTime');
  const [sortOrder] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [interactedWithFilter, setInteractedWithFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [dateFrom, setDateFrom] = useState(''); // yyyy-mm-dd
  const [dateTo, setDateTo] = useState(''); // yyyy-mm-dd

  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isViewVisible, setIsViewVisible] = useState(false);
  const [viewItem, setViewItem] = useState<Lead | null>(null);
  const [isSwitchHistoryOpen, setIsSwitchHistoryOpen] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isConversationMaximized, setIsConversationMaximized] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Lead | null>(null);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // WebSocket for real-time updates
  const [wsConnected, setWsConnected] = useState(false);
  const [newLeadNotification, setNewLeadNotification] = useState<Lead | null>(null);
  const wsRef = useRef<any>(null);
  const viewCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const primary = leadIdentityKey(lead);
    if (primary) keys.add(primary);
    if (lead._id) keys.add(`id:${lead._id}`);
    if (lead.createdAt) keys.add(`created:${lead.createdAt}`);
    if (lead.leadDateTime) keys.add(`leadDate:${lead.leadDateTime}`);
    const email = (lead.leadEmail || '').trim().toLowerCase();
    const phone = (lead.leadPhoneNumber || '').trim();
    const channel = (lead.sourceChannel || '').trim().toLowerCase();
    if (email || phone) keys.add(`fp:${email}|${phone}|${channel}`);
    return Array.from(keys);
  };

  const upsertIncomingLead = (prevItems: Lead[], incoming: Lead) => {
    const incomingKey = leadIdentityKey(incoming);
    if (!incomingKey) return { nextItems: [incoming, ...prevItems], inserted: true };

    const existingIndex = prevItems.findIndex((item) => leadIdentityKey(item) === incomingKey);
    if (existingIndex === -1) {
      return { nextItems: [incoming, ...prevItems], inserted: true };
    }

    const nextItems = [...prevItems];
    nextItems[existingIndex] = { ...nextItems[existingIndex], ...incoming };
    return { nextItems, inserted: false };
  };
  
  // Integration settings for button colors
  const [primaryColor, setPrimaryColor] = useState('#c01721');
  const sourceChannelFilter = activeSourceTab === 'all' ? undefined : activeSourceTab;
  const page = pageByTab[activeSourceTab] || 1;
  const total = totalByTab[activeSourceTab] ?? null;
  const [readLeadMap, setReadLeadMap] = useState<Record<string, string>>({});
  const pendingReadIdsRef = useRef<Set<string>>(new Set());
  const flushReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLeadUnread = (lead: Lead) => {
    const keys = leadReadKeys(lead);
    if (keys.length === 0) return false;
    return !keys.some((key) => !!readLeadMap[key]);
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
      console.error('Failed to sync lead read state:', e);
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
      console.error('Failed to persist lead read state:', e);
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
  const markLeadAsRead = (lead: Lead) => {
    const keys = leadReadKeys(lead);
    if (keys.length === 0) return;
    const now = new Date().toISOString();
    setReadLeadMap((prev) => ({
      ...prev,
      ...Object.fromEntries(keys.map((key) => [key, now])),
    }));
    if (lead._id) {
      pendingReadIdsRef.current.add(lead._id);
      scheduleFlushPendingReads();
    }
  };

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
    let isCancelled = false;

    // Connect to same port as API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const baseUrl = apiUrl.replace('/api/v1', '');

    // Import Socket.IO client dynamically
    import('socket.io-client').then(({ io }) => {
      if (isCancelled) return;
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
        let inserted = false;
        setItems((prevItems) => {
          const { nextItems, inserted: wasInserted } = upsertIncomingLead(prevItems, newLead);
          inserted = wasInserted;
          return nextItems;
        });
        
        // Show notification
        setNewLeadNotification(newLead);
        
        // Auto-hide notification after 5 seconds
        setTimeout(() => {
          setNewLeadNotification(null);
        }, 5000);
        
        // Update total count
        if (inserted) {
          setTotalByTab(prev => ({
            ...prev,
            [activeSourceTab]: prev[activeSourceTab] !== null ? (prev[activeSourceTab] as number) + 1 : 1,
          }));
        }
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
      isCancelled = true;
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
    };
  }, [user?._id]);

  // Format inline bullet points (•) so each starts on a new line
  const formatBulletPoints = (str: string) => str.replace(/ • /g, '\n• ');

  /** Strip emoji / pictographs so labels dedupe and match one icon (shared with interactionLabel). */
  const normalizeInteractionInput = (raw?: string | null): string => {
    let s = String(raw ?? '')
      .normalize('NFKC')
      .replace(/\p{Extended_Pictographic}+/gu, ' ')
      .replace(/[\uFE00-\uFE0F]/g, '')
      .replace(/\u200D/g, '')
      .trim();
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  };

  const asPlainTextLabel = (value?: string | null) => {
    const v = normalizeInteractionInput(value);
    if (!v) return '—';
    return v
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const prettifyLeadTypeInText = (text?: string | null, leadType?: string | null) => {
    const t = (text || '');
    const lt = (leadType || '').trim();
    if (!t || !lt) return t;

    const pretty = asPlainTextLabel(lt);
    const variants = Array.from(new Set([
      lt,
      lt.replace(/\s+/g, '-'),
      lt.replace(/\s+/g, '_'),
    ].filter(Boolean)));

    return variants.reduce((acc, v) => {
      const re = new RegExp(`\\b${escapeRegExp(v)}\\b`, 'gi');
      return acc.replace(re, pretty);
    }, t);
  };

  const hexToRgba = (hex: string, alpha: number) => {
    const raw = (hex || '').trim().replace('#', '');
    const expanded =
      raw.length === 3 ? raw.split('').map((c) => c + c).join('') :
      raw.length === 6 ? raw :
      '';
    if (!expanded) return `rgba(0,0,0,${alpha})`;
    const r = parseInt(expanded.slice(0, 2), 16);
    const g = parseInt(expanded.slice(2, 4), 16);
    const b = parseInt(expanded.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${Math.min(1, Math.max(0, alpha))})`;
  };

  const dialogBg = useMemo(() => {
    const a = hexToRgba(primaryColor, 0.08);
    const b = hexToRgba(primaryColor, 0.05);
    // Mostly-white surface with a subtle brand wash (avoids noisy tinted gaps).
    return `radial-gradient(1100px 520px at 0% 0%, ${a} 0%, transparent 62%),
            radial-gradient(900px 460px at 100% 8%, ${b} 0%, transparent 58%),
            #ffffff`;
  }, [primaryColor]);

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

  type InteractiveOption = { type: 'button' | 'checkbox'; value: string; label: string };

  const parseInteractiveOptions = (text: string): InteractiveOption[] => {
    const options: InteractiveOption[] = [];
    const regex = /<(button|checkbox)(?:\s+value=["']([^"']*)["'])?>([\s\S]*?)<\/\1>/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const type = (match[1] || '').toLowerCase() as 'button' | 'checkbox';
      const value = (match[2] || '').trim();
      const label = (match[3] || '').trim();
      if (!label) continue;
      options.push({ type, value, label });
    }
    return options;
  };

  const resolveUserSelectionValue = (history: NonNullable<Lead['history']>, index: number): string => {
    const message = history[index];
    const raw = (message?.content || '').trim();
    if (!raw || !/^\d+$/.test(raw)) return message?.content || '';

    // Walk backwards to find the nearest assistant prompt with interactive options.
    for (let i = index - 1; i >= 0; i -= 1) {
      const prev = history[i];
      if (!prev || prev.role !== 'assistant') continue;
      const options = parseInteractiveOptions(prev.content || '');
      if (options.length === 0) continue;

      // 1) If the option value itself is numeric and matches user value, use its label.
      const byValue = options.find((opt) => opt.value && opt.value === raw);
      if (byValue) return byValue.label;

      // 2) If user sent a 1-based index (common for numbered options), resolve by position.
      const n = Number.parseInt(raw, 10);
      if (Number.isFinite(n) && n >= 1 && n <= options.length) {
        return options[n - 1].label;
      }

      // 3) If backend passed 0-based index as value, map that too.
      const byZeroBasedValue = options.find((opt, optIndex) => String(optIndex) === raw);
      if (byZeroBasedValue) return byZeroBasedValue.label;

      return message.content;
    }
    return message.content;
  };

  const renderBotContent = (text: string) => {
    const parts: React.ReactNode[] = [];
    // Supports both:
    // 1) <button ...>Label</button>
    // 2) <checkbox ...>Label</checkbox>
    const regex = /<(button|checkbox)(?:\s+value=["']([^"']*)["'])?>([\s\S]*?)<\/\1>/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        const chunk = text.slice(lastIndex, match.index).trim();
        if (chunk) parts.push(renderTextWithLinks(chunk, `t-${lastIndex}`));
      }
      
      // Extract control type, label and value.
      const controlType = (match[1] || '').toLowerCase();
      const controlValue = match[2] || '';
      const controlText = (match[3] || '').trim();
      
      if (controlText) {
        parts.push(
          <div
            key={`b-${match.index}`}
            className={`block w-full text-left text-xs sm:text-sm font-medium px-3 sm:px-3 py-2 sm:py-1.5 shadow-sm mt-1 whitespace-normal break-words ${
              controlType === 'checkbox' ? 'rounded-lg bg-white text-gray-800 border border-gray-200' : 'rounded-full text-white'
            }`}
            style={{ 
              backgroundColor: controlType === 'checkbox' ? undefined : primaryColor,
            } as React.CSSProperties}
          >
            {controlText}
          </div>
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
    if (status === 'confirmed') return 'Confirmed';
    if (status === 'complete') return 'Complete';
    if (status === 'in_progress') return 'In Progress';
    return 'Interacting';
  };


  const statusClass = (status?: string) => {
    if (status === 'confirmed') return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
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
    if (source === 'voice') return 'Voice';
    return source;
  };

  const channelIcon = (source?: string) => {
    const s = (source || '').trim().toLowerCase();
    if (s === 'facebook' || s === 'messenger') {
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M24 12a12 12 0 10-13.88 11.86v-8.39H7.08V12h3.04V9.36c0-3 1.79-4.66 4.53-4.66 1.31 0 2.68.23 2.68.23v2.95h-1.5c-1.48 0-1.94.92-1.94 1.86V12h3.3l-.53 3.47h-2.77v8.39A12 12 0 0024 12z" />
        </svg>
      );
    }
    if (s === 'whatsapp') {
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      );
    }
    if (s === 'instagram') return <Camera className="h-4 w-4" aria-hidden />;
    if (s === 'web') return <Globe className="h-4 w-4" aria-hidden />;
    if (s === 'voice') return <Phone className="h-4 w-4" aria-hidden />;
    return <Globe className="h-4 w-4" aria-hidden />;
  };

  const channelPill = (source?: string) => (
    <span
      title={channelLabel(source)}
      className={`inline-flex items-center justify-center p-1 rounded-full border ${(() => {
        const s = (source || '').trim().toLowerCase();
        if (s === 'facebook' || s === 'messenger') return 'bg-blue-50 text-blue-700 border-blue-200';
        if (s === 'instagram') return 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200';
        if (s === 'whatsapp') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (s === 'voice') return 'bg-amber-50 text-amber-700 border-amber-200';
        if (s === 'web') return 'bg-slate-100 text-slate-700 border-slate-200';
        return 'bg-gray-50 text-gray-700 border-gray-200';
      })()}`}
    >
      {channelIcon(source)}
    </span>
  );

  /** Human-readable interaction / lead-type token (hyphens & underscores → spaces, title case). */
  const interactionLabel = (value?: string) => {
    const v = normalizeInteractionInput(value);
    if (!v) return 'Widget Opened';
    return v
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const isBookTreatmentLabel = (label: string) => {
    const compact = (label || '').trim().toLowerCase().replace(/[\s\-_]+/g, '');
    return compact === 'bookatreatment';
  };

  /** Calendar-with-grid icon for "Book A Treatment" everywhere (matches richer calendar look, not plain outline). */
  const bookTreatmentCalendarIcon = (size: 'sm' | 'md' = 'sm') => (
    <CalendarDays
      className={size === 'md' ? 'h-4 w-4 shrink-0 text-sky-600' : 'h-3.5 w-3.5 shrink-0 text-sky-600'}
      strokeWidth={2}
      aria-hidden
    />
  );

  const interactedWithText = (l: Lead) => {
    // If a lead is confirmed, show the lead type that was confirmed (not widget opened).
    if (l.status === 'confirmed') {
      return interactionLabel(l.leadType || l.initialInteraction || l.title || 'Widget Opened');
    }
    return interactionLabel(l.initialInteraction || l.title || 'Widget Opened');
  };


  const interactedWithIcon = (label: string) => {
    const t = (label || '').trim().toLowerCase();
    if (t === 'widget opened') return <MousePointerClick className="h-3.5 w-3.5 shrink-0 text-amber-800/90" aria-hidden />;
    if (isBookTreatmentLabel(label)) return bookTreatmentCalendarIcon('sm');
    return null;
  };

  const parseCountry = (lead: Lead) => {
    const rawCountry = (lead.location?.country || '').trim();
    const rawCountryCode = (lead.location?.countryCode || '').trim().toUpperCase();
    const compactCountry = rawCountry.replace(/\s+/g, ' ').trim();
    const firstToken = (compactCountry.split(' ')[0] || '').replace(/[^A-Za-z]/g, '');
    const tokenCode = firstToken.length === 2 ? firstToken.toUpperCase() : '';
    const strippedName =
      tokenCode
        ? compactCountry.replace(new RegExp(`^${tokenCode}[\\s,\\-_/]*`, 'i'), '').trim()
        : compactCountry;

    let code = '';
    if (rawCountryCode && COUNTRY_INFO[rawCountryCode]) code = rawCountryCode;
    else if (tokenCode && COUNTRY_INFO[tokenCode]) code = tokenCode;
    else if (compactCountry.length === 2 && COUNTRY_INFO[compactCountry.toUpperCase()]) code = compactCountry.toUpperCase();
    else {
      const lower = strippedName.toLowerCase();
      for (const [k, v] of Object.entries(COUNTRY_INFO)) {
        if ((v.name || '').toLowerCase() === lower) {
          code = k;
          break;
        }
      }
    }

    let name = '-';
    if (code && COUNTRY_INFO[code]) name = getCountryInfo(code).name;
    else if (strippedName) name = strippedName;
    else if (compactCountry) name = compactCountry;
    else if (rawCountryCode) name = rawCountryCode;

    return { code, name };
  };

  const countryName = (lead: Lead) => parseCountry(lead).name;

  const countryCode = (lead: Lead) => parseCountry(lead).code;

  const countryFlag = (lead: Lead) => {
    const code = countryCode(lead);
    if (!code || !/^[A-Z]{2}$/.test(code)) return '';
    return String.fromCodePoint(...code.split('').map((ch) => 127397 + ch.charCodeAt(0)));
  };

  const countryDisplay = (lead: Lead) => {
    const name = countryName(lead);
    if (!name || name === '-' || name === '—') return name || '-';
    return name;
  };

  const countryFlagUrl = (code?: string) => {
    if (!code || !/^[A-Z]{2}$/.test(code)) return '';
    return `https://flagcdn.com/w20/${code.toLowerCase()}.png`;
  };

  const browserNameOnly = (lead: Lead) => {
    const cc = lead.clientContext || {};
    if (cc.browserName) return cc.browserName;
    const ua = (cc.userAgent || '').toString();
    if (!ua) return '-';
    if (/Edg\//i.test(ua)) return 'Edge';
    if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return 'Opera';
    if (/Brave/i.test(ua)) return 'Brave';
    // Chrome on iOS reports "CriOS", not "Chrome".
    if (/(Chrome|CriOS)\//i.test(ua) && !/Chromium/i.test(ua)) return 'Chrome';
    if (/Firefox\//i.test(ua)) return 'Firefox';
    // Safari often includes "Safari" + "Version" and doesn't include Chrome token.
    if (/Safari\//i.test(ua) && !/(Chrome|CriOS)\//i.test(ua) && !/Chromium/i.test(ua)) return 'Safari';
    if (/Chromium/i.test(ua)) return 'Chromium';
    return 'Browser';
  };

  const deviceTypeLabel = (lead: Lead) => {
    const cc = lead.clientContext || {};
    if (cc.deviceType) return cc.deviceType;
    const ua = ((lead.clientContext || {}).userAgent || '').toString();
    if (!ua) return '-';
    if (/iPad|Tablet/i.test(ua)) return 'Tablet';
    if (/Mobi|Android|iPhone|iPod/i.test(ua)) return 'Mobile';
    return 'Desktop';
  };

  const browserDeviceLabel = (lead: Lead) => {
    const b = browserNameOnly(lead);
    const d = deviceTypeLabel(lead);
    if (!b || b === '-') return '-';
    if (!d || d === '-') return b;
    return `${b} / ${d}`;
  };

  const copyText = async (text?: string | null) => {
    const t = (text || '').trim();
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  const formatDateTime = (iso?: string) => {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const feedbackExperienceLabel = (experience?: string | null) => {
    if (experience === 'very_happy') return { emoji: '😄', label: 'Very happy' };
    if (experience === 'happy') return { emoji: '🙂', label: 'Happy' };
    if (experience === 'neutral') return { emoji: '😐', label: 'Neutral' };
    if (experience === 'sad') return { emoji: '🙁', label: 'Sad' };
    if (experience === 'very_sad') return { emoji: '😞', label: 'Very sad' };
    return null;
  };

  const openView = (lead: Lead) => {
    markLeadAsRead(lead);
    if (viewCloseTimerRef.current) {
      clearTimeout(viewCloseTimerRef.current);
      viewCloseTimerRef.current = null;
    }
    setViewItem(lead);
    setIsViewOpen(true);
    setShowHistory(true);
    requestAnimationFrame(() => setIsViewVisible(true));
  };
  const closeView = () => {
    setIsViewVisible(false);
    if (viewCloseTimerRef.current) clearTimeout(viewCloseTimerRef.current);
    viewCloseTimerRef.current = setTimeout(() => {
      setIsViewOpen(false);
      setViewItem(null);
      setIsSwitchHistoryOpen(false);
      setShowFullDescription(false);
      setShowHistory(false);
      setIsConversationMaximized(false);
      viewCloseTimerRef.current = null;
    }, 220);
  };

  useEffect(() => {
    return () => {
      if (viewCloseTimerRef.current) clearTimeout(viewCloseTimerRef.current);
      if (flushReadTimerRef.current) {
        clearTimeout(flushReadTimerRef.current);
        flushReadTimerRef.current = null;
      }
      void flushPendingReadIds();
    };
  }, []);

  useEffect(() => {
    setReadLeadMap({});
  }, [currentApp?.id, user?._id]);

  useEffect(() => {
    const ids = items.map((lead) => lead._id).filter((id): id is string => !!id);
    if (ids.length === 0) return;
    void syncReadState(ids);
  }, [items, currentApp?.id]);

  useEffect(() => {
    let isCancelled = false;

    const openFromPayload = async (payload?: { leadId?: string | null; lead?: Lead | null }) => {
      if (!payload || isCancelled) return;
      if (payload.lead) {
        openView(payload.lead);
        return;
      }
      if (!payload.leadId) return;

      const localMatch = items.find((lead) => lead._id === payload.leadId);
      if (localMatch) {
        openView(localMatch);
        return;
      }

      try {
        const svc = await useLeadService();
        const res = await svc.getById(payload.leadId);
        const fetched = res.data?.lead;
        if (!isCancelled && fetched) openView(fetched);
      } catch {
        // Ignore invalid / stale lead id silently.
      }
    };

    const handleOpenLeadEvent = (event: Event) => {
      const custom = event as CustomEvent<{ leadId?: string | null; lead?: Lead | null }>;
      void openFromPayload(custom.detail);
    };

    window.addEventListener('assistly:open-lead-detail', handleOpenLeadEvent as EventListener);

    const pendingRaw = sessionStorage.getItem('assistly:pendingLeadOpen');
    if (pendingRaw) {
      sessionStorage.removeItem('assistly:pendingLeadOpen');
      try {
        const pending = JSON.parse(pendingRaw) as { leadId?: string | null; lead?: Lead | null };
        void openFromPayload(pending);
      } catch {
        // Ignore malformed pending payload.
      }
    }

    return () => {
      isCancelled = true;
      window.removeEventListener('assistly:open-lead-detail', handleOpenLeadEvent as EventListener);
    };
  }, [items]);

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

  const interactedWithOptions = useMemo(() => {
    // Dedupe by semantic key so mixed emoji/raw variants collapse to one row + one icon.
    const byKey = new Map<string, string>();
    for (const l of items) {
      const display = interactedWithText(l);
      const key = display.trim().toLowerCase().replace(/[\s\-_]+/g, '');
      if (!byKey.has(key)) byKey.set(key, display);
    }
    const priority = new Map<string, number>([
      ['widgetopened', 0],
      ['bookanappointment', 1],
      ['bookatreatment', 2],
    ]);
    return Array.from(byKey.values()).sort((a, b) => {
      const ak = a.trim().toLowerCase().replace(/[\s\-_]+/g, '');
      const bk = b.trim().toLowerCase().replace(/[\s\-_]+/g, '');
      const ap = priority.get(ak);
      const bp = priority.get(bk);
      if (ap !== undefined || bp !== undefined) {
        if (ap === undefined) return 1;
        if (bp === undefined) return -1;
        return ap - bp;
      }
      return a.localeCompare(b);
    });
  }, [items]);

  const locationOptions = useMemo(() => {
    const map = new Map<string, { code: string; name: string; display: string; flagUrl: string }>();
    for (const l of items) {
      const name = countryName(l);
      if (!name || name === '-' || name === '—') continue;
      // Prefer ISO2 code key when available to avoid duplicates.
      const key = countryCode(l) || name;
      const code = countryCode(l);
      map.set(key, { code, name, display: countryDisplay(l), flagUrl: countryFlagUrl(code) });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const filteredItems = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLast7 = new Date(startOfToday);
    startOfLast7.setDate(startOfLast7.getDate() - 6);

    const inDateRange = (iso?: string) => {
      if (!iso) return false;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return false;

      if (datePreset === 'all') return true;
      if (datePreset === 'today') return d >= startOfToday;
      if (datePreset === 'last7') return d >= startOfLast7;
      if (datePreset === 'thisMonth') return d >= startOfMonth;

      // custom
      const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
      const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;
      if (from && !Number.isNaN(from.getTime()) && d < from) return false;
      if (to && !Number.isNaN(to.getTime()) && d > to) return false;
      return true;
    };

    return items.filter((l) => {
      if (statusFilter !== 'all' && (l.status || 'interacting') !== statusFilter) return false;
      if (interactedWithFilter !== 'all') {
        const rowKey = interactedWithText(l).trim().toLowerCase().replace(/[\s\-_]+/g, '');
        const filterKey = interactedWithFilter.trim().toLowerCase().replace(/[\s\-_]+/g, '');
        if (rowKey !== filterKey) return false;
      }
      if (locationFilter !== 'all' && countryName(l) !== locationFilter) return false;
      if (datePreset !== 'all' || (dateFrom || dateTo)) {
        if (!inDateRange(l.leadDateTime)) return false;
      }
      return true;
    });
  }, [items, statusFilter, interactedWithFilter, locationFilter, datePreset, dateFrom, dateTo]);

  const interactedWithDropdownRef = useRef<HTMLDivElement | null>(null);
  const [isInteractedWithOpen, setIsInteractedWithOpen] = useState(false);
  const countryDropdownRef = useRef<HTMLDivElement | null>(null);
  const [isCountryOpen, setIsCountryOpen] = useState(false);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!(e.target instanceof Node)) return;
      if (isInteractedWithOpen) {
        const interactedEl = interactedWithDropdownRef.current;
        if (interactedEl && !interactedEl.contains(e.target)) setIsInteractedWithOpen(false);
      }
      if (isCountryOpen) {
        const countryEl = countryDropdownRef.current;
        if (countryEl && !countryEl.contains(e.target)) setIsCountryOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsInteractedWithOpen(false);
        setIsCountryOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [isInteractedWithOpen, isCountryOpen]);

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
              <div className="lg:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">Search visitor name</label>
                <input
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder=""
                  value={q}
                  onChange={(e) => {
                    setPageByTab(prev => ({ ...prev, [activeSourceTab]: 1 }));
                    setQ(e.target.value);
                  }}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Status</label>
                <select
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-white"
                  value={statusFilter}
                  onChange={(e) => { setPageByTab(prev => ({ ...prev, [activeSourceTab]: 1 })); setStatusFilter(e.target.value as StatusFilter); }}
                >
                  <option value="all">All</option>
                  <option value="interacting">Interacting</option>
                  <option value="in_progress">In Progress</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="complete">Complete</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Channel</label>
                <select
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-white"
                  value={activeSourceTab}
                  onChange={(e) => {
                    const next = e.target.value as SourceTab;
                    setPageByTab(prev => ({ ...prev, [next]: 1 }));
                    setActiveSourceTab(next);
                  }}
                >
                  <option value="all">All</option>
                  <option value="web">Web</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="voice">Voice</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Interacted with</label>
                <div className="relative" ref={interactedWithDropdownRef}>
                  <button
                    type="button"
                    className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-left inline-flex items-center justify-between gap-2"
                    onClick={() => setIsInteractedWithOpen(v => !v)}
                  >
                    <span className="inline-flex items-center gap-2 min-w-0">
                      {interactedWithFilter !== 'all' ? interactedWithIcon(interactedWithFilter) : null}
                      <span className="truncate">
                        {interactedWithFilter === 'all' ? 'All' : interactedWithFilter}
                      </span>
                    </span>
                    <span className="text-gray-500">▾</span>
                  </button>
                  {isInteractedWithOpen && (
                    <div className="absolute z-20 mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
                      <button
                        type="button"
                        className={`w-full px-3 py-2 text-sm text-left hover:bg-gray-50 ${interactedWithFilter === 'all' ? 'bg-gray-50' : ''}`}
                        onClick={() => {
                          setPageByTab(prev => ({ ...prev, [activeSourceTab]: 1 }));
                          setInteractedWithFilter('all');
                          setIsInteractedWithOpen(false);
                        }}
                      >
                        All
                      </button>
                      <div className="max-h-60 overflow-y-auto">
                        {interactedWithOptions.map((v) => (
                          <button
                            key={v}
                            type="button"
                            className={`w-full px-3 py-2 text-sm text-left hover:bg-gray-50 inline-flex items-center gap-2 ${interactedWithFilter === v ? 'bg-gray-50' : ''}`}
                            onClick={() => {
                              setPageByTab(prev => ({ ...prev, [activeSourceTab]: 1 }));
                              setInteractedWithFilter(v);
                              setIsInteractedWithOpen(false);
                            }}
                          >
                            {interactedWithIcon(v)}
                            <span className="truncate">{v}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Country</label>
                <div className="relative" ref={countryDropdownRef}>
                  <button
                    type="button"
                    className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-left inline-flex items-center justify-between gap-2"
                    onClick={() => setIsCountryOpen(v => !v)}
                  >
                    <span className="inline-flex items-center gap-2 min-w-0">
                      {locationFilter !== 'all' && (() => {
                        const selected = locationOptions.find((c) => c.name === locationFilter);
                        return selected?.flagUrl ? (
                          <img src={selected.flagUrl} alt="" className="h-3.5 w-5 rounded-sm border border-gray-200 bg-white" />
                        ) : null;
                      })()}
                      <span className="truncate">
                        {locationFilter === 'all' ? 'All' : locationFilter}
                      </span>
                    </span>
                    <span className="text-gray-500">▾</span>
                  </button>
                  {isCountryOpen && (
                    <div className="absolute z-20 mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
                      <button
                        type="button"
                        className={`w-full px-3 py-2 text-sm text-left hover:bg-gray-50 ${locationFilter === 'all' ? 'bg-gray-50' : ''}`}
                        onClick={() => {
                          setPageByTab(prev => ({ ...prev, [activeSourceTab]: 1 }));
                          setLocationFilter('all');
                          setIsCountryOpen(false);
                        }}
                      >
                        All
                      </button>
                      <div className="max-h-60 overflow-y-auto">
                        {locationOptions.map((c) => (
                          <button
                            key={`${c.code}-${c.name}`}
                            type="button"
                            className={`w-full px-3 py-2 text-sm text-left hover:bg-gray-50 inline-flex items-center gap-2 ${locationFilter === c.name ? 'bg-gray-50' : ''}`}
                            onClick={() => {
                              setPageByTab(prev => ({ ...prev, [activeSourceTab]: 1 }));
                              setLocationFilter(c.name);
                              setIsCountryOpen(false);
                            }}
                          >
                            {c.flagUrl ? <img src={c.flagUrl} alt="" className="h-3.5 w-5 rounded-sm border border-gray-200 bg-white" /> : null}
                            <span className="truncate">{c.display}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Date</label>
                <select
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-white"
                  value={datePreset}
                  onChange={(e) => { setPageByTab(prev => ({ ...prev, [activeSourceTab]: 1 })); setDatePreset(e.target.value as DatePreset); }}
                >
                  <option value="all">Any time</option>
                  <option value="today">Today</option>
                  <option value="last7">Last 7 days</option>
                  <option value="thisMonth">This month</option>
                  <option value="custom">Custom range</option>
                </select>
              </div>

              {datePreset === 'custom' && (
                <>
                  <div className="lg:col-span-2">
                    <label className="block text-xs text-gray-600 mb-1">From</label>
                    <input
                      type="date"
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white"
                      value={dateFrom}
                      onChange={(e) => { setPageByTab(prev => ({ ...prev, [activeSourceTab]: 1 })); setDateFrom(e.target.value); }}
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-xs text-gray-600 mb-1">To</label>
                    <input
                      type="date"
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white"
                      value={dateTo}
                      onChange={(e) => { setPageByTab(prev => ({ ...prev, [activeSourceTab]: 1 })); setDateTo(e.target.value); }}
                    />
                  </div>
                </>
              )}
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
                { id: 'voice', label: 'Voice Call', icon: Phone, iconBg: 'bg-gradient-to-r from-rose-500 to-red-600' },
              ] as const).map((tab) => {
                const Icon = tab.icon;
                const active = activeSourceTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs sm:text-sm font-medium transition ${
                      active
                        ? 'text-white border-transparent'
                        : 'text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    style={active ? { backgroundColor: primaryColor } : undefined}
                    onClick={() => {
                      setActiveSourceTab(tab.id);
                    }}
                  >
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-white shadow ${tab.iconBg}`}
                      style={{ boxShadow: active ? '0 6px 16px rgba(0,0,0,0.18)' : undefined }}
                    >
                      {tab.id === 'whatsapp' ? (
                        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                          <path d="M12.02 2a9.94 9.94 0 0 0-8.51 15.11L2 22l5-1.46a9.97 9.97 0 1 0 5.02-18.54Zm0 17.98a7.98 7.98 0 0 1-4.07-1.11l-.29-.17-2.97.87.8-2.89-.19-.3a7.98 7.98 0 1 1 6.72 3.6Z" />
                          <path d="M17.47 14.38c-.27-.13-1.6-.79-1.84-.88-.25-.09-.43-.13-.61.13-.18.25-.7.88-.85 1.06-.16.18-.31.2-.58.07-.27-.13-1.12-.41-2.14-1.31-.79-.7-1.33-1.57-1.48-1.83-.16-.27-.02-.41.11-.54.12-.12.27-.31.4-.47.13-.16.18-.27.27-.45.09-.18.04-.34-.02-.47-.07-.13-.61-1.47-.84-2.01-.22-.53-.44-.45-.61-.46h-.52c-.18 0-.47.07-.71.34-.25.27-.95.93-.95 2.27s.98 2.64 1.11 2.82c.13.18 1.9 2.9 4.6 4.07.64.28 1.14.45 1.53.58.64.2 1.22.17 1.68.1.51-.08 1.6-.65 1.82-1.28.22-.63.22-1.17.16-1.28-.07-.11-.25-.18-.52-.31Z" />
                        </svg>
                      ) : tab.id === 'facebook' ? (
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                          <path d="M24 12a12 12 0 10-13.88 11.86v-8.39H7.08V12h3.04V9.36c0-3 1.79-4.66 4.53-4.66 1.31 0 2.68.23 2.68.23v2.95h-1.5c-1.48 0-1.94.92-1.94 1.86V12h3.3l-.53 3.47h-2.77v8.39A12 12 0 0024 12z" />
                        </svg>
                      ) : (
                        <Icon className="h-3.5 w-3.5" />
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
            ) : filteredItems.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-sm">No leads found</div>
            ) : (
              <>
                {/* ── Mobile card list ── */}
                <ul className="divide-y divide-gray-100 sm:hidden">
                  {filteredItems.map(l => (
                    <li key={l._id} className="p-4 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate inline-flex items-center gap-1.5">
                          {isLeadUnread(l) ? <span className="h-2 w-2 rounded-full bg-[#c01721] shrink-0" /> : null}
                          <span className="truncate">{l.leadName || 'Anonymous Visitor'}</span>
                        </p>
                        <p className="inline-flex items-center gap-1 text-xs text-gray-500 mt-0.5 truncate">
                          {interactedWithIcon(interactedWithText(l))}
                          {interactedWithText(l)}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusClass(l.status)}`}>{statusLabel(l.status)}</span>
                          {activeSourceTab === 'all' && (
                            channelPill(l.sourceChannel)
                          )}
                          <span className="inline-flex items-center gap-1.5 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {countryFlagUrl(countryCode(l)) ? <img src={countryFlagUrl(countryCode(l))} alt="" className="h-3 w-4 rounded-sm border border-gray-200 bg-white" /> : null}
                            {countryDisplay(l)}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-1">
                          <p className="text-[11px] text-gray-500 truncate"><span className="text-gray-400">IP:</span> {l.clientContext?.ipAddress || '-'}</p>
                          <p className="text-[11px] text-gray-500 truncate"><span className="text-gray-400">Browser:</span> {browserDeviceLabel(l)}</p>
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
                <table className="hidden sm:table w-full table-fixed text-sm">
                  <thead>
                    <tr className="text-left border-b bg-gray-50">
                      <th className="px-4 py-3 font-medium text-gray-600 w-[170px]">Visitor</th>
                      <th className="px-4 py-3 font-medium text-gray-600 w-[95px]">Status</th>
                      {activeSourceTab === 'all' && (
                        <th className="px-4 py-3 font-medium text-gray-600 w-[72px] whitespace-nowrap">Channel</th>
                      )}
                      <th className="px-4 py-3 font-medium text-gray-600 min-w-[170px]">Interaction</th>
                      <th className="px-4 py-3 font-medium text-gray-600 min-w-[220px]">Country / Location</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Date</th>
                      <th className="px-4 py-3 w-32"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map(l => (
                      <tr key={l._id} className="border-b last:border-b-0 hover:bg-gray-50/50">
                        <td className="px-4 py-3 w-[170px]">
                          <div className="truncate inline-flex items-center gap-1.5" title={l.leadName || 'Anonymous Visitor'}>
                            {isLeadUnread(l) ? <span className="h-2 w-2 rounded-full bg-[#c01721] shrink-0" /> : null}
                            <span className="truncate">{l.leadName || 'Anonymous Visitor'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 w-[95px]"><span className={`inline-flex whitespace-nowrap text-xs px-2 py-0.5 rounded-full ${statusClass(l.status)}`}>{statusLabel(l.status)}</span></td>
                        {activeSourceTab === 'all' && (
                          <td className="px-4 py-3 text-gray-600 w-[72px]">{channelPill(l.sourceChannel)}</td>
                        )}
                        <td className="px-4 py-3 text-gray-600">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-xs max-w-[170px] whitespace-normal break-words leading-snug">
                            {interactedWithIcon(interactedWithText(l))}
                            <span>{interactedWithText(l)}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 align-top">
                          <div className="max-w-[240px]">
                            <div className="inline-flex items-start gap-1.5 whitespace-normal break-words leading-snug">
                              {countryFlagUrl(countryCode(l)) ? <img src={countryFlagUrl(countryCode(l))} alt="" className="h-3.5 w-5 rounded-sm border border-gray-200 bg-white mt-0.5 flex-shrink-0" /> : null}
                              <span>{countryDisplay(l)}</span>
                            </div>
                            <div className="mt-1 text-[11px] text-gray-500">
                              <span className="text-gray-400">IP:</span> <span className="font-mono">{l.clientContext?.ipAddress || '-'}</span>
                            </div>
                            <div className="text-[11px] text-gray-500 truncate" title={browserDeviceLabel(l)}>
                              <span className="text-gray-400">Browser:</span> {browserDeviceLabel(l)}
                            </div>
                          </div>
                        </td>
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
              <div
                className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${isViewVisible ? 'opacity-100' : 'opacity-0'}`}
                onClick={closeView}
              ></div>
              <div
                className={`relative w-full sm:max-w-4xl rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 max-h-[92vh] overflow-y-auto transition-all duration-200 ease-out ${
                  isViewVisible
                    ? 'opacity-100 translate-y-0 sm:scale-100'
                    : 'opacity-0 translate-y-4 sm:translate-y-2 sm:scale-[0.985]'
                }`}
                style={{ background: dialogBg }}
              >
                <div className="p-4 sm:p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                          {viewItem.leadName?.trim() || 'Anonymous Visitor'}
                        </h2>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusClass(viewItem.status)}`}>{statusLabel(viewItem.status)}</span>
                        <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full">
                          {channelLabel(viewItem.sourceChannel)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-800 border border-amber-100 px-2 py-0.5 rounded-full">
                          {interactedWithIcon(interactedWithText(viewItem))}
                          {interactedWithText(viewItem)}
                        </span>
                        <span className="text-xs bg-gray-50 text-gray-700 border border-gray-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                          Lead date: {formatDateTime(viewItem.leadDateTime)}
                        </span>
                      </div>
                    </div>
                    <button className="inline-flex items-center justify-center rounded-lg border border-gray-200 h-9 w-9 text-gray-600 hover:bg-gray-50" onClick={closeView} aria-label="Close">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Grid */}
                  <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Contact */}
                    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                      <div
                        className="absolute inset-x-0 top-0 h-1"
                        style={{ background: `linear-gradient(90deg, ${primaryColor} 0%, ${primaryColor}55 70%, transparent 100%)` }}
                      />
                      <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-rose-50 to-transparent" />
                      <div className="flex items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white">
                            <User className="h-4 w-4" style={{ color: primaryColor }} />
                          </span>
                          <div className="text-sm font-semibold text-gray-900">Contact</div>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div className="col-span-2 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[11px] uppercase tracking-wide text-gray-500">Email</div>
                            <div className="mt-0.5 font-medium text-gray-900 truncate">{viewItem.leadEmail || '—'}</div>
                          </div>
                          <button
                            className="inline-flex items-center gap-1 text-xs border border-gray-200 bg-white px-2 py-1 rounded-md hover:bg-gray-50 disabled:opacity-40"
                            disabled={!viewItem.leadEmail}
                            onClick={() => copyText(viewItem.leadEmail)}
                          >
                            <Mail className="h-3.5 w-3.5" /> Copy
                          </button>
                        </div>
                        <div className="col-span-2 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[11px] uppercase tracking-wide text-gray-500">Phone</div>
                            <div className="mt-0.5 font-medium text-gray-900 truncate">{viewItem.leadPhoneNumber || '—'}</div>
                          </div>
                          <button
                            className="inline-flex items-center gap-1 text-xs border border-gray-200 bg-white px-2 py-1 rounded-md hover:bg-gray-50 disabled:opacity-40"
                            disabled={!viewItem.leadPhoneNumber}
                            onClick={() => copyText(viewItem.leadPhoneNumber)}
                          >
                            <Copy className="h-3.5 w-3.5" /> Copy
                          </button>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] uppercase tracking-wide text-gray-500">Lead type</div>
                          <div className="mt-0.5 font-medium text-gray-900 truncate inline-flex items-center gap-1.5 max-w-full">
                            {viewItem.leadType?.trim() ? interactedWithIcon(asPlainTextLabel(viewItem.leadType)) : null}
                            <span className="truncate">{asPlainTextLabel(viewItem.leadType)}</span>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] uppercase tracking-wide text-gray-500">Service</div>
                          <div className="mt-0.5 font-medium text-gray-900 truncate">{viewItem.serviceType || '—'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Client / Device */}
                    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-sky-400 to-transparent" />
                      <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-sky-50 to-transparent" />
                      <div className="flex items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white">
                            <Monitor className="h-4 w-4" style={{ color: primaryColor }} />
                          </span>
                          <div className="text-sm font-semibold text-gray-900">Country</div>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div className="min-w-0">
                          <div className="text-[11px] uppercase tracking-wide text-gray-500">Country</div>
                          <div className="mt-0.5 font-medium text-gray-900 truncate inline-flex items-center gap-1.5">
                            {countryFlagUrl(countryCode(viewItem)) ? <img src={countryFlagUrl(countryCode(viewItem))} alt="" className="h-3.5 w-5 rounded-sm border border-gray-200 bg-white" /> : null}
                            {countryDisplay(viewItem)}
                          </div>
                        </div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[11px] uppercase tracking-wide text-gray-500">IP address</div>
                            <div className="mt-0.5 font-medium text-gray-900 font-mono text-xs truncate">{viewItem.clientContext?.ipAddress || '—'}</div>
                          </div>
                          <button
                            className="inline-flex items-center gap-1 text-xs border border-gray-200 bg-white px-2 py-1 rounded-md hover:bg-gray-50 disabled:opacity-40"
                            disabled={!viewItem.clientContext?.ipAddress}
                            onClick={() => copyText(viewItem.clientContext?.ipAddress)}
                          >
                            <Copy className="h-3.5 w-3.5" /> Copy
                          </button>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] uppercase tracking-wide text-gray-500">Browser</div>
                          <div className="mt-0.5 font-medium text-gray-900 truncate">{browserNameOnly(viewItem)}</div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] uppercase tracking-wide text-gray-500">Device</div>
                          <div className="mt-0.5 font-medium text-gray-900 truncate">{deviceTypeLabel(viewItem)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Interaction */}
                    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-transparent" />
                      <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-amber-50 to-transparent" />
                      <div className="flex items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white">
                            {isBookTreatmentLabel(interactedWithText(viewItem)) ? (
                              bookTreatmentCalendarIcon('md')
                            ) : (
                              <MousePointerClick className="h-4 w-4" style={{ color: primaryColor }} />
                            )}
                          </span>
                          <div className="text-sm font-semibold text-gray-900">Interaction</div>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div className="min-w-0">
                          <div className="text-[11px] uppercase tracking-wide text-gray-500">Initial interaction</div>
                          <div className="mt-0.5 font-medium text-gray-900 truncate inline-flex items-center gap-1.5 max-w-full">
                            {interactedWithIcon(interactionLabel(viewItem.initialInteraction || '') || '')}
                            <span className="truncate">{interactionLabel(viewItem.initialInteraction || '') || '—'}</span>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] uppercase tracking-wide text-gray-500">Lead source</div>
                          <div className="mt-0.5 font-medium text-gray-900 truncate">{channelLabel(viewItem.sourceChannel)}</div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-[11px] uppercase tracking-wide text-gray-500">Clicked items</div>
                          {(viewItem.clickedItems || []).length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {(viewItem.clickedItems || []).slice(0, 20).map((it, idx) => {
                                const pretty = interactionLabel(it);
                                return (
                                  <span key={`${it}-${idx}`} className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-700 inline-flex items-center gap-1">
                                    {interactedWithIcon(pretty)}
                                    {pretty}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="mt-0.5 font-medium text-gray-900">—</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Appointment */}
                    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-transparent" />
                      <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-emerald-50 to-transparent" />
                      <div className="flex items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white">
                            <CalendarCheck className="h-4 w-4" style={{ color: primaryColor }} />
                          </span>
                          <div className="text-sm font-semibold text-gray-900">Appointment</div>
                        </div>
                      </div>
                      <div className="mt-3 text-sm">
                        {viewItem.appointmentDetails ? (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="min-w-0">
                              <div className="text-[11px] uppercase tracking-wide text-gray-500">Confirmed</div>
                              <div className="mt-0.5 font-medium text-gray-900">{viewItem.appointmentDetails.confirmed ? 'Yes' : 'No'}</div>
                            </div>
                            <div className="min-w-0">
                              <div className="text-[11px] uppercase tracking-wide text-gray-500">Start</div>
                              <div className="mt-0.5 font-medium text-gray-900 truncate">
                                {viewItem.appointmentDetails.start ? new Date(viewItem.appointmentDetails.start).toLocaleString() : '—'}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="text-[11px] uppercase tracking-wide text-gray-500">End</div>
                              <div className="mt-0.5 font-medium text-gray-900 truncate">
                                {viewItem.appointmentDetails.end ? new Date(viewItem.appointmentDetails.end).toLocaleString() : '—'}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="text-[11px] uppercase tracking-wide text-gray-500">Service</div>
                              <div className="mt-0.5 font-medium text-gray-900 truncate">
                                {viewItem.serviceType || '—'}
                              </div>
                            </div>
                            {viewItem.appointmentDetails.link ? (
                              <div className="col-span-2 pt-1">
                                <a href={viewItem.appointmentDetails.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-blue-700 hover:underline">
                                  <ExternalLink className="h-4 w-4" /> Open calendar event
                                </a>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="text-gray-700">—</div>
                        )}
                      </div>
                    </div>

                    {/* User feedback */}
                    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-violet-400 to-transparent" />
                      <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-violet-50 to-transparent" />
                      <div className="flex items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white">
                            <span className="text-base" aria-hidden>💬</span>
                          </span>
                          <div className="text-sm font-semibold text-gray-900">User feedback</div>
                        </div>
                      </div>
                      <div className="mt-3 text-sm">
                        {viewItem.userFeedback?.experience || viewItem.userFeedback?.rating ? (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="min-w-0">
                              <div className="text-[11px] uppercase tracking-wide text-gray-500">Experience</div>
                              <div className="mt-0.5 font-medium text-gray-900 inline-flex items-center gap-2">
                                {feedbackExperienceLabel(viewItem.userFeedback?.experience)?.emoji ? (
                                  <span>{feedbackExperienceLabel(viewItem.userFeedback?.experience)?.emoji}</span>
                                ) : null}
                                <span>{feedbackExperienceLabel(viewItem.userFeedback?.experience)?.label || '—'}</span>
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="text-[11px] uppercase tracking-wide text-gray-500">Rating</div>
                              <div className="mt-0.5 font-medium text-gray-900 inline-flex items-center gap-2">
                                <span className="text-amber-500">
                                  {'★★★★★'.slice(0, Math.max(0, Math.min(5, Number(viewItem.userFeedback?.rating || 0))))}
                                  <span className="text-gray-300">
                                    {'★★★★★'.slice(0, 5 - Math.max(0, Math.min(5, Number(viewItem.userFeedback?.rating || 0))))}
                                  </span>
                                </span>
                                <span>
                                  {viewItem.userFeedback?.rating ? `${viewItem.userFeedback.rating}/5` : '—'}
                                </span>
                              </div>
                            </div>
                            {viewItem.userFeedback?.submittedAt ? (
                              <div className="col-span-2 min-w-0">
                                <div className="text-[11px] uppercase tracking-wide text-gray-500">Submitted</div>
                                <div className="mt-0.5 font-medium text-gray-900 truncate">{formatDateTime(viewItem.userFeedback.submittedAt)}</div>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="text-gray-700">No feedback submitted yet.</div>
                        )}
                      </div>
                    </div>

                    {/* Summary / Description */}
                    <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-gray-900">Summary</div>
                        <div className="text-xs text-gray-500">Lead date: {formatDateTime(viewItem.leadDateTime)}</div>
                      </div>
                      <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">
                        {prettifyLeadTypeInText(viewItem.summary || '—', viewItem.leadType)}
                      </div>
                      <div className="mt-4 text-sm font-semibold text-gray-900">Description</div>
                      {(() => {
                        const desc = prettifyLeadTypeInText(viewItem.description || '', viewItem.leadType).trim();
                        if (!desc) return <div className="mt-2 text-sm text-gray-800">—</div>;
                        const shouldClamp = desc.length > 260;
                        const shown = showFullDescription || !shouldClamp ? desc : `${desc.slice(0, 260)}…`;
                        return (
                          <div className="mt-2">
                            <div className="text-sm text-gray-800 whitespace-pre-wrap">{shown}</div>
                            {shouldClamp && (
                              <button className="mt-2 text-xs font-medium text-blue-700 hover:underline" onClick={() => setShowFullDescription(v => !v)}>
                                {showFullDescription ? 'Show less' : 'Show more'}
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Conversation history */}
                    {viewItem.history && viewItem.history.length > 0 && (
                      <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-gray-900">Conversation</div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="inline-flex items-center gap-2 text-xs font-medium text-gray-700 border border-gray-200 rounded-md px-3 py-1.5 hover:bg-gray-50"
                              onClick={() => setIsConversationMaximized(true)}
                              title="Open in a larger view"
                            >
                              <Maximize2 className="h-3.5 w-3.5" />
                              Maximize
                            </button>
                            <button className="text-xs font-medium text-gray-700 border border-gray-200 rounded-md px-3 py-1.5 hover:bg-gray-50" onClick={() => setShowHistory(v => !v)}>
                              {showHistory ? 'Hide' : `Show (${viewItem.history.length})`}
                            </button>
                          </div>
                        </div>
                        {showHistory && (
                          <div className="mt-3 border border-gray-200 rounded-lg bg-gray-50 p-4 max-h-96 overflow-y-auto">
                            <div className="space-y-3">
                              {viewItem.history.map((message, index) => (
                                <div
                                  key={index}
                                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                  <div
                                    className={`max-w-[85%] rounded-lg px-4 py-2 ${
                                      message.role === 'user'
                                        ? 'text-white'
                                        : 'bg-white text-gray-800 border border-gray-200'
                                    }`}
                                    style={message.role === 'user' ? { backgroundColor: primaryColor } : {}}
                                  >
                                    <div className="text-[11px] font-semibold mb-1 opacity-80">
                                      {message.role === 'user' ? 'Customer' : 'Assistant'}
                                    </div>
                                    {message.role === 'assistant'
                                      ? renderBotContent(message.content)
                                      : <div className="whitespace-pre-wrap text-sm">{resolveUserSelectionValue(viewItem.history || [], index)}</div>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Lead type switch history */}
                    <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-gray-900">Lead type switches</div>
                        <button
                          type="button"
                          className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => setIsSwitchHistoryOpen(true)}
                          disabled={!viewItem.leadTypeSwitchHistory || viewItem.leadTypeSwitchHistory.length === 0}
                        >
                          View ({viewItem.leadTypeSwitchHistory?.length || 0})
                        </button>
                      </div>
                      <div className="mt-2 text-xs text-gray-600">
                        {viewItem.leadTypeSwitchHistory && viewItem.leadTypeSwitchHistory.length > 0 ? 'Lead type was changed during the conversation.' : 'No switches recorded.'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex justify-end gap-2">
                    <button className="btn-secondary" onClick={closeView}>Close</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Maximized conversation dialog */}
          {isViewOpen && isConversationMaximized && viewItem?.history && viewItem.history.length > 0 && (
            <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => setIsConversationMaximized(false)}
              />
              <div className="relative w-full sm:max-w-5xl md:max-w-6xl rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 max-h-[92vh] overflow-hidden bg-white">
                <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-gray-200 bg-white">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">Conversation</div>
                    <div className="text-xs text-gray-500 truncate">
                      {viewItem.leadName?.trim() || 'Anonymous Visitor'} • {viewItem.history.length} messages
                    </div>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-lg border border-gray-200 h-9 w-9 text-gray-600 hover:bg-gray-50"
                    onClick={() => setIsConversationMaximized(false)}
                    aria-label="Close conversation"
                    title="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-4 sm:p-6 bg-gray-50 h-[78vh] overflow-y-auto">
                  <div className="space-y-3">
                    {viewItem.history.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-4 py-2 ${
                            message.role === 'user'
                              ? 'text-white'
                              : 'bg-white text-gray-800 border border-gray-200'
                          }`}
                          style={message.role === 'user' ? { backgroundColor: primaryColor } : {}}
                        >
                          <div className="text-[11px] font-semibold mb-1 opacity-80">
                            {message.role === 'user' ? 'Customer' : 'Assistant'}
                          </div>
                          {message.role === 'assistant'
                            ? renderBotContent(message.content)
                            : <div className="whitespace-pre-wrap text-sm">{resolveUserSelectionValue(viewItem.history || [], index)}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
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
                  {(viewItem.leadTypeSwitchHistory || []).map((entry, idx) => {
                    const fromPretty = (entry.from || '').trim()
                      ? interactionLabel(entry.from)
                      : 'Unknown';
                    const toPretty = (entry.to || '').trim() ? interactionLabel(entry.to) : 'Unknown';
                    return (
                    <div key={`${entry.at || 'switch'}-${idx}`} className="border border-gray-200 rounded px-3 py-2 bg-gray-50 text-sm">
                      <div className="font-medium text-gray-800 inline-flex flex-wrap items-center gap-1">
                        <span className="inline-flex items-center gap-1">
                          {fromPretty !== 'Unknown' ? interactedWithIcon(fromPretty) : null}
                          {fromPretty}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="inline-flex items-center gap-1">
                          {toPretty !== 'Unknown' ? interactedWithIcon(toPretty) : null}
                          {toPretty}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {entry.at ? new Date(entry.at).toLocaleString() : 'Time unavailable'}
                      </div>
                    </div>
                    );
                  })}
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
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                    <input className="w-full border border-gray-300 rounded px-3 py-2" placeholder="Title" value={editItem.title} onChange={(e) => setEditItem({ ...editItem, title: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Lead name</label>
                    <input className="w-full border border-gray-300 rounded px-3 py-2" placeholder="Lead name" value={editItem.leadName || ''} onChange={(e) => setEditItem({ ...editItem, leadName: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Lead phone number</label>
                    <input className="w-full border border-gray-300 rounded px-3 py-2" placeholder="Lead phone number" value={editItem.leadPhoneNumber || ''} onChange={(e) => setEditItem({ ...editItem, leadPhoneNumber: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Lead email</label>
                    <input className="w-full border border-gray-300 rounded px-3 py-2" placeholder="Lead email" value={editItem.leadEmail || ''} onChange={(e) => setEditItem({ ...editItem, leadEmail: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Lead type</label>
                    <input className="w-full border border-gray-300 rounded px-3 py-2" placeholder="Lead type" value={editItem.leadType || ''} onChange={(e) => setEditItem({ ...editItem, leadType: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Service type</label>
                    <input className="w-full border border-gray-300 rounded px-3 py-2" placeholder="Service type" value={editItem.serviceType || ''} onChange={(e) => setEditItem({ ...editItem, serviceType: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Summary</label>
                    <textarea className="w-full border border-gray-300 rounded px-3 py-2" rows={3} placeholder="Summary" value={editItem.summary || ''} onChange={(e) => setEditItem({ ...editItem, summary: e.target.value })}></textarea>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                    <textarea className="w-full border border-gray-300 rounded px-3 py-2" rows={4} placeholder="Description" value={editItem.description || ''} onChange={(e) => setEditItem({ ...editItem, description: e.target.value })}></textarea>
                  </div>
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
                  <div className="mt-1">
                    {channelPill(newLeadNotification.sourceChannel)}
                  </div>
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


