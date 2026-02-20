'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAppService } from '@/services';
import { ProtectedRoute } from '@/components';
import Navigation from '@/components/Navigation';
import { INDUSTRIES_LIST } from '@/enums/Industry';
import { Building2, Phone, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { toast } from 'react-toastify';

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
    whatsappNumber: ''
  });

  const [whatsappNumberStatus, setWhatsappNumberStatus] = useState<string | undefined>(undefined);
  const [whatsappNumberSource, setWhatsappNumberSource] = useState<string | undefined>(undefined);

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
            whatsappNumber: app.whatsappNumber || ''
          });
          setWhatsappNumberStatus(app.whatsappNumberStatus);
          setWhatsappNumberSource(app.whatsappNumberSource);
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
    const effectiveStatus = hasNumber && (status === 'pending' || !status) ? 'registered' : status;
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

    if (!validateForm()) {
      return;
    }

    setIsSaving(true);

    try {
      const appService = await useAppService();
      const updateData: any = {
        name: formData.name.trim(),
        industry: formData.industry,
        description: formData.description.trim() || undefined
      };

      // Handle WhatsApp number updates
      if (formData.whatsappOption === 'use-my-number') {
        updateData.whatsappNumber = formData.whatsappNumber.trim();
        updateData.whatsappNumberSource = 'user-provided';
        updateData.whatsappNumberStatus = 'pending';
      } else if (formData.whatsappOption === 'get-from-twilio' && whatsappNumberSource !== 'twilio-provided') {
        // User wants to switch to Twilio-provided number
        updateData.whatsappNumber = undefined;
        updateData.whatsappNumberSource = 'twilio-provided';
        updateData.whatsappNumberStatus = 'pending';
      }

      const response = await appService.updateApp(appId, updateData);

      if (response.status === 'success') {
        toast.success('App updated successfully!');
        // Refresh apps list
        await refreshApps();
        // Redirect back to apps page
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

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="bg-white min-h-screen">
          <Navigation />
          <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
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
        <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Edit App</h1>
            <p className="text-gray-600 mb-8">Update your app details. Each app has its own flows, plans, FAQs, and integrations.</p>

            <form onSubmit={handleSubmit} className="space-y-8">
              {error && <div className="error-message">{error}</div>}

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
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
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

            <div className="border-t border-gray-200 pt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">WhatsApp Number Configuration</h3>
              
              {whatsappNumberStatus && formData.whatsappNumber && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Phone className="h-4 w-4" />
                    <span className="font-medium">Current Number:</span>
                    <span>{formData.whatsappNumber}</span>
                    {getWhatsAppStatusBadge(whatsappNumberStatus, !!formData.whatsappNumber?.trim?.())}
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
                        <div className="font-medium text-gray-900">Use my WhatsApp number</div>
                        <div className="text-sm text-gray-500">Register your existing WhatsApp number with Twilio</div>
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
                        <div className="text-sm text-gray-500">Twilio will provide a phone number for WhatsApp</div>
                      </div>
                    </label>
                  </div>
                </div>

                {formData.whatsappOption === 'use-my-number' && (
                  <div className="mt-4">
                    <label htmlFor="whatsappNumber" className="block text-sm font-medium text-gray-700 mb-2">
                      WhatsApp Number <span className="text-red-500">*</span>
                    </label>
                    <div className="w-full">
                      <PhoneInput
                        international
                        defaultCountry={(process.env.NEXT_PUBLIC_DEFAULT_COUNTRY as any) || "GB"}
                        value={formData.whatsappNumber}
                        onChange={(value) => handleInputChange('whatsappNumber', value || '')}
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
