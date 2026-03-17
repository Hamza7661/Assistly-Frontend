'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAppService } from '@/services';
import { ProtectedRoute, ConfirmModal } from '@/components';
import Navigation from '@/components/Navigation';
import MetaEmbeddedSignupWizard from '@/components/MetaEmbeddedSignupWizard';
import { INDUSTRIES_LIST } from '@/enums/Industry';
import { WhatsappNumberStatus } from '@/enums/WhatsappNumberStatus';
import { useFacebookOAuth } from '@/hooks/useFacebookOAuth';
import {
  Building2,
  Phone,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  MessageCircle,
  ChevronDown,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { toast } from 'react-toastify';

export default function EditAppPage() {
  const router = useRouter();
  const params = useParams();
  const appId = params.appId as string;
  const setupWhatsAppToastRef = useRef(false);
  const { user } = useAuth();
  const { refreshApps } = useApp();
  const { isOpen: isSidebarOpen } = useSidebar();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingWhatsApp, setIsSavingWhatsApp] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'app' | 'whatsapp'>('app');

  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    description: '',
    whatsappOption: 'use-my-number' as 'use-my-number' | 'get-from-twilio',
    whatsappNumber: '',
    instagramBusinessAccountId: '',
    instagramAccessToken: '',
    instagramUsername: ''
  });

  const [whatsappNumberStatus, setWhatsappNumberStatus] = useState<WhatsappNumberStatus | undefined>(
    undefined
  );
  const [whatsappNumberSource, setWhatsappNumberSource] = useState<string | undefined>(undefined);
  const [twilioSubaccountReady, setTwilioSubaccountReady] = useState<boolean | null>(null);
  const [showWhatsAppSetupBanner, setShowWhatsAppSetupBanner] = useState(false);

  const [newNumberCountry, setNewNumberCountry] = useState('US');
  const [availableNumbers, setAvailableNumbers] = useState<
    { phoneNumber: string; friendlyName?: string }[]
  >([]);
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  const [loadingProvision, setLoadingProvision] = useState(false);

  const NEW_NUMBER_COUNTRY_OPTIONS = [
    { code: 'US', label: 'United States', flag: '🇺🇸' },
    { code: 'GB', label: 'United Kingdom', flag: '🇬🇧' },
    { code: 'CA', label: 'Canada', flag: '🇨🇦' },
    { code: 'FR', label: 'France', flag: '🇫🇷' },
  ];

  // ── Persisted Facebook connection (loaded from API) ───────────────
  const [fbConnectedPageId, setFbConnectedPageId] = useState('');
  const [fbConnectedPageName, setFbConnectedPageName] = useState('');
  const [fbTokenExpiry, setFbTokenExpiry] = useState<string | null>(null);
  const [fbSaving, setFbSaving] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  // ── Facebook OAuth ────────────────────────────────────────────────
  const {
    fbSdkReady,
    fbConnecting,
    fbPages,
    fbShortLivedToken,
    fbSelectedPageId,
    fbSelectedPageName,
    handleFacebookConnect,
    resetFacebookSelection,
    setFbSelectedPageId,
    setFbSelectedPageName,
  } = useFacebookOAuth();

  // Load app data
  useEffect(() => {
    const loadApp = async () => {
      try {
        const appService = await useAppService();
        const response = await appService.getApp(appId);

        if (response.status === 'success' && response.data.app) {
          const app = response.data.app;
          setFormData({
            name: app.name || '',
            industry: app.industry || '',
            description: app.description || '',
            whatsappOption:
              app.whatsappNumberSource === 'twilio-provided'
                ? 'get-from-twilio'
                : app.whatsappNumber
                  ? 'use-my-number'
                  : 'get-from-twilio',
            whatsappNumber: app.whatsappNumber || '',
            instagramBusinessAccountId: app.instagramBusinessAccountId || '',
            instagramAccessToken: '', // Don't display existing token for security
            instagramUsername: app.instagramUsername || ''
          });
          setWhatsappNumberStatus(app.whatsappNumberStatus);
          setWhatsappNumberSource(app.whatsappNumberSource);
          setTwilioSubaccountReady(!!app.twilioSubaccountReady);
          // Facebook persisted connection
          setFbConnectedPageId(app.facebookPageId || '');
          setFbConnectedPageName(app.facebookPageName || '');
          setFbTokenExpiry(app.facebookTokenExpiry || null);
        } else {
          setError('Failed to load app details');
          toast.error('Failed to load app');
        }
      } catch (err: any) {
        if (err.response?.data?.message) {
          setError(err.response.data.message);
        } else if (err.message) {
          setError(err.message);
        } else {
          setError('An error occurred while loading the app');
        }
        toast.error('Failed to load app');
      } finally {
        setIsLoading(false);
      }
    };

    if (appId) {
      loadApp();
    }
  }, [appId]);

  useEffect(() => {
    if (typeof window === 'undefined' || setupWhatsAppToastRef.current) return;
    const q = new URLSearchParams(window.location.search).get('setup');
    if (q !== 'whatsapp') return;
    setupWhatsAppToastRef.current = true;
    setActiveTab('whatsapp');
    setShowWhatsAppSetupBanner(true);
    toast.info(
      'Finish WhatsApp setup: get a new number below if needed, then connect Meta. You can return anytime.'
    );
    window.history.replaceState({}, '', window.location.pathname);
  }, [appId]);

  const reloadAppWhatsAppFields = async () => {
    const appService = await useAppService();
    const res = await appService.getApp(appId);
    if (res.status === 'success' && res.data?.app) {
      const app = res.data.app;
      setFormData((prev) => ({
        ...prev,
        whatsappOption:
          app.whatsappNumberSource === 'twilio-provided'
            ? 'get-from-twilio'
            : app.whatsappNumber
              ? 'use-my-number'
              : 'get-from-twilio',
        whatsappNumber: app.whatsappNumber || '',
      }));
      setWhatsappNumberStatus(app.whatsappNumberStatus);
      setWhatsappNumberSource(app.whatsappNumberSource);
      setTwilioSubaccountReady(!!app.twilioSubaccountReady);
    }
  };

  const fetchAvailableNumbersForApp = async () => {
    if (!newNumberCountry || !appId) return;
    setLoadingNumbers(true);
    setAvailableNumbers([]);
    try {
      const appService = await useAppService();
      const res = await appService.getAvailableNumbersForApp(appId, newNumberCountry, 20);
      if (res.status === 'success' && res.data?.numbers) {
        setAvailableNumbers(res.data.numbers);
        if (res.data.numbers.length === 0) {
          toast.info('No numbers available for this country. Try another country.');
        }
      } else {
        toast.error('Could not load numbers. Try again.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to load numbers';
      toast.error(msg);
    } finally {
      setLoadingNumbers(false);
    }
  };

  const handleBuyNumberForApp = async (phoneNumber: string) => {
    setLoadingProvision(true);
    try {
      const appService = await useAppService();
      const res = await appService.provisionNumberForApp(appId, {
        countryCode: newNumberCountry,
        phoneNumber,
      });
      if (res.status === 'success' && res.data?.phoneNumber) {
        toast.success('Number purchased successfully');
        await reloadAppWhatsAppFields();
        setAvailableNumbers([]);
      } else {
        toast.error((res as any).message || 'Failed to purchase number');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to purchase number';
      toast.error(msg);
    } finally {
      setLoadingProvision(false);
    }
  };

  /** Show search/buy until this app has a provisioned WhatsApp number */
  const needsHostedNumberPurchase =
    formData.whatsappOption === 'get-from-twilio' &&
    !(
      whatsappNumberSource === 'twilio-provided' && !!formData.whatsappNumber?.trim()
    );

  const showMetaEmbeddedForNumber =
    !!formData.whatsappNumber?.trim() &&
    (formData.whatsappOption === 'use-my-number' || whatsappNumberSource === 'twilio-provided');

  // ── Facebook OAuth handlers ───────────────────────────────────────

  const handleFacebookSave = async () => {
    if (!fbShortLivedToken || !fbSelectedPageId) {
      toast.error('Please select a Facebook page first.');
      return;
    }
    setFbSaving(true);
    try {
      const appService = await useAppService();
      const res = await appService.connectFacebook(appId, {
        shortLivedToken: fbShortLivedToken,
        pageId: fbSelectedPageId,
        pageName: fbSelectedPageName
      });
      if (res.status === 'success') {
        const updated = res.data.app;
        setFbConnectedPageId(updated.facebookPageId || fbSelectedPageId);
        setFbConnectedPageName(updated.facebookPageName || fbSelectedPageName);
        setFbTokenExpiry(updated.facebookTokenExpiry || null);
        // Clear in-progress state
        resetFacebookSelection();
        toast.success('Facebook page connected successfully!');
        await refreshApps();
      } else {
        toast.error(res.message || 'Failed to connect Facebook page');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect Facebook page');
    } finally {
      setFbSaving(false);
    }
  };

  const handleFacebookDisconnect = () => {
    setShowDisconnectConfirm(true);
  };

  const confirmFacebookDisconnect = async () => {
    setFbSaving(true);
    try {
      const appService = await useAppService();
      const res = await appService.disconnectFacebook(appId);
      if (res.status === 'success') {
        setFbConnectedPageId('');
        setFbConnectedPageName('');
        setFbTokenExpiry(null);
        toast.success('Facebook page disconnected.');
        await refreshApps();
      } else {
        toast.error(res.message || 'Failed to disconnect');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to disconnect');
    } finally {
      setFbSaving(false);
      setShowDisconnectConfirm(false);
    }
  };

  const cancelFbSelection = () => {
    resetFacebookSelection();
  };

  // ── WhatsApp helpers ──────────────────────────────────────────────
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateAppForm = () => {
    if (!formData.name.trim()) {
      setError('App name is required');
      return false;
    }
    if (!formData.industry) {
      setError('Industry is required');
      return false;
    }
    return true;
  };

  const getWhatsAppStatusBadge = (status?: string, hasNumber?: boolean) => {
    const effectiveStatus =
      hasNumber && (status === WhatsappNumberStatus.Pending || !status)
        ? WhatsappNumberStatus.Registered
        : status;
    switch (effectiveStatus) {
      case WhatsappNumberStatus.Registered:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle2 className="h-3 w-3" />
            Registered
          </span>
        );
      case WhatsappNumberStatus.Pending:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        );
      case WhatsappNumberStatus.Failed:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="h-3 w-3" />
            Failed
          </span>
        );
      default:
        return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateAppForm()) return;

    setIsSaving(true);

    try {
      const appService = await useAppService();
      const updateData: any = {
        name: formData.name.trim(),
        industry: formData.industry,
        description: formData.description.trim() || undefined,
        instagramBusinessAccountId: formData.instagramBusinessAccountId.trim() || null,
        instagramAccessToken: formData.instagramAccessToken.trim() || null,
        instagramUsername: formData.instagramUsername.trim() || null
      };

      const response = await appService.updateApp(appId, updateData);

      if (response.status === 'success') {
        toast.success('App updated successfully!');
        await refreshApps();
        await reloadAppWhatsAppFields();
      } else {
        setError(response.message || 'Failed to update app');
      }
    } catch (err: any) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('An error occurred while updating the app');
      }
      toast.error('Failed to update app');
    } finally {
      setIsSaving(false);
    }
  };

  const handleWhatsAppSave = async () => {
    setError('');
    if (formData.whatsappOption === 'use-my-number') {
      if (!formData.whatsappNumber.trim()) {
        setError('WhatsApp number is required when using your own number');
        toast.error('Enter a WhatsApp number or choose Get a new number.');
        return;
      }
    }

    setIsSavingWhatsApp(true);
    try {
      const appService = await useAppService();
      const updateData: Record<string, unknown> = {};

      if (formData.whatsappOption === 'use-my-number') {
        updateData.whatsappNumber = formData.whatsappNumber.trim();
        updateData.whatsappNumberSource = 'user-provided';
        updateData.whatsappNumberStatus = WhatsappNumberStatus.Pending;
      } else if (
        formData.whatsappOption === 'get-from-twilio' &&
        whatsappNumberSource !== 'twilio-provided'
      ) {
        updateData.whatsappNumber = undefined;
        updateData.whatsappNumberSource = 'twilio-provided';
        updateData.whatsappNumberStatus = WhatsappNumberStatus.Pending;
      } else {
        toast.info('Nothing to save — use Search/Buy or Meta below if you need a new number.');
        setIsSavingWhatsApp(false);
        return;
      }

      const response = await appService.updateApp(appId, updateData);
      if (response.status === 'success') {
        toast.success('WhatsApp settings saved');
        await refreshApps();
        await reloadAppWhatsAppFields();
      } else {
        setError(response.message || 'Failed to save');
        toast.error(response.message || 'Failed to save');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to save';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSavingWhatsApp(false);
    }
  };

  // ── Token expiry helpers ──────────────────────────────────────────
  const getFbExpiryInfo = () => {
    if (!fbTokenExpiry) return null;
    const expiry = new Date(fbTokenExpiry);
    const now = new Date();
    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { date: expiry.toLocaleDateString(), daysLeft };
  };

  const fbExpiryInfo = getFbExpiryInfo();
  const fbTokenIsExpiringSoon = fbExpiryInfo ? fbExpiryInfo.daysLeft <= 7 : false;
  const fbTokenIsExpired = fbExpiryInfo ? fbExpiryInfo.daysLeft <= 0 : false;

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="bg-white min-h-screen">
          <Navigation />
          <div
            className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="flex items-center justify-center min-h-[60vh]">
                <div className="loading-spinner"></div>
              </div>
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
        <div
          className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Edit App</h1>
            <p className="text-gray-600 mb-6">
              Update your app details. Each app has its own flows, plans, FAQs, and integrations.
            </p>

            <div className="flex flex-wrap gap-1 mb-8 border-b border-gray-200">
              <button
                type="button"
                onClick={() => setActiveTab('app')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === 'app'
                    ? 'border-[#00bc7d] text-[#00bc7d]'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Building2 className="h-4 w-4" />
                App details
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('whatsapp')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === 'whatsapp'
                    ? 'border-[#00bc7d] text-[#00bc7d]'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp setup
              </button>
            </div>

            {error && <div className="error-message mb-6">{error}</div>}

            {activeTab === 'app' && (
            <form onSubmit={handleSubmit} className="space-y-8">

              {/* ── Basic Info ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    App Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    className="input-field w-full"
                    placeholder="Enter app name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                  />
                </div>

                <div>
                  <label
                    htmlFor="industry"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Industry <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
                    <select
                      id="industry"
                      name="industry"
                      required
                      className="input-field pl-10 w-full"
                      value={formData.industry}
                      onChange={(e) => handleInputChange('industry', e.target.value)}
                    >
                      <option value="">Select an industry</option>
                      {INDUSTRIES_LIST.map((industry) => (
                        <option key={industry.value} value={industry.value}>
                          {industry.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Description (Optional)
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={4}
                    className="input-field w-full"
                    placeholder="Describe your app (optional)"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-600">
                  Phone number, purchasing a new number, and Meta (WABA) are on the{' '}
                  <strong>WhatsApp setup</strong> tab.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('whatsapp')}
                  className="btn-secondary text-sm py-2 px-4 flex items-center gap-2 shrink-0"
                >
                  <MessageCircle className="h-4 w-4" />
                  Open WhatsApp setup
                </button>
              </div>

              {/* ── Facebook Page OAuth ── */}
              <div className="border-t border-gray-200 pt-8">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-6 h-6 rounded-full bg-[#1877F2] flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-sm leading-none">f</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Facebook Page</h3>
                </div>
                <p className="text-sm text-gray-600 mb-5 ml-9">
                  Connect a Facebook Page to route Messenger conversations through this app.
                  Tokens are stored securely on the server — never exposed to the browser.
                </p>

                {/* ─ State A: connected, not in OAuth flow ─ */}
                {fbConnectedPageId && !fbShortLivedToken && (
                  <div className="space-y-3">
                    <div
                      className={`flex items-start gap-3 p-4 rounded-lg border ${
                        fbTokenIsExpired
                          ? 'bg-red-50 border-red-200'
                          : fbTokenIsExpiringSoon
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-green-50 border-green-200'
                      }`}
                    >
                      {fbTokenIsExpired || fbTokenIsExpiringSoon ? (
                        <AlertTriangle
                          className={`h-5 w-5 shrink-0 mt-0.5 ${
                            fbTokenIsExpired ? 'text-red-500' : 'text-amber-500'
                          }`}
                        />
                      ) : (
                        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-semibold truncate ${
                            fbTokenIsExpired
                              ? 'text-red-800'
                              : fbTokenIsExpiringSoon
                              ? 'text-amber-800'
                              : 'text-green-800'
                          }`}
                        >
                          {fbConnectedPageName || fbConnectedPageId}
                        </p>
                        <p
                          className={`text-xs mt-0.5 ${
                            fbTokenIsExpired
                              ? 'text-red-600'
                              : fbTokenIsExpiringSoon
                              ? 'text-amber-600'
                              : 'text-green-600'
                          }`}
                        >
                          Page ID: {fbConnectedPageId}
                        </p>
                        {fbExpiryInfo && (
                          <p
                            className={`text-xs mt-1 ${
                              fbTokenIsExpired
                                ? 'text-red-600 font-medium'
                                : fbTokenIsExpiringSoon
                                ? 'text-amber-600 font-medium'
                                : 'text-gray-500'
                            }`}
                          >
                            {fbTokenIsExpired
                              ? `⚠ Token expired on ${fbExpiryInfo.date} — reconnect to restore Messenger.`
                              : fbTokenIsExpiringSoon
                              ? `⚠ Token expires on ${fbExpiryInfo.date} (${fbExpiryInfo.daysLeft} days) — reconnect soon.`
                              : `Token valid until ${fbExpiryInfo.date} (${fbExpiryInfo.daysLeft} days)`}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleFacebookDisconnect}
                        disabled={fbSaving}
                        className="text-xs text-red-500 hover:text-red-700 underline shrink-0 disabled:opacity-60"
                      >
                        {fbSaving ? 'Removing…' : 'Disconnect'}
                      </button>
                    </div>

                    {/* Reconnect button */}
                    <button
                      type="button"
                      onClick={handleFacebookConnect}
                      disabled={fbConnecting}
                      className="inline-flex items-center gap-2 text-sm text-[#1877F2] hover:underline disabled:opacity-60"
                    >
                      {fbConnecting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      {fbConnecting ? 'Opening Facebook…' : 'Reconnect / Change page'}
                    </button>
                  </div>
                )}

                {/* ─ State B: not connected, not in OAuth flow ─ */}
                {!fbConnectedPageId && !fbShortLivedToken && (
                  <button
                    type="button"
                    onClick={handleFacebookConnect}
                    disabled={fbConnecting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] disabled:opacity-60 text-white font-semibold rounded-lg transition-colors duration-200 text-sm"
                  >
                    {fbConnecting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Connecting…
                      </>
                    ) : (
                      <>
                        <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center shrink-0">
                          <span className="text-[#1877F2] font-bold text-xs leading-none">
                            f
                          </span>
                        </div>
                        Connect with Facebook
                      </>
                    )}
                  </button>
                )}

                {/* ─ State C: OAuth completed, page selection in progress ─ */}
                {fbShortLivedToken && (
                  <div className="space-y-4">
                    {fbPages.length > 1 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select a Facebook Page <span className="text-red-500">*</span>
                        </label>
                        <div className="relative max-w-sm">
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                          <select
                            className="input-field w-full appearance-none pr-10"
                            value={fbSelectedPageId}
                            onChange={(e) => {
                              const pg = fbPages.find((p) => p.id === e.target.value);
                              setFbSelectedPageId(e.target.value);
                              setFbSelectedPageName(pg?.name || '');
                            }}
                          >
                            <option value="">— choose a page —</option>
                            {fbPages.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {fbSelectedPageId && (
                      <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg max-w-sm text-sm text-blue-800">
                        <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
                        <span>
                          Selected: <strong>{fbSelectedPageName}</strong>
                        </span>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleFacebookSave}
                        disabled={fbSaving || !fbSelectedPageId}
                        className="btn-primary flex items-center gap-2 py-2 px-5 text-sm"
                      >
                        {fbSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving…
                          </>
                        ) : (
                          'Save Connection'
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={cancelFbSelection}
                        className="btn-secondary py-2 px-4 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Actions ── */}
              <div className="flex items-center gap-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="btn-secondary"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn-primary flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
            )}

            {activeTab === 'whatsapp' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">
                    WhatsApp setup
                  </h2>
                  <p className="text-sm text-gray-600 mb-6">
                    Choose how you connect WhatsApp, get a new number for this app if needed, then
                    link your Business Account with Meta. You can finish this anytime.
                  </p>
                </div>

                {showWhatsAppSetupBanner && (
                  <div className="flex items-start justify-between gap-3 p-4 bg-[#00bc7d]/10 border border-[#00bc7d]/30 rounded-lg">
                    <p className="text-sm text-gray-800">
                      <strong>Welcome:</strong> Search and buy a number below (if you chose a new
                      number), then use Meta to link your WABA. You can dismiss this and return
                      later.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowWhatsAppSetupBanner(false)}
                      className="shrink-0 text-sm text-gray-600 hover:text-gray-900 underline"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {whatsappNumberStatus && formData.whatsappNumber && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                      <Phone className="h-4 w-4" />
                      <span className="font-medium">Current number:</span>
                      <span className="font-mono">{formData.whatsappNumber}</span>
                      {getWhatsAppStatusBadge(
                        whatsappNumberStatus,
                        !!formData.whatsappNumber?.trim?.()
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      How do you want to use WhatsApp?
                    </label>
                    <div className="space-y-3">
                      <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="whatsappOption"
                          value="use-my-number"
                          checked={formData.whatsappOption === 'use-my-number'}
                          onChange={(e) => handleInputChange('whatsappOption', e.target.value)}
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            Use my WhatsApp number
                          </div>
                          <div className="text-sm text-gray-500">
                            Register your existing number, then connect with Meta
                          </div>
                        </div>
                      </label>

                      <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="whatsappOption"
                          value="get-from-twilio"
                          checked={formData.whatsappOption === 'get-from-twilio'}
                          onChange={(e) => handleInputChange('whatsappOption', e.target.value)}
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">Get a new number</div>
                          <div className="text-sm text-gray-500">
                            Get a new number for this app, then connect with Meta
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {formData.whatsappOption === 'use-my-number' && (
                    <div className="mt-4">
                      <label
                        htmlFor="whatsappNumber"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        WhatsApp number <span className="text-red-500">*</span>
                      </label>
                      <div className="w-full max-w-md">
                        <PhoneInput
                          international
                          defaultCountry={
                            (process.env.NEXT_PUBLIC_DEFAULT_COUNTRY as any) || 'GB'
                          }
                          value={formData.whatsappNumber}
                          onChange={(value) =>
                            handleInputChange('whatsappNumber', value || '')
                          }
                          placeholder="Enter WhatsApp number"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00bc7d] focus:border-transparent outline-none transition-all duration-200"
                        />
                      </div>
                      <p className="mt-3 text-sm text-gray-500 max-w-xl">
                        {formData.whatsappNumber &&
                        whatsappNumberStatus === WhatsappNumberStatus.Registered
                          ? 'Changing the number will require re-registration.'
                          : 'Save below, then complete Meta registration. The number must receive SMS or voice for verification.'}
                      </p>
                    </div>
                  )}

                  {formData.whatsappOption === 'get-from-twilio' && (
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600">
                        If you just switched from &quot;Use my number&quot;, click{' '}
                        <strong>Save WhatsApp settings</strong> first. Then search and buy a number.
                      </p>
                      {twilioSubaccountReady === false && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-sm text-amber-900">
                            Phone provisioning isn&apos;t ready for this app yet. Try again later or
                            contact support.
                          </p>
                        </div>
                      )}
                      {twilioSubaccountReady === true && needsHostedNumberPurchase && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-800 mb-3">
                            Search for a number, then purchase (carrier and usage charges may apply).
                            After that, connect Meta below.
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="text-sm font-medium text-gray-700">Country</label>
                            <select
                              value={newNumberCountry}
                              onChange={(e) => {
                                setNewNumberCountry(e.target.value);
                                setAvailableNumbers([]);
                              }}
                              className="input-field w-auto min-w-[200px]"
                            >
                              {NEW_NUMBER_COUNTRY_OPTIONS.map((c) => (
                                <option key={c.code} value={c.code}>
                                  {c.flag} {c.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={fetchAvailableNumbersForApp}
                              disabled={loadingNumbers}
                              className="btn-secondary flex items-center gap-2"
                            >
                              {loadingNumbers ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : null}
                              Search available numbers
                            </button>
                          </div>
                          {availableNumbers.length > 0 && (
                            <div className="mt-4">
                              <p className="text-sm font-medium text-gray-700 mb-2">
                                Available numbers — select one to buy
                              </p>
                              <ul className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-48 overflow-y-auto bg-white">
                                {availableNumbers.map((n) => (
                                  <li
                                    key={n.phoneNumber}
                                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                                  >
                                    <span className="font-mono text-sm text-gray-800">
                                      {n.phoneNumber}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleBuyNumberForApp(n.phoneNumber)}
                                      disabled={loadingProvision}
                                      className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5"
                                    >
                                      {loadingProvision ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : null}
                                      Buy this number
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                      {twilioSubaccountReady === true &&
                        !needsHostedNumberPurchase &&
                        !!formData.whatsappNumber?.trim() && (
                          <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-semibold text-green-800">
                                Number for this app
                              </p>
                              <p className="text-sm text-green-700 font-mono mt-0.5">
                                {formData.whatsappNumber}
                              </p>
                            </div>
                          </div>
                        )}
                    </div>
                  )}

                  {showMetaEmbeddedForNumber && (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">
                        WhatsApp Business (Meta)
                      </h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Link this number to your WhatsApp Business Account (WABA).
                      </p>
                      <MetaEmbeddedSignupWizard
                        appId={appId}
                        phoneNumber={formData.whatsappNumber.trim()}
                        onSuccess={async () => {
                          await refreshApps();
                          await reloadAppWhatsAppFields();
                        }}
                        onError={(msg) => {
                          setError(msg);
                          toast.error(msg);
                        }}
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-4 pt-6 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={handleWhatsAppSave}
                      disabled={isSavingWhatsApp}
                      className="btn-primary flex items-center gap-2"
                    >
                      {isSavingWhatsApp ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save WhatsApp settings'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('app')}
                      className="btn-secondary"
                    >
                      Back to app details
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDisconnectConfirm}
        onClose={() => {
          if (!fbSaving) setShowDisconnectConfirm(false);
        }}
        onConfirm={confirmFacebookDisconnect}
        title="Disconnect Facebook Page"
        message="Are you sure you want to remove the Facebook Page connection from this app? Messenger routing from this page will stop until you reconnect."
        confirmText="Disconnect"
        cancelText="Cancel"
        confirmButtonClass="btn-danger"
        isLoading={fbSaving}
      />
    </ProtectedRoute>
  );
}
