'use client';

import { useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components';
import Navigation from '@/components/Navigation';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAuth } from '@/contexts/AuthContext';
import { appService } from '@/services/appService';
import { packageService } from '@/services/packageService';
import { subscriptionStateService } from '@/services/subscriptionStateService';
import { toast } from 'react-toastify';
import { Camera, ChevronDown, Globe, Phone, Search } from 'lucide-react';

type ChannelKey = 'web' | 'whatsapp' | 'messenger' | 'instagram' | 'voice';

const CHANNELS: ChannelKey[] = ['web', 'whatsapp', 'messenger', 'instagram', 'voice'];
const BILLING_STATUS_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'active', label: 'Active' },
  { value: 'trialing', label: 'Trialing' },
  { value: 'past_due', label: 'Past Due' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'canceled', label: 'Canceled' },
];

interface AdminAppLite {
  id?: string;
  _id?: string;
  name: string;
  industry?: string;
  logo?: string;
  logoUrl?: string;
  image?: string;
  imageUrl?: string;
}

interface PackageLite {
  id?: string;
  _id?: string;
  name: string;
  limits?: {
    chatbotQueries?: number;
    voiceMinutes?: number;
  };
}

interface SubscriptionStateSummary {
  catalogPackageId?: string | null;
  paymentCleared?: boolean;
  billingStatus?: string;
  addons?: { smsVerification?: { enabled?: boolean; limit?: number } };
  channels?: Partial<Record<ChannelKey, { limit?: { maxConversations?: number; unlimited?: boolean } }>>;
}

function defaultLimits() {
  return {
    web: { maxConversations: 0, unlimited: false },
    whatsapp: { maxConversations: 0, unlimited: false },
    messenger: { maxConversations: 0, unlimited: false },
    instagram: { maxConversations: 0, unlimited: false },
    voice: { maxConversations: 0, unlimited: false },
  };
}

const FALLBACK_APP_LOGO = '/branding/no-logo.svg';

const slugifyName = (value: string) =>
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const getAppLogoSrc = (app: AdminAppLite) => {
  const explicitLogo = app.logoUrl || app.logo || app.imageUrl || app.image;
  if (explicitLogo) return explicitLogo;
  const slug = slugifyName(app.name);
  if (!slug) return FALLBACK_APP_LOGO;
  return `/branding/${slug}-logo.png`;
};

export default function AdminSubscriptionsPage() {
  const { isOpen: isSidebarOpen } = useSidebar();
  const { user } = useAuth();
  const [apps, setApps] = useState<AdminAppLite[]>([]);
  const [packages, setPackages] = useState<PackageLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedAppId, setSelectedAppId] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [suppressPackageAutofill, setSuppressPackageAutofill] = useState(false);
  const [appSearchQuery, setAppSearchQuery] = useState('');
  const [isAppDropdownOpen, setIsAppDropdownOpen] = useState(false);
  const [paymentCleared, setPaymentCleared] = useState(true);
  const [billingStatus, setBillingStatus] = useState('manual');
  const [channelLimits, setChannelLimits] = useState(defaultLimits());
  const [smsAddonEnabled, setSmsAddonEnabled] = useState(false);
  const [smsAddonLimit, setSmsAddonLimit] = useState(0);

  const canAccess = user?.role === 'super_admin';

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [appsRes, packageRes] = await Promise.all([appService.getAllAppsForAdmin(), packageService.getPackages()]);
        setApps(appsRes?.data?.apps || []);
        setPackages(packageRes?.data?.packages || []);
      } catch (error: unknown) {
        try {
          // Fallback: avoid hard break if backend route is not deployed/restarted yet.
          const [appsRes, packageRes] = await Promise.all([appService.getApps(), packageService.getPackages()]);
          setApps(appsRes?.data?.apps || []);
          setPackages(packageRes?.data?.packages || []);
          toast.warning('Showing your active apps only. Restart/update backend to load all active apps for super admin.');
        } catch {
          const msg = error instanceof Error ? error.message : 'Failed to load apps/packages';
          toast.error(msg);
        }
      } finally {
        setLoading(false);
      }
    };
    if (canAccess) void loadData();
  }, [canAccess]);

  const selectedPackage = useMemo(
    () => packages.find((pkg) => (pkg._id || pkg.id) === selectedPackageId) || null,
    [packages, selectedPackageId]
  );

  const filteredApps = useMemo(() => {
    const q = appSearchQuery.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter((app) =>
      `${app.name} ${app.industry || ''}`.toLowerCase().includes(q)
    );
  }, [apps, appSearchQuery]);

  const selectedApp = useMemo(
    () => apps.find((app) => (app.id || app._id) === selectedAppId) || null,
    [apps, selectedAppId]
  );

  const formatChannelLabel = (channel: ChannelKey) => {
    if (channel === 'whatsapp') return 'WhatsApp';
    if (channel === 'messenger') return 'Messenger';
    if (channel === 'instagram') return 'Instagram';
    if (channel === 'voice') return 'Voice';
    return 'Web';
  };

  const getChannelLimitLabel = (channel: ChannelKey) => {
    if (channel === 'voice') return 'Voice Minutes Limit';
    return 'Conversation Limit';
  };

  const renderChannelIcon = (channel: ChannelKey) => {
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
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  useEffect(() => {
    if (suppressPackageAutofill) {
      setSuppressPackageAutofill(false);
      return;
    }
    if (!selectedPackage) return;
    const chatbot = Number(selectedPackage?.limits?.chatbotQueries ?? 0);
    const voice = Number(selectedPackage?.limits?.voiceMinutes ?? 0);
    const next = defaultLimits();
    CHANNELS.forEach((channel) => {
      if (channel === 'voice') {
        next.voice.unlimited = voice === -1;
        next.voice.maxConversations = voice === -1 ? 0 : Math.max(0, voice);
      } else {
        next[channel].unlimited = chatbot === -1;
        next[channel].maxConversations = chatbot === -1 ? 0 : Math.max(0, chatbot);
      }
    });
    setChannelLimits(next);
  }, [selectedPackage, suppressPackageAutofill]);

  useEffect(() => {
    const appId = selectedAppId;
    if (!appId) {
      setSelectedPackageId('');
      setPaymentCleared(true);
      setBillingStatus('manual');
      setChannelLimits(defaultLimits());
      setSmsAddonEnabled(false);
      setSmsAddonLimit(0);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const stateRes = await subscriptionStateService.getAdminAppSubscriptionState(appId);
        if (cancelled) return;
        const summary = (stateRes?.data?.subscriptionState || {}) as SubscriptionStateSummary;
        setSuppressPackageAutofill(true);
        setSelectedPackageId(summary.catalogPackageId || '');
        setPaymentCleared(Boolean(summary.paymentCleared));
        setBillingStatus(summary.billingStatus || 'manual');

        const nextLimits = defaultLimits();
        CHANNELS.forEach((channel) => {
          const limit = summary.channels?.[channel]?.limit;
          nextLimits[channel] = {
            maxConversations: Math.max(0, Number(limit?.maxConversations || 0)),
            unlimited: Boolean(limit?.unlimited),
          };
        });
        setChannelLimits(nextLimits);

        const sms = summary.addons?.smsVerification;
        setSmsAddonEnabled(Boolean(sms?.enabled));
        setSmsAddonLimit(Math.max(0, Number(sms?.limit || 0)));
        toast.info('Loaded saved plan for this app');
      } catch {
        // Keep existing form values if fetch fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedAppId]);

  const onAssignPlan = async () => {
    if (!selectedAppId) {
      toast.warning('Select an app first');
      return;
    }
    setSubmitting(true);
    try {
      await subscriptionStateService.assignPlanToApp(selectedAppId, {
        packageId: selectedPackageId || null,
        paymentCleared,
        billingStatus,
        customChannelLimits: channelLimits,
        smsVerificationAddon: {
          enabled: smsAddonEnabled,
          limit: Math.max(0, Number(smsAddonLimit || 0)),
        },
      });
      toast.success('Plan assigned to app successfully');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to assign plan';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!canAccess) {
    return (
      <ProtectedRoute>
        <div className="bg-white min-h-screen">
          <Navigation />
          <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            <div className="max-w-4xl mx-auto px-4 py-8">
              <h1 className="text-2xl font-bold text-gray-900">Plans</h1>
              <p className="text-gray-600 mt-2">You do not have permission to access this page.</p>
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
            <h1 className="text-2xl font-bold text-gray-900">Plans</h1>
            <p className="text-gray-600 mt-1 mb-6">Assign plan and custom channel limits to any app.</p>

            {loading ? (
              <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="h-4 w-20 bg-gray-100 rounded" />
                    <div className="h-11 w-full bg-gray-100 rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-44 bg-gray-100 rounded" />
                    <div className="h-11 w-full bg-gray-100 rounded-lg" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-gray-100 rounded" />
                    <div className="h-11 w-full bg-gray-100 rounded-lg" />
                  </div>
                  <div className="h-11 w-44 bg-gray-100 rounded-lg md:mt-6" />
                </div>
                <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="h-5 w-40 bg-gray-100 rounded" />
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                      <div className="h-5 w-28 bg-gray-100 rounded" />
                      <div className="h-11 w-full bg-gray-100 rounded-lg" />
                      <div className="h-6 w-24 bg-gray-100 rounded-full" />
                    </div>
                  ))}
                </div>
                <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="h-5 w-44 bg-gray-100 rounded" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="h-6 w-24 bg-gray-100 rounded-full" />
                    <div className="h-11 w-full bg-gray-100 rounded-lg" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">App</label>
                    <div className="relative">
                      <button
                        type="button"
                        className="input-field w-full flex items-center justify-between"
                        onClick={() => setIsAppDropdownOpen((prev) => !prev)}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          {selectedApp ? (
                            <>
                              <img
                                src={getAppLogoSrc(selectedApp)}
                                alt={`${selectedApp.name} logo`}
                                className="h-6 w-6 rounded-md border border-gray-200 object-cover shrink-0 bg-white"
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  if (target.src.includes(FALLBACK_APP_LOGO)) return;
                                  target.src = FALLBACK_APP_LOGO;
                                }}
                              />
                              <span className="text-gray-900 truncate">
                                {selectedApp.name} ({selectedApp.industry || 'no-industry'})
                              </span>
                            </>
                          ) : (
                            <span className="text-gray-500">Select an app</span>
                          )}
                        </span>
                        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isAppDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isAppDropdownOpen && (
                        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg p-2">
                          <div className="relative mb-2">
                            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              className="input-field pl-9"
                              placeholder="Search app by name or industry"
                              value={appSearchQuery}
                              onChange={(e) => setAppSearchQuery(e.target.value)}
                            />
                          </div>
                          <div className="max-h-64 overflow-auto space-y-1">
                            {filteredApps.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-gray-500">No apps found</div>
                            ) : (
                              filteredApps.map((app) => {
                                const appId = app.id || app._id;
                                const isSelected = appId === selectedAppId;
                                return (
                                  <button
                                    key={appId}
                                    type="button"
                                    className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 ${
                                      isSelected ? 'bg-[#c01721]/10 text-[#c01721] font-medium' : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                                    onClick={() => {
                                      setSelectedAppId(appId || '');
                                      setIsAppDropdownOpen(false);
                                    }}
                                  >
                                    <img
                                      src={getAppLogoSrc(app)}
                                      alt={`${app.name} logo`}
                                      className="h-6 w-6 rounded-md border border-gray-200 object-cover shrink-0 bg-white"
                                      onError={(e) => {
                                        const target = e.currentTarget;
                                        if (target.src.includes(FALLBACK_APP_LOGO)) return;
                                        target.src = FALLBACK_APP_LOGO;
                                      }}
                                    />
                                    <span className="truncate">
                                      {app.name} ({app.industry || 'no-industry'})
                                    </span>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Catalog Package (optional)</label>
                    <select
                      className="input-field"
                      value={selectedPackageId}
                      onChange={(e) => {
                        setSuppressPackageAutofill(false);
                        setSelectedPackageId(e.target.value);
                      }}
                    >
                      <option value="">No package (custom snapshot only)</option>
                      {packages.map((pkg) => (
                        <option key={pkg._id || pkg.id} value={pkg._id || pkg.id}>
                          {pkg.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Billing Status</label>
                    <select
                      className="input-field"
                      value={billingStatus}
                      onChange={(e) => setBillingStatus(e.target.value)}
                    >
                      {BILLING_STATUS_OPTIONS.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:mt-8">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={paymentCleared}
                        onClick={() => setPaymentCleared((prev) => !prev)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          paymentCleared ? 'bg-[#c01721]' : 'bg-[#c01721]/20'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            paymentCleared ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <div>
                        <p className="text-sm font-medium text-gray-800">Payment Cleared</p>
                        <p className="text-xs text-gray-500">Activate app plan entitlement.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-xl p-4">
                  <h2 className="font-semibold text-gray-900 mb-3">Per-Channel Limits</h2>
                  <div className="space-y-3">
                    {CHANNELS.map((channel) => (
                      <div key={channel} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                        <div className="font-medium text-sm text-gray-800 flex items-center gap-2">
                          <span
                            className={`inline-flex items-center justify-center p-1 rounded-full border ${channelIconClasses(channel)}`}
                          >
                            {renderChannelIcon(channel)}
                          </span>
                          <span>{formatChannelLabel(channel)}</span>
                          <span className="text-[11px] font-normal text-gray-500">
                            ({channel === 'voice' ? 'minutes' : 'conversations'})
                          </span>
                        </div>
                        <input
                          type="number"
                          min={0}
                          className="input-field"
                          value={channelLimits[channel].maxConversations}
                          onChange={(e) => {
                            const parsed = Math.max(0, Number(e.target.value || 0));
                            setChannelLimits((prev) => ({
                              ...prev,
                              [channel]: {
                                ...prev[channel],
                                maxConversations: parsed,
                                unlimited: channel === 'voice' ? false : prev[channel].unlimited,
                              },
                            }));
                          }}
                          disabled={channel !== 'voice' && channelLimits[channel].unlimited}
                          placeholder={channel === 'voice' ? 'Voice minutes' : 'Conversation limit'}
                          title={getChannelLimitLabel(channel)}
                        />
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={channelLimits[channel].unlimited}
                            onClick={() =>
                              setChannelLimits((prev) => ({
                                ...prev,
                                [channel]: { ...prev[channel], unlimited: !prev[channel].unlimited },
                              }))
                            }
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              channelLimits[channel].unlimited ? 'bg-[#c01721]' : 'bg-[#c01721]/20'
                            }`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                channelLimits[channel].unlimited ? 'translate-x-5' : 'translate-x-1'
                              }`}
                            />
                          </button>
                          <span>Unlimited</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-gray-200 rounded-xl p-4">
                  <h2 className="font-semibold text-gray-900 mb-3">SMS Verification Add-on</h2>
                  <p className="text-xs text-gray-500 mb-3">
                    Separate from channel limits. This controls OTP/SMS verification volume only.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={smsAddonEnabled}
                        onClick={() => setSmsAddonEnabled((prev) => !prev)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          smsAddonEnabled ? 'bg-[#c01721]' : 'bg-[#c01721]/20'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            smsAddonEnabled ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <span>Enabled</span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      className="input-field"
                      value={smsAddonLimit}
                      onChange={(e) => setSmsAddonLimit(Math.max(0, Number(e.target.value || 0)))}
                      disabled={!smsAddonEnabled}
                      placeholder="SMS verification limit"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button className="btn-primary" onClick={onAssignPlan} disabled={submitting}>
                    {submitting ? 'Assigning...' : 'Assign Plan to App'}
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

