'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
import { Building2, Loader2, ChevronDown, CheckCircle2, XCircle } from 'lucide-react';
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

export default function CreateAppPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { refreshApps, switchApp } = useApp();
  const { isOpen: isSidebarOpen } = useSidebar();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    description: '',
    whatsappOption: 'use-my-number' as 'use-my-number' | 'get-from-twilio',
    whatsappNumber: ''
  });

  // ── Facebook OAuth state ──────────────────────────────────────────
  const [fbSdkReady, setFbSdkReady] = useState(false);
  const [fbConnecting, setFbConnecting] = useState(false);
  const [fbPages, setFbPages] = useState<FbPage[]>([]);
  const [fbShortLivedToken, setFbShortLivedToken] = useState('');
  const [fbSelectedPageId, setFbSelectedPageId] = useState('');
  const [fbSelectedPageName, setFbSelectedPageName] = useState('');
  const fbPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    // Poll until FB global becomes available (handles async load timing)
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

  // ── Facebook handlers ─────────────────────────────────────────────
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
          // User cancelled or denied
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
            // Auto-select when there is only one page
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

  const handleFacebookRemove = () => {
    setFbShortLivedToken('');
    setFbPages([]);
    setFbSelectedPageId('');
    setFbSelectedPageName('');
  };

  // ── Form handlers ─────────────────────────────────────────────────
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const appService = await useAppService();
      const response = await appService.createApp({
        name: formData.name.trim(),
        industry: formData.industry,
        description: formData.description.trim() || undefined,
        whatsappOption: formData.whatsappOption,
        whatsappNumber:
          formData.whatsappOption === 'use-my-number'
            ? formData.whatsappNumber.trim()
            : undefined,
        // Facebook OAuth tokens — backend will exchange & store (non-fatal if it fails)
        ...(fbShortLivedToken && fbSelectedPageId
          ? {
              facebookShortLivedToken: fbShortLivedToken,
              facebookPageId: fbSelectedPageId,
              facebookPageName: fbSelectedPageName
            }
          : {})
      });

      if (response.status === 'success' && response.data.app) {
        toast.success('App created successfully!');
        await switchApp(response.data.app.id);
        await refreshApps();
        router.push('/apps');
      } else {
        setError(response.message || 'Failed to create app');
      }
    } catch (err: any) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('An error occurred while creating the app');
      }
      toast.error('Failed to create app');
    } finally {
      setIsLoading(false);
    }
  };

  const fbIsConnected = !!(fbShortLivedToken && fbSelectedPageId);

  return (
    <ProtectedRoute>
      <div className="bg-white min-h-screen">
        <Navigation />
        <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Create New App</h1>
            <p className="text-gray-600 mb-8">
              Create a new app and select its industry. Each app has its own flows, plans, FAQs, and
              integrations.
            </p>

            <form onSubmit={handleSubmit} className="space-y-8">
              {error && <div className="error-message">{error}</div>}

              {/* ── Basic Info ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
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
                  <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-2">
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
                  WhatsApp Number Configuration (Optional)
                </h3>

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
                          <div className="font-medium text-gray-900">Use my WhatsApp number</div>
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
                          <div className="font-medium text-gray-900">Get a number from Twilio</div>
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
                          onChange={(value) => handleInputChange('whatsappNumber', value || '')}
                          placeholder="Enter WhatsApp number"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00bc7d] focus:border-transparent outline-none transition-all duration-200"
                        />
                      </div>
                      <p className="mt-3 text-sm text-gray-500">
                        Your number will be registered with Twilio for WhatsApp messaging. Make
                        sure the number can receive SMS or voice calls for verification.
                      </p>
                    </div>
                  )}

                  {formData.whatsappOption === 'get-from-twilio' && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        A Twilio phone number will be automatically provisioned and registered for
                        WhatsApp when you create this app. The registration process may take a few
                        minutes to complete.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Facebook Page (Optional OAuth) ── */}
              <div className="border-t border-gray-200 pt-8">
                <div className="flex items-center gap-3 mb-1">
                  {/* Facebook "f" logo */}
                  <div className="w-6 h-6 rounded-full bg-[#1877F2] flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-sm leading-none">f</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Facebook Page</h3>
                  <span className="text-sm font-normal text-gray-400">(Optional)</span>
                </div>
                <p className="text-sm text-gray-600 mb-5 ml-9">
                  Connect a Facebook Page to route Messenger conversations through this app. You can
                  also connect or change it later from the Edit App screen.
                </p>

                <div className="ml-0">
                  {/* Not yet OAuth'd */}
                  {!fbShortLivedToken && (
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
                            <span className="text-[#1877F2] font-bold text-xs leading-none">f</span>
                          </div>
                          Connect with Facebook
                        </>
                      )}
                    </button>
                  )}

                  {/* OAuth completed — page selection */}
                  {fbShortLivedToken && (
                    <div className="space-y-4">
                      {/* Multiple pages — show selector */}
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

                      {/* Selected page confirmation */}
                      {fbSelectedPageId && (
                        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg max-w-sm">
                          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-green-800 truncate">
                              {fbSelectedPageName}
                            </p>
                            <p className="text-xs text-green-600">Page ID: {fbSelectedPageId}</p>
                          </div>
                          <button
                            type="button"
                            onClick={handleFacebookRemove}
                            className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
                            title="Remove Facebook connection"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      )}

                      {/* Change account link */}
                      <button
                        type="button"
                        onClick={handleFacebookConnect}
                        disabled={fbConnecting}
                        className="text-sm text-[#1877F2] hover:underline flex items-center gap-1 disabled:opacity-60"
                      >
                        {fbConnecting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full bg-[#1877F2] flex items-center justify-center shrink-0">
                            <span className="text-white font-bold text-[8px] leading-none">f</span>
                          </div>
                        )}
                        Use a different Facebook account
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Actions ── */}
              <div className="flex items-center gap-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="btn-secondary"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create App'
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
