'use client';

import { useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components';
import Navigation from '@/components/Navigation';
import { useSidebar } from '@/contexts/SidebarContext';
import { useApp } from '@/contexts/AppContext';
import { subscriptionStateService } from '@/services/subscriptionStateService';

type SubscriptionState = {
  paymentCleared: boolean;
  billingStatus: string;
  cycleStartAt?: string | null;
  cycleEndAt?: string | null;
  lastResetAt?: string | null;
};

type SubscriptionEvent = {
  _id?: string;
  eventType: string;
  channel?: string | null;
  actorType?: string;
  occurredAt?: string;
};

const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleString() : 'N/A');
const toFriendlyLabel = (value?: string) => {
  if (!value) return 'N/A';
  const normalized = value.trim().toLowerCase();
  const known: Record<string, string> = {
    past_due: 'Past Due',
    payment_pending: 'Payment Pending',
    limit_reached: 'Limit Reached',
    super_admin: 'Super Admin',
  };
  if (known[normalized]) return known[normalized];
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export default function BillingInvoicesPage() {
  const { isOpen: isSidebarOpen } = useSidebar();
  const { currentApp } = useApp();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [events, setEvents] = useState<SubscriptionEvent[]>([]);

  const loadData = async () => {
    const appId = currentApp?.id;
    if (!appId) {
      setState(null);
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [stateRes, reportRes] = await Promise.all([
        subscriptionStateService.getAppSubscriptionState(appId),
        subscriptionStateService.getAppSubscriptionReport(appId),
      ]);
      setState(stateRes?.data?.subscriptionState || null);
      setEvents(reportRes?.data?.events || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [currentApp?.id]);

  const billingEvents = useMemo(
    () =>
      (events || []).filter((e) =>
        ['payment_cleared_updated', 'cycle_reset', 'subscription_created', 'entitlements_updated'].includes(e.eventType)
      ),
    [events]
  );

  return (
    <ProtectedRoute>
      <div className="bg-white min-h-screen">
        <Navigation />
        <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Billing & Invoices</h1>
            <p className="text-gray-500 mt-1 text-sm">Billing cycle and invoice history for current app.</p>

            {!currentApp ? (
              <p className="text-sm text-gray-500 mt-6">Select an app to view billing.</p>
            ) : loading ? (
              <div className="mt-6 space-y-4 animate-pulse">
                <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i}>
                      <div className="h-3 w-20 bg-gray-100 rounded mb-2" />
                      <div className="h-4 w-24 bg-gray-100 rounded" />
                    </div>
                  ))}
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="h-5 w-28 bg-gray-100 rounded mb-3" />
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-lg border border-gray-100 px-3 py-2 mb-2">
                      <div className="h-3 w-32 bg-gray-100 rounded mb-2" />
                      <div className="h-3 w-44 bg-gray-100 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Payment Cleared</p>
                    <p className={`text-sm font-semibold ${state?.paymentCleared ? 'text-green-700' : 'text-red-600'}`}>
                      {state?.paymentCleared ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Billing Status</p>
                    <p className="text-sm font-semibold text-gray-900">{toFriendlyLabel(state?.billingStatus)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Cycle Start</p>
                    <p className="text-sm font-semibold text-gray-900">{fmtDate(state?.cycleStartAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Cycle End</p>
                    <p className="text-sm font-semibold text-gray-900">{fmtDate(state?.cycleEndAt)}</p>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-900 mb-2">Billing timeline</p>
                  {billingEvents.length === 0 ? (
                    <p className="text-xs text-gray-500">No billing events yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-auto pr-1">
                      {billingEvents.slice(0, 20).map((event, idx) => (
                        <div key={event._id || `${event.eventType}-${idx}`} className="rounded-lg border border-gray-100 px-3 py-2">
                          <p className="text-xs font-medium text-gray-800">
                            {toFriendlyLabel(event.eventType)}
                            {event.channel ? ` · ${toFriendlyLabel(event.channel)}` : ''}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            {fmtDate(event.occurredAt)}{event.actorType ? ` · ${toFriendlyLabel(event.actorType)}` : ''}
                          </p>
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

