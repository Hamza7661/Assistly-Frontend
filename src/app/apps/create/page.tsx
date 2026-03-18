'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAppService } from '@/services';
import { ProtectedRoute } from '@/components';
import Navigation from '@/components/Navigation';
import AppCreationProgressModal from '@/components/AppCreationProgressModal';
import { INDUSTRIES_LIST } from '@/enums/Industry';
import { useFacebookOAuth } from '@/hooks/useFacebookOAuth';
import MetaEmbeddedSignupWizard from '@/components/MetaEmbeddedSignupWizard';
import { Building2, Loader2, ChevronDown, CheckCircle2, XCircle, MessageCircle } from 'lucide-react';
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

  const canOpenSetupSteps = !!createdAppId;

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

  const handleCreateApp = async () => {
    setError('');

    if (!validateAppStep()) {
      return;
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
      } else {
        setShowProgress(false);
        setError(response.message || 'Failed to create app');
        setIsLoading(false);
        // Disconnect socket on error
        if (socket) {
          socket.disconnect();
          setSocket(null);
        }
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

  const handleWhatsAppSave = async () => {
    if (!createdAppId) return;
    setError('');

    if (whatsAppData.whatsappOption === 'use-my-number' && !whatsAppData.whatsappNumber.trim()) {
      setError('WhatsApp number is required when using your own number');
      toast.error('Enter a WhatsApp number or choose Get a new number.');
      return;
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
      } else {
        const msg = response.message || 'Failed to save WhatsApp settings';
        setError(msg);
        toast.error(msg);
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Failed to save WhatsApp settings');
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchTwilioNumbers = async () => {
    if (!createdAppId) return;
    setWhatsAppData((p) => ({ ...p, searching: true, availableNumbers: [], selectedTwilioNumber: '' }));
    try {
      const appService = await useAppService();
      const res = await appService.getAvailableNumbersForApp(createdAppId, whatsAppData.countryCode, 10);
      if (res.status === 'success' && res.data?.numbers) {
        setWhatsAppData((p) => ({
          ...p,
          availableNumbers: res.data.numbers,
          selectedTwilioNumber: res.data.numbers[0]?.phoneNumber || '',
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

  const handleFacebookSave = async () => {
    if (!createdAppId) return;
    if (!fbShortLivedToken || !fbSelectedPageId) {
      toast.error('Connect Facebook and select a page first');
      return;
    }
    setIsLoading(true);
    try {
      const appService = await useAppService();
      const res = await appService.connectFacebook(createdAppId, {
        shortLivedToken: fbShortLivedToken,
        pageId: fbSelectedPageId,
        pageName: fbSelectedPageName || '',
      });
      if (res.status === 'success') {
        setFacebookSaved(true);
        toast.success('Facebook page linked');
      } else {
        toast.error(res.message || 'Failed to link Facebook page');
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to link Facebook page'));
    } finally {
      setIsLoading(false);
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
                    ? 'border-[#00bc7d] text-[#00bc7d]'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Building2 className="h-4 w-4" />
                App
                {appSaved ? <CheckCircle2 className="h-4 w-4" /> : null}
              </button>
              <button
                type="button"
                onClick={() => canOpenSetupSteps && setActiveStep('whatsapp')}
                disabled={!canOpenSetupSteps}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  activeStep === 'whatsapp'
                    ? 'border-[#00bc7d] text-[#00bc7d]'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
                {whatsAppSaved ? <CheckCircle2 className="h-4 w-4" /> : null}
              </button>
              <button
                type="button"
                onClick={() => canOpenSetupSteps && setActiveStep('facebook')}
                disabled={!canOpenSetupSteps}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  activeStep === 'facebook'
                    ? 'border-[#00bc7d] text-[#00bc7d]'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-[#1877F2] flex items-center justify-center shrink-0">
                  <span className="text-white font-bold text-[10px] leading-none">f</span>
                </div>
                Facebook
                {facebookSaved ? <CheckCircle2 className="h-4 w-4" /> : null}
              </button>
            </div>

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
                    type="button"
                    onClick={handleCreateApp}
                    disabled={isLoading}
                    className="btn-primary flex items-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : createdAppId ? (
                      'Created'
                    ) : (
                      'Create'
                    )}
                  </button>
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
                              checked={whatsAppData.whatsappOption === 'use-my-number'}
                              onChange={(e) =>
                                setWhatsAppData((p) => ({ ...p, whatsappOption: e.target.value as any }))
                              }
                              className="mr-3"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">Use my WhatsApp number</div>
                              <div className="text-sm text-gray-500">
                                Register your existing WhatsApp number for messaging
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
                              <div className="font-medium text-gray-900">Buy a new number</div>
                              <div className="text-sm text-gray-500">
                                Purchase a number and connect your WhatsApp Business Account (WABA)
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
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00bc7d] focus:border-transparent outline-none transition-all duration-200"
                            />
                          </div>
                          <p className="mt-3 text-sm text-gray-500">
                            Make sure the number can receive SMS or voice calls for verification.
                          </p>
                        </div>
                      )}

                      {whatsAppData.whatsappOption === 'get-from-twilio' && (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
                          <div className="flex flex-wrap items-end gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Country
                              </label>
                              <input
                                value={whatsAppData.countryCode}
                                onChange={(e) =>
                                  setWhatsAppData((p) => ({
                                    ...p,
                                    countryCode: e.target.value.toUpperCase().slice(0, 2),
                                  }))
                                }
                                className="input-field w-24"
                                placeholder="GB"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleSearchTwilioNumbers}
                              disabled={whatsAppData.searching}
                              className="btn-secondary flex items-center gap-2"
                            >
                              {whatsAppData.searching ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : null}
                              Search numbers
                            </button>
                          </div>

                          {whatsAppData.availableNumbers.length > 0 && !whatsAppData.provisionedNumber && (
                            <div className="space-y-3">
                              <div className="relative max-w-md">
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                <select
                                  className="input-field w-full appearance-none pr-10"
                                  value={whatsAppData.selectedTwilioNumber}
                                  onChange={(e) =>
                                    setWhatsAppData((p) => ({ ...p, selectedTwilioNumber: e.target.value }))
                                  }
                                >
                                  {whatsAppData.availableNumbers.map((n) => (
                                    <option key={n.phoneNumber} value={n.phoneNumber}>
                                      {n.friendlyName || n.phoneNumber}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <button
                                type="button"
                                onClick={handleBuyTwilioNumber}
                                disabled={whatsAppData.provisioning}
                                className="btn-primary flex items-center gap-2"
                              >
                                {whatsAppData.provisioning ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : null}
                                Buy number
                              </button>
                            </div>
                          )}

                          {whatsAppData.provisionedNumber && (
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 text-green-700 text-sm">
                                <CheckCircle2 className="h-4 w-4" />
                                Number purchased: <span className="font-medium">{whatsAppData.provisionedNumber}</span>
                              </div>

                              <MetaEmbeddedSignupWizard
                                appId={createdAppId}
                                phoneNumber={whatsAppData.provisionedNumber}
                                onSuccess={({ senderSid, wabaId }) => {
                                  setWhatsAppData((p) => ({ ...p, senderSid, wabaId }));
                                  setWhatsAppSaved(true);
                                }}
                                onError={(message) => setError(message)}
                                onSkip={() => {
                                  setWhatsAppSaved(true);
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 pt-6 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => setActiveStep('app')}
                        className="btn-secondary"
                        disabled={isLoading}
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handleWhatsAppSave}
                        disabled={isLoading}
                        className="btn-primary flex items-center gap-2"
                      >
                        {isLoading ? (
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
                        onClick={() => setActiveStep('facebook')}
                        disabled={!canOpenSetupSteps}
                        className="btn-secondary"
                      >
                        Next
                      </button>
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
                        <div className="w-6 h-6 rounded-full bg-[#1877F2] flex items-center justify-center shrink-0">
                          <span className="text-white font-bold text-sm leading-none">f</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">Facebook</h3>
                          <p className="text-sm text-gray-600">
                            Link a Facebook Page to route Messenger conversations through this app.
                          </p>
                        </div>
                      </div>

                      <div className="mt-5">
                        {!fbShortLivedToken && (
                          <button
                            type="button"
                            onClick={handleFacebookConnect}
                            disabled={fbConnecting || !fbSdkReady}
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

                    <div className="flex items-center gap-4 pt-6 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => setActiveStep('whatsapp')}
                        className="btn-secondary"
                        disabled={isLoading}
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handleFacebookSave}
                        disabled={isLoading}
                        className="btn-primary flex items-center gap-2"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save'
                        )}
                      </button>
                      {createdAppId ? (
                        <button
                          type="button"
                          onClick={() => router.push(`/apps/${createdAppId}/edit`)}
                          className="btn-secondary"
                        >
                          Open app
                        </button>
                      ) : null}
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
