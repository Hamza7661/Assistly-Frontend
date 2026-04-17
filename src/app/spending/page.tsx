'use client';

import { useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components';
import Navigation from '@/components/Navigation';
import { useSidebar } from '@/contexts/SidebarContext';
import { useApp } from '@/contexts/AppContext';
import { subscriptionStateService } from '@/services/subscriptionStateService';

type ChannelUsage = {
  status: string;
  limit: { maxConversations: number; unlimited: boolean };
  usage: { usedConversations: number; remainingConversations: number | null };
};

type SubscriptionState = {
  paymentCleared: boolean;
  billingStatus: string;
  addons?: { smsVerification?: { enabled: boolean; limit: number; used: number } };
  channels?: Record<string, ChannelUsage>;
};

const SUBSCRIBE_LINK = 'https://upzilo.com/contact/';

const CHANNEL_META: Record<string, { label: string; color: string }> = {
  web: { label: 'Web', color: 'bg-sky-500' },
  whatsapp: { label: 'WhatsApp', color: 'bg-emerald-500' },
  messenger: { label: 'Messenger', color: 'bg-blue-500' },
  instagram: { label: 'Instagram', color: 'bg-fuchsia-500' },
  voice: { label: 'Voice', color: 'bg-amber-500' },
};

const formatLimitText = (channelKey: string, limit: number | 'Unlimited') => {
  if (limit === 'Unlimited') return 'Unlimited';
  if (channelKey === 'voice') return `${limit.toLocaleString()} minutes`;
  return `${limit.toLocaleString()} conversations`;
};

const formatUsedText = (used: number) => {
  return used.toLocaleString();
};

const toFriendlyLabel = (value?: string) => {
  if (!value) return 'N/A';
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export default function SpendingPage() {
  const { isOpen: isSidebarOpen } = useSidebar();
  const { currentApp } = useApp();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<SubscriptionState | null>(null);

  useEffect(() => {
    const appId = currentApp?.id;
    if (!appId) {
      setState(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const stateRes = await subscriptionStateService.getAppSubscriptionState(appId);
        if (cancelled) return;
        setState(stateRes?.data?.subscriptionState || null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentApp?.id]);

  const utilization = useMemo(() => {
    const channels = Object.values(state?.channels || {});
    const finite = channels.filter((c) => !c.limit.unlimited && c.limit.maxConversations > 0);
    const totalLimit = finite.reduce((sum, ch) => sum + ch.limit.maxConversations, 0);
    const totalUsed = finite.reduce((sum, ch) => sum + ch.usage.usedConversations, 0);
    const percentage = totalLimit > 0 ? Math.min(100, Math.round((totalUsed / totalLimit) * 100)) : 0;
    return { totalLimit, totalUsed, percentage };
  }, [state]);

  const channelSpending = useMemo(() => {
    const channels = Object.entries(state?.channels || {}).map(([key, value]) => ({ key, value }));
    const subscribed = channels.filter(
      ({ value }) => value.limit.unlimited || value.limit.maxConversations > 0
    );
    const unsubscribedCount = channels.length - subscribed.length;
    const totalUsed = subscribed.reduce((sum, { value }) => sum + (value.usage.usedConversations || 0), 0);

    const segments = subscribed.map(({ key, value }) => {
      const used = value.usage.usedConversations || 0;
      const limit = value.limit.unlimited ? null : Math.max(0, value.limit.maxConversations || 0);
      const utilizationPct = limit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
      return {
        key,
        label: CHANNEL_META[key]?.label || key,
        color: CHANNEL_META[key]?.color || 'bg-gray-400',
        used,
        limit: value.limit.unlimited ? 'Unlimited' : Math.max(0, value.limit.maxConversations || 0),
        utilizationPct,
      };
    });

    return { subscribed, unsubscribedCount, totalUsed, segments };
  }, [state]);

  return (
    <ProtectedRoute>
      <div className="bg-white min-h-screen">
        <Navigation />
        <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Spending</h1>
            <p className="text-gray-500 mt-1 text-sm">Current app usage utilization and add-on consumption.</p>

            {!currentApp ? (
              <p className="text-sm text-gray-500 mt-6">Select an app to view spending.</p>
            ) : loading ? (
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4 animate-pulse">
                <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-4">
                  <div className="h-5 w-48 bg-gray-100 rounded mb-3" />
                  <div className="h-4 w-full bg-gray-100 rounded-full mb-3" />
                  <div className="flex flex-wrap gap-2 mb-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-6 w-24 bg-gray-100 rounded-md" />
                    ))}
                  </div>
                  <div className="h-3 w-3/4 bg-gray-100 rounded" />
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="h-5 w-24 bg-gray-100 rounded mb-3" />
                  <div className="h-3 w-1/2 bg-gray-100 rounded mb-2" />
                  <div className="h-3 w-3/4 bg-gray-100 rounded" />
                </div>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-900">Channel usage by subscribed channel</p>
                  {channelSpending.subscribed.length === 0 ? (
                    <div className="mt-3 rounded-lg border border-dashed border-gray-300 p-4 bg-gray-50">
                      <p className="text-sm text-gray-700">No subscribed channels for this app yet.</p>
                      <a
                        href={SUBSCRIBE_LINK}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center mt-3 px-3 py-1.5 rounded-md bg-[#c01721] text-white text-xs font-medium hover:bg-[#a5141c]"
                      >
                        Subscribe
                      </a>
                    </div>
                  ) : (
                    <>
                      <div className="mt-3 space-y-3">
                        {channelSpending.segments.map((segment) => (
                          <div key={segment.key}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-medium text-gray-700">{segment.label}</span>
                              <span className="text-gray-500">
                                {segment.limit === 'Unlimited'
                                  ? `${formatUsedText(segment.used)} used (Unlimited)`
                                  : `${formatUsedText(segment.used)} of ${formatLimitText(segment.key, segment.limit)}`}
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                              <div
                                className={`${segment.color} h-3`}
                                style={{ width: `${segment.utilizationPct}%` }}
                                title={`${segment.label}: ${segment.utilizationPct}%`}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        {channelSpending.totalUsed.toLocaleString()} total channel usage
                        {' · '}
                        {utilization.percentage}% overall finite-limit utilization
                      </p>
                      {channelSpending.unsubscribedCount > 0 && (
                        <a
                          href={SUBSCRIBE_LINK}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center mt-2 px-3 py-1.5 rounded-md border border-[#c01721] text-[#c01721] text-xs font-medium hover:bg-[#c01721]/5"
                        >
                          Subscribe More Channels
                        </a>
                      )}
                    </>
                  )}
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-900">SMS verification add-on</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {state?.addons?.smsVerification?.enabled
                      ? `${state?.addons?.smsVerification?.used || 0}/${state?.addons?.smsVerification?.limit || 0} used`
                      : 'Disabled'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Payment: {state?.paymentCleared ? 'Cleared' : 'Pending'} · Status: {toFriendlyLabel(state?.billingStatus)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

