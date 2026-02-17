'use client';

import { useEffect, useState } from 'react';
import Navigation from '@/components/Navigation';
import { ProtectedRoute } from '@/components';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useSubscriptionService, usePackageService } from '@/services';
import { getCountryInfo, Region } from '@/enums/Region';
import { detectCountryCode } from '@/utils/countryDetection';
import {
  Crown,
  CreditCard,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  TrendingUp,
  Plus
} from 'lucide-react';
import { toast } from 'react-toastify';
import { User } from '@/models/User';
import styles from '../dashboard/styles.module.css';

export default function PricingPage() {
  const { user, updateUser } = useAuth();
  const { isOpen: isSidebarOpen } = useSidebar();
  const [subscription, setSubscription] = useState<any>(null);
  const [packageInfo, setPackageInfo] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [detectedCountryCode, setDetectedCountryCode] = useState<string | null>(null);

  useEffect(() => {
    if (user?._id) {
      loadSubscription();
      loadPackages();
      detectAndSetRegion();
    }
  }, [user?._id]);

  useEffect(() => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    if (params?.get('subscription') === 'success') {
      toast.success('Subscription updated successfully!');
      window.history.replaceState({}, '', '/pricing');
    } else if (params?.get('subscription') === 'canceled') {
      toast.info('Checkout was canceled.');
      window.history.replaceState({}, '', '/pricing');
    }
  }, []);

  const detectAndSetRegion = async () => {
    try {
      const countryResult = await detectCountryCode();
      const countryInfo = getCountryInfo(countryResult.countryCode);
      setDetectedCountryCode(countryResult.countryCode);
      if (user && (!user.region || user.region === Region.UK || user.region === 'uk') && countryInfo.region !== Region.UK) {
        try {
          const { useAuthService } = await import('@/services');
          const authService = await useAuthService();
          const response = await authService.updateUserProfile(user._id, { region: countryInfo.region });
          if (response.status === 'success') updateUser(new User(response.data.user));
        } catch (e) {
          console.error('Failed to update region:', e);
        }
      }
    } catch (e) {
      console.error('Failed to detect region:', e);
    }
  };

  const loadSubscription = async () => {
    if (!user?._id) {
      setLoading(false);
      return;
    }
    try {
      const service = await useSubscriptionService();
      const response = await service.getMySubscription();
      setSubscription(response.data.subscription);
      setPackageInfo(response.data.package);
    } catch (e: any) {
      console.error('Failed to load subscription:', e);
      toast.error('Failed to load subscription information');
    } finally {
      setLoading(false);
    }
  };

  const loadPackages = async () => {
    try {
      const packageService = await usePackageService();
      const response = await packageService.getPackages();
      setPackages(response.data.packages || []);
    } catch (e: any) {
      console.error('Failed to load packages:', e);
    }
  };

  const handleManageSubscription = async () => {
    setProcessing(true);
    try {
      const service = await useSubscriptionService();
      const response = await service.createPortalSession();
      if (response.data.url) window.location.href = response.data.url;
    } catch (e: any) {
      const msg = e.message || '';
      if (msg.includes('Stripe is not configured') || msg.includes('STRIPE_SECRET_KEY')) {
        toast.info('⏰ Coming Soon! Subscription management is on the way.');
      } else {
        toast.error(msg || 'Failed to open subscription management');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handlePackageUpgrade = (pkg: any) => {
    // Redirect to Upzilo contact page for all package upgrades
    window.open('https://upzilo.com/contact/', '_blank');
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatPriceInLocalCurrency = (usdAmount: number) => {
    let countryCode: string | null = detectedCountryCode || null;
    if (!countryCode && user?.region) {
      if (user.region === Region.UK || user.region === 'uk') countryCode = 'GB';
      else if (user.region === Region.US || user.region === 'us') countryCode = 'US';
      else if (user.region === Region.EU || user.region === 'eu') countryCode = detectedCountryCode || 'GB';
      else if (user.region === Region.ASIA || user.region === 'asia') countryCode = detectedCountryCode === 'PK' ? 'PK' : 'GB';
      else countryCode = 'GB';
    }
    if (!countryCode) countryCode = 'GB';
    const countryInfo = getCountryInfo(countryCode);
    const multiplier = countryInfo.pricingMultiplier;
    let displayPrice = usdAmount * multiplier;
    if (countryInfo.currency === 'PKR') displayPrice = displayPrice * 280;
    return {
      amount: displayPrice,
      symbol: countryInfo.currencySymbol,
      currency: countryInfo.currency,
      countryName: countryInfo.name
    };
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
      active: { color: 'bg-green-100 text-green-800', icon: CheckCircle2, label: 'Active' },
      trialing: { color: 'bg-blue-100 text-blue-800', icon: Calendar, label: 'Trialing' },
      past_due: { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle, label: 'Past Due' },
      canceled: { color: 'bg-gray-100 text-gray-800', icon: XCircle, label: 'Canceled' },
      unpaid: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Unpaid' },
      incomplete: { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle, label: 'Incomplete' },
      incomplete_expired: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Expired' },
      paused: { color: 'bg-gray-100 text-gray-800', icon: AlertCircle, label: 'Paused' }
    };
    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', icon: AlertCircle, label: status };
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
        <Icon className="h-4 w-4" />
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className={styles.container}>
          <Navigation />
          <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            <div className={styles.pageContainer}>
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
    <ProtectedRoute requirePackage={true}>
      <div className={styles.container}>
        <Navigation />
        <div className={`pt-16 transition-all duration-300 ${isSidebarOpen ? 'lg:pl-64' : 'lg:pl-0'}`}>
          <div className={styles.pageContainer}>
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Upgrade Your Package</h1>
              <p className="text-gray-600 mt-2">Choose the perfect plan to scale your business</p>
            </div>

            <div className="space-y-6">
              {/* Current Subscription */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <Crown className="h-6 w-6 text-yellow-500" />
                    Current Subscription
                  </h2>
                  {subscription && getStatusBadge(subscription.status)}
                </div>

                {packageInfo ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Package Name</p>
                        <p className="text-lg font-semibold text-gray-900">{packageInfo.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Billing Cycle</p>
                        <p className="text-lg font-semibold text-gray-900 capitalize">
                          {subscription?.billingCycle || packageInfo.price?.billingCycle || 'Monthly'}
                        </p>
                      </div>
                      {subscription && (
                        <>
                          <div>
                            <p className="text-sm text-gray-600">Current Period Start</p>
                            <p className="text-lg font-semibold text-gray-900">{formatDate(subscription.currentPeriodStart)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Current Period End</p>
                            <p className="text-lg font-semibold text-gray-900">{formatDate(subscription.currentPeriodEnd)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Amount</p>
                            <p className="text-lg font-semibold text-gray-900">
                              {(() => {
                                const localPrice = formatPriceInLocalCurrency(subscription.amount);
                                return `${localPrice.symbol}${localPrice.amount.toFixed(2)} ${localPrice.currency} / ${subscription.billingCycle === 'yearly' ? 'year' : 'month'}`;
                              })()}
                            </p>
                          </div>
                          {subscription.cancelAtPeriodEnd && (
                            <div>
                              <p className="text-sm text-gray-600">Cancellation Status</p>
                              <p className="text-lg font-semibold text-red-600">Will cancel at period end</p>
                            </div>
                          )}
                        </>
                      )}
                      {!subscription && packageInfo.price && (
                        <div>
                          <p className="text-sm text-gray-600">Price</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {packageInfo.price.amount === 0 ? 'Free' : (() => {
                              const localPrice = formatPriceInLocalCurrency(packageInfo.price.amount);
                              return `${localPrice.symbol}${localPrice.amount.toFixed(2)} ${localPrice.currency} / ${packageInfo.price.billingCycle}`;
                            })()}
                          </p>
                        </div>
                      )}
                    </div>
                    {packageInfo.features && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <p className="text-sm font-semibold text-gray-700 mb-3">Package Features</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {packageInfo.features.chatbot && (
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span>Chatbot</span>
                            </div>
                          )}
                          {packageInfo.features.voiceAgent && (
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span>Voice Agent</span>
                            </div>
                          )}
                          {packageInfo.features.leadGeneration && (
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span>Lead Generation</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {packageInfo.limits && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <p className="text-sm font-semibold text-gray-700 mb-3">Usage Limits</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-gray-600">Chatbot Queries</p>
                            <p className="text-lg font-semibold text-gray-900">
                              {packageInfo.limits.chatbotQueries === -1 ? 'Unlimited' : packageInfo.limits.chatbotQueries.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Voice Minutes</p>
                            <p className="text-lg font-semibold text-gray-900">
                              {packageInfo.limits.voiceMinutes === -1 ? 'Unlimited' : packageInfo.limits.voiceMinutes.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Lead Generation</p>
                            <p className="text-lg font-semibold text-gray-900">
                              {packageInfo.limits.leadGeneration === -1 ? 'Unlimited' : packageInfo.limits.leadGeneration.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-600 mb-4">No active package found</p>
                    <a href="/packages" className="btn-primary inline-flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Choose a Package
                    </a>
                  </div>
                )}
              </div>

              {/* Manage Subscription */}
              {subscription && subscription.status === 'active' && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <CreditCard className="h-6 w-6 text-gray-700" />
                    Manage Subscription
                  </h2>
                  <p className="text-gray-600 mb-4">
                    Update your payment method, view invoices, or cancel your subscription through the Stripe customer portal.
                  </p>
                  <button
                    onClick={handleManageSubscription}
                    disabled={processing}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    {processing ? (
                      <>
                        <div className="loading-spinner-small"></div>
                        Opening...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-5 w-5" />
                        Manage Subscription
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Available Packages */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <TrendingUp className="h-7 w-7 text-green-600" />
                    Available Plans
                  </h2>
                  <p className="text-gray-600">Choose the perfect plan to scale your business</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Basic Plan */}
                  <div className="border-2 border-gray-200 bg-white rounded-lg p-6">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Basic Plan</h3>
                    <div className="mb-4">
                      <span className="text-4xl font-bold text-gray-900">£149</span>
                      <span className="text-gray-600 ml-2">/per month</span>
                    </div>
                    
                    <div className="mb-6">
                      <p className="text-sm font-semibold text-gray-700 mb-3">Limits</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Chatbot Queries</span>
                          <span className="font-semibold">500</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Voice Minutes</span>
                          <span className="font-semibold">300</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Lead Generation</span>
                          <span className="font-semibold">0</span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-6">
                      <p className="text-sm font-semibold text-gray-700 mb-3">Features</p>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>1 UK Phone Number Included</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>WhatsApp Integration</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>AI Chatbot Integration on Website</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>Unified Inbox Dashboard</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>Call Logs + Message History</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>Basic Customer Support</span>
                        </li>
                      </ul>
                    </div>

                    <button
                      onClick={() => window.open('https://upzilo.com/contact/', '_blank')}
                      className="block w-full text-center py-3 px-4 rounded-lg font-semibold bg-gray-100 text-gray-900 hover:bg-gray-200 transition-colors"
                    >
                      Upgrade
                    </button>
                  </div>

                  {/* Premium Plan */}
                  <div className="border-2 border-[#00bc7d] bg-green-50 rounded-lg p-6 relative">
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-[#00bc7d] text-white text-xs font-bold px-4 py-1 rounded-full">
                        MOST POPULAR
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2 mt-2">Premium Plan</h3>
                    <div className="mb-4">
                      <span className="text-4xl font-bold text-gray-900">£249</span>
                      <span className="text-gray-600 ml-2">/per month</span>
                    </div>
                    
                    <p className="text-sm text-gray-700 mb-4 font-medium">Everything in Basic Plan in addition to:</p>

                    <div className="mb-6">
                      <p className="text-sm font-semibold text-gray-700 mb-3">Limits</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Chatbot Queries</span>
                          <span className="font-semibold">2,000</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Voice Minutes</span>
                          <span className="font-semibold">1,000</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Lead Generation</span>
                          <span className="font-semibold">0</span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-6">
                      <p className="text-sm font-semibold text-gray-700 mb-3">Features</p>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>Facebook Messenger Integration</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>Instagram DM Integration</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>Priority Support</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>Advanced Monitoring & Reliability Support</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>Faster Response & Issue Resolution</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>Reporting & Usage Tracking</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>Enhanced Call Management</span>
                        </li>
                      </ul>
                    </div>

                    <button
                      onClick={() => window.open('https://upzilo.com/contact/', '_blank')}
                      className="block w-full text-center py-3 px-4 rounded-lg font-semibold bg-[#00bc7d] text-white hover:bg-[#00a870] transition-colors"
                    >
                      Upgrade
                    </button>
                  </div>

                  {/* Enterprise Plan */}
                  <div className="border-2 border-gray-200 bg-white rounded-lg p-6">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Enterprise Plan</h3>
                    <div className="mb-4">
                      <span className="text-2xl font-semibold text-gray-600">Contact us for price</span>
                    </div>
                    
                    <p className="text-sm text-gray-700 mb-4 font-medium">Everything in Basic Plan in addition to:</p>

                    <div className="mb-6">
                      <p className="text-sm font-semibold text-gray-700 mb-3">Limits</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Chatbot Queries</span>
                          <span className="font-semibold">Unlimited</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Voice Minutes</span>
                          <span className="font-semibold">Unlimited</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Lead Generation</span>
                          <span className="font-semibold">Unlimited</span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-6">
                      <p className="text-sm font-semibold text-gray-700 mb-3">Features</p>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>Facebook Messenger Integration</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>Instagram DM Integration</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>Priority Support</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>Advanced Monitoring & Reliability Support</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>Faster Response & Issue Resolution</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>Reporting & Usage Tracking</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>Enhanced Call Management</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>Unlimited AI chatbot queries per month</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>Unlimited voice minutes per month</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>Unlimited lead generation calls per month</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>More Support & Optimization included</span>
                        </li>
                      </ul>
                    </div>

                    <button
                      onClick={() => window.open('https://upzilo.com/contact/', '_blank')}
                      className="block w-full text-center py-3 px-4 rounded-lg font-semibold bg-gray-100 text-gray-900 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Contact Us
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
