'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAppPlanService } from '@/services';
import type { AppUsagePayload } from '@/services/appPlanService';

const CHANNELS = ['web', 'whatsapp', 'facebook', 'instagram', 'voice'] as const;

function labelForChannel(channel: (typeof CHANNELS)[number]): string {
  if (channel === 'web') return 'Web widget';
  if (channel === 'whatsapp') return 'WhatsApp';
  if (channel === 'facebook') return 'Messenger';
  if (channel === 'instagram') return 'Instagram';
  return 'Voice';
}

function toDateLabel(value: string | null): string {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString();
}

function daysRemaining(resetAt: string | null): string {
  if (!resetAt) return 'N/A';
  const d = new Date(resetAt);
  if (Number.isNaN(d.getTime())) return 'N/A';
  const ms = d.getTime() - Date.now();
  return `${Math.max(0, Math.ceil(ms / 86400000))}d`;
}

function progressColorClass(percent: number): string {
  if (percent >= 100) return 'bg-red-600';
  if (percent >= 90) return 'bg-orange-500';
  if (percent >= 80) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export default function ConversationUsageWidget({ appId }: { appId: string }) {
  const [usage, setUsage] = useState<AppUsagePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const svc = await useAppPlanService();
        const res = await svc.getOwnerUsage(appId);
        if (!cancelled) setUsage(res?.data || null);
      } catch {
        if (!cancelled) setUsage(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [appId]);

  const addonBadges = useMemo(() => {
    const badges: string[] = [];
    if (usage?.addons?.smsVerification) badges.push('SMS verification');
    return badges;
  }, [usage]);

  if (loading && !usage) {
    return <div className="h-24 bg-white border border-gray-200 rounded-xl animate-pulse" />;
  }

  if (!usage) {
    return <p className="text-sm text-gray-500">Usage data is not available for this app yet.</p>;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
      {!usage.paymentCleared && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
          Payment not cleared. Resets are skipped until payment is cleared.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CHANNELS.map((ch) => {
          const q = usage.quotas[ch];
          const channelEnabled = usage.channels[ch]?.enabled !== false;
          const used = q?.used ?? 0;
          const limit = q?.limit ?? 0;
          const pct = q?.unlimited || limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
          const fillClass = progressColorClass(pct);
          return (
            <div key={ch} className={`rounded-lg border p-3 ${channelEnabled ? 'border-gray-200 bg-gray-50/80' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-800">{labelForChannel(ch)}</span>
                {!channelEnabled && <span className="text-xs text-gray-400">— not enabled —</span>}
              </div>
              {!channelEnabled ? (
                <p className="text-xs text-gray-500 mt-2">This channel is disabled for this app.</p>
              ) : q?.unlimited ? (
                <p className="text-xs text-gray-500 mt-2">Unlimited</p>
              ) : (
                <>
                  <p className="text-xs text-gray-600 mt-2">
                    {used} / {limit} used
                    {q?.remaining != null ? ` · ${q.remaining} left` : ''}
                  </p>
                  <div className="mt-1.5 h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full ${fillClass}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-2">
                    Period {toDateLabel(q?.periodStart ?? null)} - {toDateLabel(q?.resetAt ?? null)} ({daysRemaining(q?.resetAt ?? null)} left)
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span>Reset cycle: {usage.resetCycle || 'monthly'}</span>
        {!usage.addons?.smsVerification && (
          <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-gray-600">
            SMS verification inactive (contact us to activate)
          </span>
        )}
        {addonBadges.map((badge) => (
          <span key={badge} className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-700">
            {badge}
          </span>
        ))}
      </div>
    </div>
  );
}
