'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAppService, useIntegrationService } from '@/services';
import { ProtectedRoute } from '@/components';
import Navigation from '@/components/Navigation';
import AppCreationProgressModal from '@/components/AppCreationProgressModal';
import { INDUSTRIES_LIST } from '@/enums/Industry';
import { useFacebookOAuth } from '@/hooks/useFacebookOAuth';
import MetaEmbeddedSignupWizard from '@/components/MetaEmbeddedSignupWizard';
import {
  AppStepIcon,
  WhatsAppStepIcon,
  FacebookStepIcon,
  FacebookButtonIcon,
} from '@/components/StepperBrandIcons';
import { Listbox } from '@headlessui/react';
import { Building2, Loader2, ChevronDown, Check, CheckCircle2, XCircle } from 'lucide-react';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { toast } from 'react-toastify';
import { io, Socket } from 'socket.io-client';

type StepKey = 'app' | 'whatsapp' | 'facebook';

function getErrorMessage(err: unknown, fallback: string) {
  const e = err as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message || e?.message || fallback;
}

export default function CreateAppPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { refreshApps, switchApp } = useApp();
  const { isOpen: isSidebarOpen } = useSidebar();
  const [isLoading, setIsLoading] = useState(false);
  const [fbSaving, setFbSaving] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [error, setError] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const createdAppIdRef = useRef<string | null>(null);

  const [activeStep, setActiveStep] = useState<StepKey>('app');
  const [createdAppId, setCreatedAppId] = useState<string | null>(null);
  const [appSaved, setAppSaved] = useState(false);
  const [whatsAppSaved, setWhatsAppSaved] = useState(false);
  const [facebookSaved, setFacebookSaved] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    description: '',
  });

  const [leadCaptureSettings, setLeadCaptureSettings] = useState({
    validateEmail: true,
    validatePhoneNumber: true,
    conversationStyle: false,
  });

  const [whatsAppData, setWhatsAppData] = useState({
    whatsappOption: 'use-my-number' as 'use-my-number' | 'get-from-twilio',
    whatsappNumber: '',
    countryCode:
      (process.env.NEXT_PUBLIC_DEFAULT_COUNTRY as string | undefined)?.toUpperCase() || 'GB',
    availableNumbers: [] as { phoneNumber: string; friendlyName?: string }[],
    selectedTwilioNumber: '',
    provisioning: false,
    searching: false,
    provisionedNumber: '',
    senderSid: '',
    wabaId: '',
  });
  const [numberSearch, setNumberSearch] = useState('');

  const canOpenSetupSteps = !!createdAppId;

  const COUNTRY_OPTIONS = [
    { code: 'US', label: 'United States', flagUrl: 'https://flagcdn.com/w20/us.png' },
    { code: 'GB', label: 'United Kingdom', flagUrl: 'https://flagcdn.com/w20/gb.png' },
    { code: 'CA', label: 'Canada', flagUrl: 'https://flagcdn.com/w20/ca.png' },
    { code: 'FR', label: 'France', flagUrl: 'https://flagcdn.com/w20/fr.png' },
  ];
  const selectedCountry =
    COUNTRY_OPTIONS.find((c) => c.code === whatsAppData.countryCode) || COUNTRY_OPTIONS[0];

  const whatsappStepDisabledHint =
    'Create your app first. WhatsApp needs an app ID to save your number, get a new number for this app, and connect with Meta.';
  const facebookStepDisabledHint =
    'Create your app first. Facebook needs an app ID to securely link your Page to this app.';

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    };
  }, [socket]);

  // Initialize WebSocket connection ONLY when creating app (lazy loading)
  const initializeSocket = () => {
    if (!socket && user?._id) {
      const socketUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';
      const newSocket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnection: false, // Don't auto-reconnect
      });

      newSocket.on('connect', () => {
        console.log('WebSocket connected for app creation');
        newSocket.emit('join', user._id);
      });

      newSocket.on('app_creation_progress', (data) => {
        // Dispatch custom event for progress modal
        window.dispatchEvent(new CustomEvent('app_creation_progress', { detail: data }));
      });

      setSocket(newSocket);
    }
  };

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    };
  }, [socket]);

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

  const handleFacebookRemove = () => {
    resetFacebookSelection();
  };

  // ── Form handlers ─────────────────────────────────────────────────
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateAppStep = () => {
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

  const handleCreateApp = async (): Promise<boolean> => {
    setError('');

    if (!validateAppStep()) {
      return false;
    }

    // Initialize WebSocket only when user clicks submit (lazy loading for performance)
    initializeSocket();

    setIsLoading(true);
    setShowProgress(true);

    try {
      const appService = await useAppService();
      const response = await appService.createApp({
        name: formData.name.trim(),
        industry: formData.industry,
        description: formData.description.trim() || undefined,
      });

      if (response.status === 'success' && response.data.app) {
        createdAppIdRef.current = response.data.app.id;
        setIsLoading(false);
        return true;
      } else {
        setShowProgress(false);
        setError(response.message || 'Failed to create app');
        setIsLoading(false);
        // Disconnect socket on error
        if (socket) {
          socket.disconnect();
          setSocket(null);
        }
        return false;
      }
    } catch (err: unknown) {
      setShowProgress(false);
      setError(getErrorMessage(err, 'An error occurred while creating the app'));
      toast.error('Failed to create app');
      setIsLoading(false);
      // Disconnect socket on error
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return false;
    }
  };


  const handleProgressComplete = async () => {
    try {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      const newId = createdAppIdRef.current;
      await refreshApps();
      if (newId) {
        await switchApp(newId);
      }
      toast.success('App created successfully!');
      if (newId) {
        setCreatedAppId(newId);
        setAppSaved(true);
        setActiveStep('whatsapp');
      }
      setShowProgress(false);

      // Persist app-level lead capture settings (kept in Integration settings).
      if (newId) {
        try {
          const integrationSvc = await useIntegrationService();
          await integrationSvc.updateSettings(newId, {
            validateEmail: !!leadCaptureSettings.validateEmail,
            validatePhoneNumber: !!leadCaptureSettings.validatePhoneNumber,
            conversationStyle: !!leadCaptureSettings.conversationStyle,
          });
        } catch (e: any) {
          toast.error(e?.message || 'Failed to save lead capture settings');
        }
      }
    } catch (error) {
      console.error('Error during progress complete:', error);
      setShowProgress(false);
    }
  };

  const handleProgressError = (errorMsg: string) => {
    setShowProgress(false);
    setError(errorMsg);
    setIsLoading(false);
    toast.error(errorMsg);
    
    // Disconnect socket on error
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  };

  const handleWhatsAppSave = async (): Promise<boolean> => {
    if (!createdAppId) return false;
    setError('');

    if (whatsAppData.whatsappOption === 'use-my-number' && !whatsAppData.whatsappNumber.trim()) {
      setError('WhatsApp number is required when using your own number');
      toast.error('Enter a WhatsApp number or choose Get a new number.');
      return false;
    }

    setIsLoading(true);
    try {
      const appService = await useAppService();
      const response = await appService.updateApp(createdAppId, {
        whatsappNumber:
          whatsAppData.whatsappOption === 'use-my-number'
            ? whatsAppData.whatsappNumber.trim()
            : whatsAppData.provisionedNumber || undefined,
        whatsappNumberSource:
          whatsAppData.whatsappOption === 'use-my-number' ? 'user-provided' : 'twilio-provided',
        ...(whatsAppData.senderSid
          ? { twilioWhatsAppSenderId: whatsAppData.senderSid }
          : {}),
      });
      if (response.status === 'success') {
        setWhatsAppSaved(true);
        toast.success('WhatsApp settings saved');
        return true;
      } else {
        const msg = response.message || 'Failed to save WhatsApp settings';
        setError(msg);
        toast.error(msg);
        return false;
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Failed to save WhatsApp settings');
      setError(msg);
      toast.error(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchTwilioNumbers = async () => {
    if (!createdAppId) return;
    setNumberSearch('');
    setWhatsAppData((p) => ({ ...p, searching: true, availableNumbers: [], selectedTwilioNumber: '' }));
    try {
      const appService = await useAppService();
      const res = await appService.getAvailableNumbersForApp(createdAppId, whatsAppData.countryCode, 20);
      if (res.status === 'success' && res.data?.numbers) {
        const normalize = (s: string) => (s || '').replace(/[^\d+]/g, '').trim();
        const seen = new Set<string>();
        const unique = (res.data.numbers || []).filter((n) => {
          const key = normalize(n.phoneNumber);
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setWhatsAppData((p) => ({
          ...p,
          availableNumbers: unique,
          selectedTwilioNumber: unique[0]?.phoneNumber || '',
        }));
      } else {
        toast.error(res.message || 'Could not load available numbers');
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Could not load available numbers'));
    } finally {
      setWhatsAppData((p) => ({ ...p, searching: false }));
    }
  };

  const uniqueAvailableNumbers = (() => {
    const seen = new Set<string>();
    const out: { phoneNumber: string; friendlyName?: string }[] = [];
    for (const n of whatsAppData.availableNumbers) {
      const key = (n.phoneNumber || '').replace(/[^\d+]/g, '').trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(n);
    }
    return out;
  })();

  const filteredAvailableNumbers =
    numberSearch.trim().length === 0
      ? uniqueAvailableNumbers
      : uniqueAvailableNumbers.filter((n) => {
          const q = numberSearch.trim().toLowerCase();
          return (
            n.phoneNumber.toLowerCase().includes(q) ||
            (n.friendlyName || '').toLowerCase().includes(q)
          );
        });

  const handleBuyTwilioNumber = async () => {
    if (!createdAppId) return;
    const phoneNumber = whatsAppData.selectedTwilioNumber || undefined;
    setWhatsAppData((p) => ({ ...p, provisioning: true }));
    try {
      const appService = await useAppService();
      const res = await appService.provisionNumberForApp(createdAppId, {
        countryCode: whatsAppData.countryCode,
        ...(phoneNumber ? { phoneNumber } : {}),
      });
      if (res.status === 'success' && res.data?.phoneNumber) {
        setWhatsAppData((p) => ({ ...p, provisionedNumber: res.data.phoneNumber }));
        toast.success('Number purchased');
      } else {
        toast.error(res.message || 'Failed to purchase number');
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to purchase number'));
    } finally {
      setWhatsAppData((p) => ({ ...p, provisioning: false }));
    }
  };

  const handleFacebookSave = async (
    pageIdOverride?: string,
    pageNameOverride?: string
  ): Promise<boolean> => {
    if (!createdAppId) return false;
    const pageId = pageIdOverride ?? fbSelectedPageId;
    const pageName = pageNameOverride ?? fbSelectedPageName;
    if (!fbShortLivedToken || !pageId) {
      toast.error('Connect Facebook and select a page first');
      return false;
    }
    setFbSaving(true);
    try {
      const appService = await useAppService();
      const res = await appService.connectFacebook(createdAppId, {
        shortLivedToken: fbShortLivedToken,
        pageId,
        pageName: pageName || '',
      });
      if (res.status === 'success') {
        setFacebookSaved(true);
        toast.success('Facebook page linked');
        return true;
      } else {
        toast.error(res.message || 'Failed to link Facebook page');
        return false;
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to link Facebook page'));
      return false;
    } finally {
      setFbSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="bg-white min-h-screen">
        <Navigation />
        <AppCreationProgressModal 
          isOpen={showProgress}
          onComplete={handleProgressComplete}
          onError={handleProgressError}
        />
        <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Create New App</h1>
            <p className="text-gray-600 mb-8">
              Create a new app and select its industry. Each app has its own flows, plans, FAQs, and
              integrations.
            </p>

            <div className="flex flex-wrap gap-1 mb-8 border-b border-gray-200">
              <button
                type="button"
                onClick={() => setActiveStep('app')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeStep === 'app'
                    ? 'border-[#c01721] text-[#c01721]'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <AppStepIcon active={activeStep === 'app'} />
                App
                {appSaved ? <CheckCircle2 className="h-4 w-4" /> : null}
              </button>
              <span className="relative inline-flex">
                <button
                  type="button"
                  onClick={() => canOpenSetupSteps && setActiveStep('whatsapp')}
                  disabled={!canOpenSetupSteps}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    activeStep === 'whatsapp'
                      ? 'border-[#c01721] text-[#c01721]'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <WhatsAppStepIcon className={activeStep === 'whatsapp' ? '' : 'opacity-55'} />
                  WhatsApp
                  {whatsAppSaved ? <CheckCircle2 className="h-4 w-4" /> : null}
                </button>
                {!canOpenSetupSteps && (
                  <span
                    className="absolute inset-0 z-[1] cursor-help"
                    title={whatsappStepDisabledHint}
                    aria-hidden
                  />
                )}
              </span>
              <span className="relative inline-flex">
                <button
                  type="button"
                  onClick={() => canOpenSetupSteps && setActiveStep('facebook')}
                  disabled={!canOpenSetupSteps}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    activeStep === 'facebook'
                      ? 'border-[#c01721] text-[#c01721]'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <FacebookStepIcon className={activeStep === 'facebook' ? '' : 'opacity-55'} />
                  Facebook
                  {facebookSaved ? <CheckCircle2 className="h-4 w-4" /> : null}
                </button>
                {!canOpenSetupSteps && (
                  <span
                    className="absolute inset-0 z-[1] cursor-help"
                    title={facebookStepDisabledHint}
                    aria-hidden
                  />
                )}
              </span>
            </div>
            {!canOpenSetupSteps && (
              <p className="text-xs text-gray-500 mt-1 mb-6 max-w-2xl">
                <strong className="font-medium text-gray-600">WhatsApp</strong> and{' '}
                <strong className="font-medium text-gray-600">Facebook</strong> unlock after you
                create the app. Hover each step for why.
              </p>
            )}

            {error && <div className="error-message mb-6">{error}</div>}

            {activeStep === 'app' && (
              <div className="space-y-8">
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

                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">Lead capture rules</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        These settings apply across Web, WhatsApp, Messenger, and Instagram for this app.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-gray-900 text-sm">Validate Email</div>
                          <div className="text-xs text-gray-600 mt-1">Require valid email when users provide email addresses.</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={leadCaptureSettings.validateEmail}
                            onChange={(e) => setLeadCaptureSettings((p) => ({ ...p, validateEmail: e.target.checked }))}
                          />
                          <div className="brand-toggle-track"></div>
                        </label>
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-gray-900 text-sm">Validate Phone Number</div>
                          <div className="text-xs text-gray-600 mt-1">Require valid phone number when users provide phone numbers.</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={leadCaptureSettings.validatePhoneNumber}
                            onChange={(e) => setLeadCaptureSettings((p) => ({ ...p, validatePhoneNumber: e.target.checked }))}
                          />
                          <div className="brand-toggle-track"></div>
                        </label>
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-gray-900 text-sm">Conversational Style</div>
                          <div className="text-xs text-gray-600 mt-1">When enabled, the bot uses free-form conversation.</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={leadCaptureSettings.conversationStyle}
                            onChange={(e) => setLeadCaptureSettings((p) => ({ ...p, conversationStyle: e.target.checked }))}
                          />
                          <div className="brand-toggle-track"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="btn-secondary"
                    disabled={isLoading}
                  >
                    Back
                  </button>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        if (createdAppId) {
                          setActiveStep('whatsapp');
                          return;
                        }
                        await handleCreateApp();
                      }}
                      disabled={isLoading}
                      className="btn-save flex items-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : createdAppId ? (
                        'Saved'
                      ) : (
                        'Save & Next'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeStep === 'whatsapp' && (
              <div className="space-y-8">
                {!createdAppId ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                    Create the app first to continue.
                  </div>
                ) : (
                  <>
                    <div className="space-y-6">
                      <div className="flex items-start gap-3">
                        <WhatsAppStepIcon className="mt-0.5 shrink-0" />
                        <div>
                          <h2 className="text-lg font-semibold text-gray-900 mb-1">WhatsApp</h2>
                          <p className="text-sm text-gray-600">
                            Choose a WhatsApp number (use yours or buy a new one), then connect your business. You can finish anytime.
                          </p>
                        </div>
                      </div>

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
                              checked={whatsAppData.whatsappOption === 'use-my-number'}
                              onChange={(e) =>
                                setWhatsAppData((p) => ({ ...p, whatsappOption: e.target.value as any }))
                              }
                              className="mr-3"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">Use my WhatsApp number</div>
                              <div className="text-sm text-gray-500">
                                Register your existing number
                              </div>
                            </div>
                          </label>

                          <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                            <input
                              type="radio"
                              name="whatsappOption"
                              value="get-from-twilio"
                              checked={whatsAppData.whatsappOption === 'get-from-twilio'}
                              onChange={(e) =>
                                setWhatsAppData((p) => ({ ...p, whatsappOption: e.target.value as any }))
                              }
                              className="mr-3"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">Get a new number</div>
                              <div className="text-sm text-gray-500">
                                Get a new number for this app
                              </div>
                            </div>
                          </label>
                        </div>
                      </div>

                      {whatsAppData.whatsappOption === 'use-my-number' && (
                        <div className="mt-2">
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
                              value={whatsAppData.whatsappNumber}
                              onChange={(value) =>
                                setWhatsAppData((p) => ({ ...p, whatsappNumber: value || '' }))
                              }
                              placeholder="Enter WhatsApp number"
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c01721] focus:border-transparent outline-none transition-all duration-200"
                            />
                          </div>
                          <p className="mt-3 text-sm text-gray-500">
                            This number must be able to receive a verification code (SMS or call).
                          </p>
                        </div>
                      )}

                      {whatsAppData.whatsappOption === 'get-from-twilio' && (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
                          <p className="text-sm text-gray-700">
                            Search for a number, then purchase (carrier and usage charges may apply). After that, connect WhatsApp Business below.
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-[minmax(280px,1fr)_auto] items-end gap-3">
                            <div className="min-w-0">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Country
                              </label>
                              <Listbox
                                value={selectedCountry}
                                onChange={(c) =>
                                  setWhatsAppData((p) => ({
                                    ...p,
                                    countryCode: c.code,
                                    availableNumbers: [],
                                    selectedTwilioNumber: '',
                                  }))
                                }
                              >
                                <div className="relative w-full min-w-0">
                                  <Listbox.Button className="input-field relative w-full pr-10 h-11 flex items-center gap-2">
                                    <img
                                      src={selectedCountry.flagUrl}
                                      alt=""
                                      className="h-4 w-5 rounded-sm border border-gray-200 bg-white"
                                    />
                                    <span className="text-sm text-gray-800">
                                      {selectedCountry.label} ({selectedCountry.code})
                                    </span>
                                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                  </Listbox.Button>
                                  <Listbox.Options className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg focus:outline-none">
                                    {COUNTRY_OPTIONS.map((c) => (
                                      <Listbox.Option
                                        key={c.code}
                                        value={c}
                                        className={({ active }) =>
                                          `flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                                            active ? 'bg-gray-50' : 'bg-white'
                                          }`
                                        }
                                      >
                                        {({ selected }) => (
                                          <>
                                            <img
                                              src={c.flagUrl}
                                              alt=""
                                              className="h-4 w-5 rounded-sm border border-gray-200 bg-white"
                                            />
                                            <span className="flex-1 text-gray-800">
                                              {c.label} ({c.code})
                                            </span>
                                            {selected ? <Check className="h-4 w-4 text-[#c01721]" /> : null}
                                          </>
                                        )}
                                      </Listbox.Option>
                                    ))}
                                  </Listbox.Options>
                                </div>
                              </Listbox>
                            </div>
                            <button
                              type="button"
                              onClick={handleSearchTwilioNumbers}
                              disabled={whatsAppData.searching}
                              className="btn-secondary flex items-center gap-2 h-11"
                            >
                              {whatsAppData.searching ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : null}
                              Search numbers
                            </button>
                            <div className="min-w-0">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Number
                              </label>
                              <Listbox
                                value={whatsAppData.selectedTwilioNumber}
                                onChange={(value) =>
                                  setWhatsAppData((p) => ({ ...p, selectedTwilioNumber: value }))
                                }
                                disabled={uniqueAvailableNumbers.length === 0 || !!whatsAppData.provisionedNumber}
                              >
                                <div className="relative w-full min-w-0">
                                  <Listbox.Button className="input-field relative w-full pr-10 h-11 flex items-center disabled:opacity-60">
                                    <span className="text-sm text-gray-800">
                                      {whatsAppData.selectedTwilioNumber ? (
                                        <span className="font-mono">{whatsAppData.selectedTwilioNumber}</span>
                                      ) : uniqueAvailableNumbers.length === 0 ? (
                                        'Search to load numbers'
                                      ) : (
                                        'Select a number'
                                      )}
                                    </span>
                                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                  </Listbox.Button>
                                  {uniqueAvailableNumbers.length > 0 && !whatsAppData.provisionedNumber && (
                                    <Listbox.Options className="absolute z-20 bottom-full mb-2 w-full min-w-[360px] max-h-72 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg focus:outline-none">
                                      <div className="sticky top-0 bg-white border-b border-gray-100 p-2">
                                        <input
                                          value={numberSearch}
                                          onChange={(e) => setNumberSearch(e.target.value)}
                                          placeholder="Search numbers…"
                                          className="input-field w-full h-10 py-2 text-sm"
                                        />
                                      </div>
                                      {filteredAvailableNumbers.map((n) => (
                                        <Listbox.Option
                                          key={n.phoneNumber}
                                          value={n.phoneNumber}
                                          className={({ active }) =>
                                            `flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm ${
                                              active ? 'bg-gray-50' : 'bg-white'
                                            }`
                                          }
                                        >
                                          {({ selected }) => (
                                            <>
                                              <div className="flex-1 min-w-0">
                                                <div className="font-mono text-gray-900 truncate">{n.phoneNumber}</div>
                                              {(() => {
                                                const pd = (n.phoneNumber || '').replace(/\D/g, '');
                                                const fd = (n.friendlyName || '').replace(/\D/g, '');
                                                const same =
                                                  !!pd &&
                                                  !!fd &&
                                                  (pd === fd ||
                                                    pd.endsWith(fd) ||
                                                    fd.endsWith(pd));
                                                if (!n.friendlyName || same) return null;
                                                return (
                                                  <div className="text-xs text-gray-500 truncate">{n.friendlyName}</div>
                                                );
                                              })()}
                                              </div>
                                              {selected ? (
                                                <Check className="h-4 w-4 text-[#c01721]" />
                                              ) : null}
                                            </>
                                          )}
                                        </Listbox.Option>
                                      ))}
                                    </Listbox.Options>
                                  )}
                                </div>
                              </Listbox>
                            </div>
                            <button
                              type="button"
                              onClick={handleBuyTwilioNumber}
                              disabled={whatsAppData.provisioning || !whatsAppData.selectedTwilioNumber}
                              className="btn-primary flex items-center gap-2 h-11"
                            >
                              {whatsAppData.provisioning ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : null}
                              Buy number
                            </button>
                          </div>

                          {whatsAppData.provisionedNumber && (
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 text-green-700 text-sm">
                                <CheckCircle2 className="h-4 w-4" />
                                Number purchased: <span className="font-medium">{whatsAppData.provisionedNumber}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Meta Embedded Signup (show always; enable once a number is available) */}
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">
                          Connect WhatsApp Business
                        </h4>
                        <p className="text-sm text-gray-600 mb-4">
                          Sign in with Facebook to connect this number to your WhatsApp business.
                        </p>
                        {(() => {
                          const phoneNumber =
                            whatsAppData.whatsappOption === 'use-my-number'
                              ? whatsAppData.whatsappNumber?.trim()
                              : whatsAppData.provisionedNumber?.trim();
                          if (!phoneNumber) {
                            return (
                              <div className="rounded-lg border border-gray-200 bg-white p-4">
                                <p className="text-sm text-gray-700">
                                  Buy a number above or enter your existing number first. Then you can attach your
                                  business and complete Meta signup here.
                                </p>
                                <button
                                  type="button"
                                  disabled
                                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1877F2] px-4 py-2.5 text-sm font-medium text-white opacity-50 cursor-not-allowed"
                                  title="Add or buy a number to continue"
                                >
                                  Continue with Facebook
                                </button>
                              </div>
                            );
                          }
                          return (
                            <MetaEmbeddedSignupWizard
                              appId={createdAppId}
                              phoneNumber={phoneNumber}
                              onSuccess={({ senderSid, wabaId }) => {
                                setWhatsAppData((p) => ({ ...p, senderSid, wabaId }));
                                setWhatsAppSaved(true);
                              }}
                              onError={(message) => setError(message)}
                            />
                          );
                        })()}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-6 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => setActiveStep('app')}
                        className="btn-secondary"
                        disabled={isLoading}
                      >
                        Back
                      </button>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await handleWhatsAppSave();
                            if (ok) setActiveStep('facebook');
                          }}
                          disabled={isLoading}
                          className="btn-save flex items-center gap-2"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            'Save & Next'
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeStep === 'facebook' && (
              <div className="space-y-8">
                {!createdAppId ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                    Create the app first to continue.
                  </div>
                ) : (
                  <>
                    <div className="border border-gray-200 rounded-lg p-5">
                      <div className="flex items-center gap-3 mb-1">
                        <FacebookStepIcon className="shrink-0" />
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">Facebook</h3>
                          <p className="text-sm text-gray-600">
                            Connect your Facebook Page so Messenger conversations show up in this app.
                          </p>
                        </div>
                      </div>

                      <div className="mt-5">
                        {!fbShortLivedToken && (
                          <button
                            type="button"
                            onClick={handleFacebookConnect}
                            disabled={fbConnecting || !fbSdkReady || fbSaving}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] disabled:opacity-60 text-white font-semibold rounded-lg transition-colors duration-200 text-sm"
                          >
                            {fbConnecting ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Connecting…
                              </>
                            ) : (
                              <>
                                <FacebookButtonIcon />
                                Connect
                              </>
                            )}
                          </button>
                        )}

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
                                      const nextId = e.target.value;
                                      const pg = fbPages.find((p) => p.id === nextId);
                                      const nextName = pg?.name || '';
                                      setFbSelectedPageId(nextId);
                                      setFbSelectedPageName(nextName);
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

                            <button
                              type="button"
                              onClick={handleFacebookConnect}
                              disabled={fbConnecting}
                              className="text-sm text-[#1877F2] hover:underline flex items-center gap-1 disabled:opacity-60"
                            >
                              {fbConnecting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                          <FacebookStepIcon className="scale-[0.85]" />
                              )}
                              Use a different Facebook account
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-6 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => {
                          if (fbShortLivedToken) resetFacebookSelection();
                          setActiveStep('whatsapp');
                        }}
                        className="btn-secondary"
                        disabled={isLoading}
                      >
                        Back
                      </button>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={async () => {
                            await handleFacebookSave();
                          }}
                          disabled={fbSaving || !fbShortLivedToken || !fbSelectedPageId}
                          className="btn-save flex items-center gap-2"
                        >
                          {fbSaving ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            'Save'
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => router.push('/settings/chatbot')}
                          disabled={isLoading || fbSaving}
                          className="btn-primary flex items-center gap-2"
                        >
                          Go to Settings
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
