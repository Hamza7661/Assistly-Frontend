'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAppService } from '@/services';
import { ProtectedRoute } from '@/components';
import Navigation from '@/components/Navigation';
import { INDUSTRIES_LIST } from '@/enums/Industry';
import {
  FACEBOOK_APP_ID,
  FACEBOOK_API_VERSION,
  FACEBOOK_SDK_SRC,
  FACEBOOK_LOGIN_SCOPE,
  FACEBOOK_POLL_INTERVAL_MS,
} from '@/constants/facebook';
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

// Facebook SDK global — loaded asynchronously
declare const FB: any;

interface FbPage {
  id: string;
  name: string;
  access_token: string;
}

export default function EditAppPage() {
  const router = useRouter();
  const params = useParams();
  const appId = params.appId as string;
  const { user } = useAuth();
  const { refreshApps } = useApp();
  const { isOpen: isSidebarOpen } = useSidebar();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

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

  const [whatsappNumberStatus, setWhatsappNumberStatus] = useState<string | undefined>(undefined);
  const [whatsappNumberSource, setWhatsappNumberSource] = useState<string | undefined>(undefined);

  // ── Persisted Facebook connection (loaded from API) ───────────────
  const [fbConnectedPageId, setFbConnectedPageId] = useState('');
  const [fbConnectedPageName, setFbConnectedPageName] = useState('');
  const [fbTokenExpiry, setFbTokenExpiry] = useState<string | null>(null);

  // ── Facebook OAuth (in-progress) state ───────────────────────────
  const [fbSdkReady, setFbSdkReady] = useState(false);
  const [fbConnecting, setFbConnecting] = useState(false);
  const [fbSaving, setFbSaving] = useState(false);
  const [fbPages, setFbPages] = useState<FbPage[]>([]);
  const [fbShortLivedToken, setFbShortLivedToken] = useState('');
  const [fbSelectedPageId, setFbSelectedPageId] = useState('');
  const [fbSelectedPageName, setFbSelectedPageName] = useState('');
  const fbPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
            whatsappOption: app.whatsappNumber ? 'use-my-number' : 'get-from-twilio',
            whatsappNumber: app.whatsappNumber || '',
            instagramBusinessAccountId: app.instagramBusinessAccountId || '',
            instagramAccessToken: '', // Don't display existing token for security
            instagramUsername: app.instagramUsername || ''
          });
          setWhatsappNumberStatus(app.whatsappNumberStatus);
          setWhatsappNumberSource(app.whatsappNumberSource);
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

  // Load Facebook SDK
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initSdk = () => {
      try {
        (window as any).FB.init({
          appId: FACEBOOK_APP_ID,
          cookie: true,
          xfbml: false,
          version: FACEBOOK_API_VERSION
        });
        setFbSdkReady(true);
      } catch (_) {}
    };

    if (typeof (window as any).FB !== 'undefined') {
      initSdk();
      return;
    }

    (window as any).fbAsyncInit = initSdk;

    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = FACEBOOK_SDK_SRC;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    fbPollRef.current = setInterval(() => {
      if (typeof (window as any).FB !== 'undefined') {
        clearInterval(fbPollRef.current!);
        setFbSdkReady(true);
      }
    }, FACEBOOK_POLL_INTERVAL_MS);

    return () => {
      if (fbPollRef.current) clearInterval(fbPollRef.current);
    };
  }, []);

  // ── Facebook OAuth handlers ───────────────────────────────────────
  const handleFacebookConnect = () => {
    const FBSdk = (window as any).FB;
    if (!FBSdk) {
      toast.error('Facebook SDK is still loading. Please try again in a moment.');
      return;
    }

    setFbConnecting(true);
    setFbPages([]);
    setFbShortLivedToken('');
    setFbSelectedPageId('');
    setFbSelectedPageName('');

    FBSdk.login(
      (response: any) => {
        if (!response.authResponse) {
          setFbConnecting(false);
          return;
        }
        const token = response.authResponse.accessToken;
        FBSdk.api(
          '/me/accounts',
          { access_token: token, fields: 'id,name,access_token' },
          (pagesRes: any) => {
            setFbConnecting(false);
            if (pagesRes.error || !pagesRes.data) {
              toast.error(
                pagesRes?.error?.message ||
                'Could not fetch your Facebook pages. Please ensure you granted the required permissions.'
              );
              return;
            }
            const pages: FbPage[] = pagesRes.data;
            if (pages.length === 0) {
              toast.error('No Facebook pages found. Make sure you admin at least one page.');
              return;
            }
            setFbShortLivedToken(token);
            setFbPages(pages);
            if (pages.length === 1) {
              setFbSelectedPageId(pages[0].id);
              setFbSelectedPageName(pages[0].name);
            }
          }
        );
      },
      { scope: FACEBOOK_LOGIN_SCOPE }
    );
  };

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
        setFbPages([]);
        setFbShortLivedToken('');
        setFbSelectedPageId('');
        setFbSelectedPageName('');
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

  const handleFacebookDisconnect = async () => {
    if (!confirm('Remove the Facebook page connection from this app?')) return;
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
    }
  };

  const cancelFbSelection = () => {
    setFbShortLivedToken('');
    setFbPages([]);
    setFbSelectedPageId('');
    setFbSelectedPageName('');
  };

  // ── WhatsApp helpers ──────────────────────────────────────────────
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('App name is required');
      return false;
    }
    if (!formData.industry) {
      setError('Industry is required');
      return false;
    }
    if (formData.whatsappOption === 'use-my-number' && !formData.whatsappNumber.trim()) {
      setError('WhatsApp number is required when using your own number');
      return false;
    }
    return true;
  };

  const getWhatsAppStatusBadge = (status?: string, hasNumber?: boolean) => {
    const effectiveStatus =
      hasNumber && (status === 'pending' || !status) ? 'registered' : status;
    switch (effectiveStatus) {
      case 'registered':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle2 className="h-3 w-3" />
            Registered
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        );
      case 'failed':
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

    if (!validateForm()) return;

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

      // Handle WhatsApp number updates
      if (formData.whatsappOption === 'use-my-number') {
        if (formData.whatsappNumber.trim() !== formData.whatsappNumber) {
          updateData.whatsappNumber = formData.whatsappNumber.trim();
          updateData.whatsappNumberSource = 'user-provided';
          updateData.whatsappNumberStatus = 'pending';
        }
      } else if (
        formData.whatsappOption === 'get-from-twilio' &&
        whatsappNumberSource !== 'twilio-provided'
      ) {
        updateData.whatsappNumber = undefined;
        updateData.whatsappNumberSource = 'twilio-provided';
        updateData.whatsappNumberStatus = 'pending';
      }

      const response = await appService.updateApp(appId, updateData);

      if (response.status === 'success') {
        toast.success('App updated successfully!');
        await refreshApps();
        router.push('/apps');
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
            <p className="text-gray-600 mb-8">
              Update your app details. Each app has its own flows, plans, FAQs, and integrations.
            </p>

            <form onSubmit={handleSubmit} className="space-y-8">
              {error && <div className="error-message">{error}</div>}

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

              {/* ── WhatsApp ── */}
              <div className="border-t border-gray-200 pt-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">
                  WhatsApp Number Configuration
                </h3>

                {whatsappNumberStatus && formData.whatsappNumber && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Phone className="h-4 w-4" />
                      <span className="font-medium">Current Number:</span>
                      <span>{formData.whatsappNumber}</span>
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
                      Choose WhatsApp number option:
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
                            Register your existing WhatsApp number with Twilio
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
                          <div className="font-medium text-gray-900">
                            Get a number from Twilio
                          </div>
                          <div className="text-sm text-gray-500">
                            Twilio will provide a phone number for WhatsApp
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
                        WhatsApp Number <span className="text-red-500">*</span>
                      </label>
                      <div className="w-full">
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
                      <p className="mt-3 text-sm text-gray-500">
                        {formData.whatsappNumber && whatsappNumberStatus === 'registered'
                          ? 'Changing the number will require re-registration with Twilio.'
                          : 'Your number will be registered with Twilio for WhatsApp messaging. Make sure the number can receive SMS or voice calls for verification.'}
                      </p>
                    </div>
                  )}

                  {formData.whatsappOption === 'get-from-twilio' && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        {whatsappNumberSource === 'twilio-provided'
                          ? 'A Twilio phone number is already configured for this app.'
                          : 'A Twilio phone number will be automatically provisioned and registered for WhatsApp when you save. The registration process may take a few minutes to complete.'}
                      </p>
                    </div>
                  )}
                </div>
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
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
