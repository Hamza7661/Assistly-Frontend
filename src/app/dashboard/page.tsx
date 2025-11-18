'use client';

import { useEffect, useState } from 'react';
import Navigation from '@/components/Navigation';
import { ProtectedRoute } from '@/components';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionService, usePackageService } from '@/services';
import { getIndustryFeatures } from '@/data/industryFeatures';
import { INDUSTRIES_LIST } from '@/enums/Industry';
import { REGION_PRICING_MULTIPLIERS, REGIONS_LIST, countryCodeToRegion, Region, getCountryInfo, CountryInfo } from '@/enums/Region';
import { detectCountryCode } from '@/utils/countryDetection';
import { 
  MessageSquare, 
  Mic, 
  Mail, 
  TrendingUp, 
  Users, 
  Zap, 
  Settings,
  Plus,
  BarChart3,
  Code,
  Crown,
  CreditCard,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  MessageCircle,
  Phone,
  DollarSign
} from 'lucide-react';
import { toast } from 'react-toastify';
import styles from './styles.module.css';

export default function DashboardPage() {
  const { user, updateUser } = useAuth();
  const [subscription, setSubscription] = useState<any>(null);
  const [packageInfo, setPackageInfo] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  // Removed tabs - only showing subscription now
  const [detectedRegion, setDetectedRegion] = useState<Region | null>(null);
  const [detectedCountry, setDetectedCountry] = useState<CountryInfo | null>(null);
  const [detectedCountryCode, setDetectedCountryCode] = useState<string | null>(null);

  useEffect(() => {
    if (user?._id) {
      loadSubscription();
      loadPackages();
      // Reload user if industry is missing
      if (!user?.industry) {
        console.log('Industry missing, reloading user...', { userId: user._id, userData: user });
        reloadUser();
      } else {
        console.log('User industry found:', user.industry);
      }
      // Always detect country for accurate currency display
      detectAndSetRegion();
    }
  }, [user?._id, user?.industry]);

  const reloadUser = async () => {
    try {
      const { useAuthService } = await import('@/services');
      const { User } = await import('@/models/User');
      const authService = await useAuthService();
      const response = await authService.getCurrentUser();
      if (response.status === 'success') {
        updateUser(new User(response.data.user));
      }
    } catch (error) {
      console.error('Failed to reload user:', error);
    }
  };

  const detectAndSetRegion = async () => {
    try {
      // Detect country code
      const countryResult = await detectCountryCode();
      const countryInfo = getCountryInfo(countryResult.countryCode);
      const region = countryInfo.region;
      
      console.log('Detected country:', { countryCode: countryResult.countryCode, country: countryInfo.name, region, method: countryResult.method });
      
      // Store detected country code, country info, and region for immediate use
      setDetectedCountryCode(countryResult.countryCode);
      setDetectedCountry(countryInfo);
      setDetectedRegion(region);
      
      // Only update if user doesn't have a region set (default to UK now), and detected region is different
      if (user && (!user.region || user.region === Region.UK || user.region === 'uk') && region !== Region.UK) {
        try {
          const { useAuthService } = await import('@/services');
          const { User } = await import('@/models/User');
          const authService = await useAuthService();
          const response = await authService.updateUserProfile(user._id, {
            region: region
          });
          
          if (response.status === 'success') {
            updateUser(new User(response.data.user));
            console.log('Region updated successfully:', region);
          }
        } catch (error) {
          console.error('Failed to update region:', error);
        }
      }
    } catch (error) {
      console.error('Failed to detect region:', error);
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
    } catch (error: any) {
      console.error('Failed to load subscription:', error);
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
    } catch (error: any) {
      console.error('Failed to load packages:', error);
    }
  };

  const handleManageSubscription = async () => {
    setProcessing(true);
    try {
      const service = await useSubscriptionService();
      const response = await service.createPortalSession();
      if (response.data.url) {
        window.location.href = response.data.url;
      }
    } catch (error: any) {
      // Check if it's a Stripe configuration error
      const errorMessage = error.message || '';
      if (errorMessage.includes('Stripe is not configured') || errorMessage.includes('STRIPE_SECRET_KEY')) {
        toast.info('⏰ Coming Soon! We\'re working on bringing you subscription management. Please check back later.');
      } else {
        toast.error(errorMessage || 'Failed to open subscription management');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handlePackageUpgrade = async (pkg: any) => {
    if (!user) return;
    
    setProcessing(true);
    try {
      const isFree = pkg.price?.amount === 0 || pkg.type === 'free-trial';
      
      if (isFree) {
        const { useAuthService } = await import('@/services');
        const { User } = await import('@/models/User');
        const authService = await useAuthService();
        const response = await authService.updateUserProfile(user._id, {
          package: pkg._id
        });
        
        if (response.status === 'success') {
          updateUser(new User(response.data.user));
          toast.success('Package upgraded successfully!');
          // Reload subscription and packages
          loadSubscription();
          loadPackages();
        }
      } else {
        const subscriptionService = await useSubscriptionService();
        const checkoutResponse = await subscriptionService.createCheckoutSession(
          pkg._id,
          `${window.location.origin}/dashboard?subscription=success`,
          `${window.location.origin}/dashboard?subscription=canceled`
        );
        
        if (checkoutResponse.data.url) {
          window.location.href = checkoutResponse.data.url;
        }
      }
    } catch (error: any) {
      // Check if it's a Stripe configuration error
      const errorMessage = error.message || '';
      if (errorMessage.includes('Stripe is not configured') || errorMessage.includes('STRIPE_SECRET_KEY')) {
        toast.info('⏰ Coming Soon! We\'re working on payment processing. Please check back later.');
      } else {
        toast.error(errorMessage || 'Failed to upgrade package. Please try again.');
      }
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Helper function to convert and format price in local currency
  const formatPriceInLocalCurrency = (usdAmount: number) => {
    // Priority: 1. Detected country (most accurate), 2. User's stored region, 3. Default to UK
    let countryCode: string | null = null;
    
    // First priority: Use detected country code (most accurate for currency)
    if (detectedCountryCode) {
      countryCode = detectedCountryCode;
    }
    // Second priority: Use user's stored region to infer country
    else if (user?.region) {
      if (user.region === Region.UK || user.region === 'uk') {
        countryCode = 'GB';
      } else if (user.region === Region.US || user.region === 'us') {
        countryCode = 'US';
      } else if (user.region === Region.EU || user.region === 'eu') {
        // For EU region, don't default to EUR - wait for detection or use GB
        // Only use EUR if we have a detected EU country
        countryCode = detectedCountryCode || 'GB';
      } else if (user.region === Region.ASIA || user.region === 'asia') {
        // For Asia region, only use PK if explicitly detected, otherwise default to GB
        countryCode = (detectedCountryCode === 'PK') ? 'PK' : 'GB';
      } else {
        // For other regions, default to GB
        countryCode = 'GB';
      }
    }
    
    // Final fallback to UK
    if (!countryCode) {
      countryCode = 'GB';
    }
    
    const countryInfo = getCountryInfo(countryCode);
    const multiplier = countryInfo.pricingMultiplier;
    const regionPrice = usdAmount * multiplier;
    
    let displayPrice = regionPrice;
    let currencySymbol = countryInfo.currencySymbol;
    
    if (countryInfo.currency === 'PKR') {
      // Convert USD to PKR (approximate rate: 1 USD = 280 PKR)
      displayPrice = regionPrice * 280;
    }
    
    console.log('Currency formatting:', {
      userRegion: user?.region,
      detectedCountryCode,
      finalCountryCode: countryCode,
      currency: countryInfo.currency,
      symbol: currencySymbol,
      countryName: countryInfo.name,
      usdAmount,
      displayPrice
    });
    
    return {
      amount: displayPrice,
      symbol: currencySymbol,
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
      <ProtectedRoute requirePackage={true}>
        <div className={styles.container}>
          <Navigation />
          <div className={styles.pageContainer}>
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="loading-spinner"></div>
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
        <div className={styles.pageContainer}>
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-2">Manage your subscription</p>
          </div>

          {/* Subscription Content */}
          <div className="space-y-6">
            {/* Subscription Status Card */}
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
                        <p className="text-lg font-semibold text-gray-900">
                          {formatDate(subscription.currentPeriodStart)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Current Period End</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {formatDate(subscription.currentPeriodEnd)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Amount</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {(() => {
                            // Convert subscription amount (stored in USD) to local currency
                            const localPrice = formatPriceInLocalCurrency(subscription.amount);
                            return `${localPrice.symbol}${localPrice.amount.toFixed(2)} ${localPrice.currency} / ${subscription.billingCycle === 'yearly' ? 'year' : 'month'}`;
                          })()}
                        </p>
                      </div>
                      {subscription.cancelAtPeriodEnd && (
                        <div>
                          <p className="text-sm text-gray-600">Cancellation Status</p>
                          <p className="text-lg font-semibold text-red-600">
                            Will cancel at period end
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  {!subscription && packageInfo.price && (
                    <div>
                      <p className="text-sm text-gray-600">Price</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {(() => {
                          if (packageInfo.price.amount === 0) return 'Free';
                          const localPrice = formatPriceInLocalCurrency(packageInfo.price.amount);
                          return `${localPrice.symbol}${localPrice.amount.toFixed(2)} ${localPrice.currency} / ${packageInfo.price.billingCycle}`;
                        })()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Package Features */}
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

                {/* Package Limits */}
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

            {/* Subscription Actions */}
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

            {/* Upgrade Packages Section */}
            {packageInfo && packages.length > 0 && (() => {
              const currentPackagePrice = packageInfo.price?.amount || 0;
              const upgradePackages = packages
                .filter((pkg: any) => {
                  const pkgPrice = pkg.price?.amount || 0;
                  return pkg.isActive && pkgPrice > currentPackagePrice;
                })
                .sort((a: any, b: any) => {
                  const priceA = a.price?.amount || 0;
                  const priceB = b.price?.amount || 0;
                  return priceA - priceB;
                });

              if (upgradePackages.length === 0) {
                return null;
              }

              return (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <TrendingUp className="h-7 w-7 text-green-600" />
                      Upgrade Your Plan
                    </h2>
                    <p className="text-gray-600">
                      Upgrade to a higher tier plan for more features and limits
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {upgradePackages.map((pkg: any) => (
                      <div
                        key={pkg._id}
                        className={`border-2 rounded-lg p-6 ${
                          pkg.isPopular
                            ? 'border-[#00bc7d] bg-green-50'
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        {pkg.isPopular && (
                          <div className="bg-[#00bc7d] text-white text-xs font-semibold px-3 py-1 rounded-full inline-block mb-4">
                            Most Popular
                          </div>
                        )}
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{pkg.name}</h3>
                        <div className="mb-4">
                          {(() => {
                            const basePrice = pkg.price?.amount || 0;
                            const localPrice = formatPriceInLocalCurrency(basePrice);
                            
                            return (
                              <>
                                <span className="text-3xl font-bold text-gray-900">
                                  {localPrice.symbol}
                                  {localPrice.amount.toFixed(2)}
                                </span>
                                <span className="text-gray-600 ml-2">
                                  /{pkg.price?.billingCycle === 'yearly' ? 'year' : 'month'}
                                </span>
                                {localPrice.countryName !== 'United States' && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    ({localPrice.countryName} pricing)
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        <p className="text-gray-600 text-sm mb-4">{pkg.description}</p>
                        <div className="space-y-3 mb-6">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Chatbot Queries</span>
                            <span className="font-semibold text-gray-900">
                              {pkg.limits?.chatbotQueries === -1
                                ? 'Unlimited'
                                : pkg.limits?.chatbotQueries?.toLocaleString() || '0'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Voice Minutes</span>
                            <span className="font-semibold text-gray-900">
                              {pkg.limits?.voiceMinutes === -1
                                ? 'Unlimited'
                                : pkg.limits?.voiceMinutes?.toLocaleString() || '0'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Lead Generation</span>
                            <span className="font-semibold text-gray-900">
                              {pkg.limits?.leadGeneration === -1
                                ? 'Unlimited'
                                : pkg.limits?.leadGeneration?.toLocaleString() || '0'}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handlePackageUpgrade(pkg)}
                          className={`block w-full text-center py-2 px-4 rounded-lg font-semibold transition-colors ${
                            pkg.isPopular
                              ? 'bg-[#00bc7d] text-white hover:bg-[#00a870]'
                              : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                          }`}
                        >
                          Upgrade to {pkg.name}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
