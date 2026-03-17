'use client';

import { useState, useEffect } from 'react';
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
import { Building2, Loader2, ChevronDown, CheckCircle2, XCircle, Phone } from 'lucide-react';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { toast } from 'react-toastify';
import { io, Socket } from 'socket.io-client';

const NEW_NUMBER_COUNTRY_OPTIONS = [
  { code: 'US', label: 'United States', flag: '🇺🇸' },
  { code: 'GB', label: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', label: 'Canada', flag: '🇨🇦' },
  { code: 'FR', label: 'France', flag: '🇫🇷' },
];

export default function CreateAppPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { refreshApps, switchApp } = useApp();
  const { isOpen: isSidebarOpen } = useSidebar();
  const [isLoading, setIsLoading] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [error, setError] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    description: '',
    whatsappOption: 'use-my-number' as 'use-my-number' | 'get-from-twilio',
    whatsappNumber: ''
  });

  // Get a new number flow: country, available numbers, and purchased number (no provider name in UI)
  const [newNumberCountry, setNewNumberCountry] = useState('US');
  const [availableNumbers, setAvailableNumbers] = useState<{ phoneNumber: string; friendlyName?: string }[]>([]);
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  const [loadingProvision, setLoadingProvision] = useState(false);
  const [provisionedNumber, setProvisionedNumber] = useState<string | null>(null);

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
    if (field === 'whatsappOption' && value === 'use-my-number') {
      setProvisionedNumber(null);
      setAvailableNumbers([]);
    }
  };

  const fetchAvailableNumbers = async () => {
    if (!newNumberCountry) return;
    setLoadingNumbers(true);
    setAvailableNumbers([]);
    try {
      const appService = await useAppService();
      const res = await appService.getAvailableNumbers(newNumberCountry, 20);
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

  const handleBuyNumber = async (phoneNumber: string) => {
    setLoadingProvision(true);
    try {
      const appService = await useAppService();
      const res = await appService.provisionNumber({
        countryCode: newNumberCountry,
        phoneNumber,
      });
      if (res.status === 'success' && res.data?.phoneNumber) {
        setProvisionedNumber(res.data.phoneNumber);
        toast.success('Number purchased successfully');
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

    if (!validateForm()) {
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
        whatsappOption: formData.whatsappOption,
        whatsappNumber:
          formData.whatsappOption === 'use-my-number'
            ? formData.whatsappNumber.trim()
            : undefined,
        ...(formData.whatsappOption === 'get-from-twilio' && provisionedNumber
          ? { twilioPhoneNumber: provisionedNumber.trim() }
          : {}),
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
        setIsLoading(false);
        // Keep progress modal open; seed data runs in background and sends progress via WebSocket.
        // Modal will call onComplete (handleProgressComplete) when it receives step === 'complete'.
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
    } catch (err: any) {
      setShowProgress(false);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('An error occurred while creating the app');
      }
      toast.error('Failed to create app');
      setIsLoading(false);
      // Disconnect socket on error
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      // Disconnect socket on error
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    }
  };


  const handleProgressComplete = async () => {
    try {
      // Disconnect socket after completion
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      
      // Refresh apps and switch to the new one
      await refreshApps();
      const apps = JSON.parse(localStorage.getItem('apps') || '[]');
      if (apps.length > 0) {
        const newestApp = apps[0]; // Assuming newest is first
        await switchApp(newestApp.id);
      }
      toast.success('App created successfully!');
      router.push('/apps');
    } catch (error) {
      console.error('Error during progress complete:', error);
      router.push('/apps');
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

  const fbIsConnected = !!(fbShortLivedToken && fbSelectedPageId);

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
                            Register your existing WhatsApp number for messaging
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
                            Select a country and number, then connect your Business profile and WABA
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
                        Your number will be registered for WhatsApp messaging. Make sure the number
                        can receive SMS or voice calls for verification.
                      </p>
                    </div>
                  )}

                  {formData.whatsappOption === 'get-from-twilio' && (
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800">
                          Select a country and number below. After creating the app, use Meta
                          Embedded Signup to register this number with your WhatsApp Business
                          account (Business profile and WABA).
                        </p>
                      </div>
                      {!provisionedNumber ? (
                        <>
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
                              onClick={fetchAvailableNumbers}
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
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-2">
                                Available numbers — select one to purchase
                              </p>
                              <ul className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-48 overflow-y-auto">
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
                                      onClick={() => handleBuyNumber(n.phoneNumber)}
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
                        </>
                      ) : (
                        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-green-800">Number purchased</p>
                            <p className="text-sm text-green-700 flex items-center gap-1 mt-0.5">
                              <Phone className="h-4 w-4" />
                              {provisionedNumber}
                            </p>
                            <p className="text-xs text-green-600 mt-1">
                              After creating the app, use Meta Embedded Signup to register this
                              number with your WhatsApp Business account.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setProvisionedNumber(null);
                              setAvailableNumbers([]);
                            }}
                            className="text-sm text-gray-500 hover:text-gray-700 underline"
                          >
                            Choose different number
                          </button>
                        </div>
                      )}
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
