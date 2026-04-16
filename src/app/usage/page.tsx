'use client';

import { useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components';
import Navigation from '@/components/Navigation';
import { useSidebar } from '@/contexts/SidebarContext';
import { useApp } from '@/contexts/AppContext';
import { subscriptionStateService } from '@/services/subscriptionStateService';
import { Camera, Globe, Phone } from 'lucide-react';

type ChannelUsage = {
  status: string;
  limit: { maxConversations: number; unlimited: boolean };
  usage: { usedConversations: number; remainingConversations: number | null };
};

type SubscriptionState = {
  channels?: Record<string, ChannelUsage>;
};

type SubscriptionEvent = {
  _id?: string;
  eventType: string;
  channel?: string | null;
  occurredAt?: string;
};

type ChannelKey = 'web' | 'whatsapp' | 'messenger' | 'instagram' | 'voice';

const CHANNELS: Array<{ key: ChannelKey; label: string }> = [
  { key: 'web', label: 'Web' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'messenger', label: 'Messenger' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'voice', label: 'Voice' },
];

const EMPTY_CHANNEL_USAGE: ChannelUsage = {
  status: 'no_data',
  limit: { maxConversations: 0, unlimited: false },
  usage: { usedConversations: 0, remainingConversations: 0 },
};

const toFriendlyLabel = (value?: string) => {
  if (!value) return 'N/A';
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const getDisplayStatus = (data: ChannelUsage): string => {
  const hasLimit = Boolean(data.limit.unlimited || data.limit.maxConversations > 0);
  if (!hasLimit) return 'not_subscribed';
  return data.status || 'active';
};

const getStatusClasses = (status?: string) => {
  if (status === 'not_subscribed') return 'bg-slate-100 text-slate-700';
  if (status === 'active') return 'bg-green-100 text-green-700';
  if (status === 'limit_reached') return 'bg-red-100 text-red-700';
  if (status === 'payment_pending') return 'bg-amber-100 text-amber-700';
  if (status === 'no_data') return 'bg-gray-100 text-gray-600';
  return 'bg-blue-100 text-blue-700';
};

const channelIcon = (channel: ChannelKey) => {
  if (channel === 'messenger') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
        <path d="M24 12a12 12 0 10-13.88 11.86v-8.39H7.08V12h3.04V9.36c0-3 1.79-4.66 4.53-4.66 1.31 0 2.68.23 2.68.23v2.95h-1.5c-1.48 0-1.94.92-1.94 1.86V12h3.3l-.53 3.47h-2.77v8.39A12 12 0 0024 12z" />
      </svg>
    );
  }
  if (channel === 'whatsapp') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    );
  }
  if (channel === 'instagram') return <Camera className="h-4 w-4" aria-hidden />;
  if (channel === 'voice') return <Phone className="h-4 w-4" aria-hidden />;
  return <Globe className="h-4 w-4" aria-hidden />;
};

const channelIconClasses = (channel: ChannelKey) => {
  if (channel === 'messenger') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (channel === 'instagram') return 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200';
  if (channel === 'whatsapp') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (channel === 'voice') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (channel === 'web') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-gray-50 text-gray-700 border-gray-200';
};

const formatCount = (value: number | null | undefined) => {
  const safe = Math.max(0, Number(value || 0));
  return safe.toLocaleString();
};

const getUnitLabel = (channel: ChannelKey) => (channel === 'voice' ? 'minutes' : 'conversations');

export default function UsagePage() {
  const { isOpen: isSidebarOpen } = useSidebar();
  const { currentApp } = useApp();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [events, setEvents] = useState<SubscriptionEvent[]>([]);
  const [trendDays, setTrendDays] = useState<7 | 30 | 90>(30);
  const [trendChannel, setTrendChannel] = useState<'all' | 'web' | 'whatsapp' | 'messenger' | 'instagram' | 'voice'>('all');

  useEffect(() => {
    const appId = currentApp?.id;
    if (!appId) {
      setState(null);
      setEvents([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [stateRes, reportRes] = await Promise.all([
          subscriptionStateService.getAppSubscriptionState(appId),
          subscriptionStateService.getAppSubscriptionReport(appId),
        ]);
        if (cancelled) return;
        setState(stateRes?.data?.subscriptionState || null);
        setEvents(reportRes?.data?.events || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentApp?.id]);

  const usageTrendRows = useMemo(() => {
    const byDay: Record<string, { total: number; channels: Record<string, number> }> = {};
    const now = Date.now();
    const windowStart = now - trendDays * 24 * 60 * 60 * 1000;
    const relevant = (events || []).filter((e) => {
      if (e.eventType !== 'usage_consumed') return false;
      if (trendChannel !== 'all' && e.channel !== trendChannel) return false;
      if (!e.occurredAt) return false;
      const ts = new Date(e.occurredAt).getTime();
      if (Number.isNaN(ts)) return false;
      return ts >= windowStart;
    });
    for (const event of relevant) {
      const ts = event.occurredAt ? new Date(event.occurredAt) : null;
      if (!ts || Number.isNaN(ts.getTime())) continue;
      const dayKey = ts.toISOString().slice(0, 10);
      if (!byDay[dayKey]) byDay[dayKey] = { total: 0, channels: {} };
      byDay[dayKey].total += 1;
      const channel = event.channel || 'unknown';
      byDay[dayKey].channels[channel] = (byDay[dayKey].channels[channel] || 0) + 1;
    }
    const rows = Object.entries(byDay)
      .map(([day, data]) => ({ day, total: data.total, channels: data.channels }))
      .sort((a, b) => (a.day < b.day ? 1 : -1))
      .slice(0, 10);
    const max = rows.reduce((m, r) => Math.max(m, r.total), 0);
    return rows.map((r) => ({ ...r, widthPct: max > 0 ? Math.max(6, Math.round((r.total / max) * 100)) : 0 }));
  }, [events, trendDays, trendChannel]);

  const channelCards = useMemo(
    () =>
      CHANNELS.map((channel) => ({
        ...channel,
        data: state?.channels?.[channel.key] || EMPTY_CHANNEL_USAGE,
      })),
    [state]
  );

  return (
    <ProtectedRoute>
      <div className="bg-white min-h-screen">
        <Navigation />
        <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Usage</h1>
            <p className="text-gray-500 mt-1 text-sm">Per-channel usage for current app.</p>

            {!currentApp ? (
              <p className="text-sm text-gray-500 mt-6">Select an app to view usage.</p>
            ) : loading ? (
              <div className="mt-6 space-y-6 animate-pulse">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="h-5 w-24 bg-gray-100 rounded" />
                        <div className="h-5 w-24 bg-gray-100 rounded-full" />
                      </div>
                      <div className="h-3 w-3/4 bg-gray-100 rounded mb-2" />
                      <div className="h-3 w-1/2 bg-gray-100 rounded" />
                    </div>
                  ))}
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="h-5 w-36 bg-gray-100 rounded mb-3" />
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="grid grid-cols-12 items-center gap-2 mb-2">
                      <div className="col-span-3 h-3 bg-gray-100 rounded" />
                      <div className="col-span-7 h-2.5 bg-gray-100 rounded-full" />
                      <div className="col-span-2 h-3 bg-gray-100 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {channelCards.map(({ key, label, data }) => {
                    const displayStatus = getDisplayStatus(data);
                    const unitLabel = getUnitLabel(key);
                    return (
                    <div key={key} className="rounded-xl border border-gray-200 p-4 bg-gradient-to-b from-white to-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`h-8 w-8 rounded-full border flex items-center justify-center ${channelIconClasses(key)}`}>
                            {channelIcon(key)}
                          </div>
                          <p className="text-sm font-semibold text-gray-900">{label}</p>
                        </div>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${getStatusClasses(displayStatus)}`}>
                          {toFriendlyLabel(displayStatus)}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-2">Unit: {unitLabel}</p>
                      <p className="text-xs text-gray-600 mt-3">
                        Used: {formatCount(data.usage.usedConversations)}
                      </p>
                      <p className="text-xs text-gray-600">
                        Remaining: {data.limit.unlimited ? 'Unlimited' : formatCount(data.usage.remainingConversations)}
                      </p>
                      <p className="text-xs text-gray-600">
                        Limit: {data.limit.unlimited ? 'Unlimited' : formatCount(data.limit.maxConversations)}
                      </p>
                    </div>
                  )})}
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-gray-900">Daily Usage Trend</p>
                    <div className="flex items-center gap-2">
                      <select className="text-xs border border-gray-200 rounded px-2 py-1 bg-white" value={trendDays} onChange={(e) => setTrendDays(Number(e.target.value) as 7 | 30 | 90)}>
                        <option value={7}>Last 7 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={90}>Last 90 days</option>
                      </select>
                      <select className="text-xs border border-gray-200 rounded px-2 py-1 bg-white" value={trendChannel} onChange={(e) => setTrendChannel(e.target.value as 'all' | 'web' | 'whatsapp' | 'messenger' | 'instagram' | 'voice')}>
                        <option value="all">All channels</option>
                        <option value="web">Web</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="messenger">Messenger</option>
                        <option value="instagram">Instagram</option>
                        <option value="voice">Voice</option>
                      </select>
                    </div>
                  </div>
                  {usageTrendRows.length === 0 ? (
                    <p className="text-xs text-gray-500">No usage events for selected filters.</p>
                  ) : (
                    <div className="space-y-2">
                      {usageTrendRows.map((row) => (
                        <div key={row.day} className="grid grid-cols-12 items-center gap-2">
                          <div className="col-span-3 text-[11px] text-gray-600">{new Date(row.day).toLocaleDateString()}</div>
                          <div className="col-span-7">
                            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                              <div className="h-2.5 bg-[#c01721]" style={{ width: `${row.widthPct}%` }} />
                            </div>
                          </div>
                          <div className="col-span-2 text-[11px] text-gray-700 text-right">{row.total}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

