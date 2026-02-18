'use client';

import { useEffect, useState } from 'react';
import Navigation from '@/components/Navigation';
import { ProtectedRoute } from '@/components';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { getCountryInfo } from '@/enums/Region';
import { detectCountryCode } from '@/utils/countryDetection';
import { PRICING_PLANS, CONTACT_URL } from '@/constants/pricingPlans';
import { CheckCircle2, ExternalLink, TrendingUp } from 'lucide-react';
import styles from '../dashboard/styles.module.css';

export default function ChoosePackagePage() {
  const { user } = useAuth();
  const { isOpen: isSidebarOpen } = useSidebar();
  const [detectedCountryCode, setDetectedCountryCode] = useState<string | null>(null);

  useEffect(() => {
    detectAndSetRegion();
  }, []);

  const detectAndSetRegion = async () => {
    try {
      const countryResult = await detectCountryCode();
      setDetectedCountryCode(countryResult.countryCode);
    } catch (e) {
      console.error('Failed to detect region:', e);
    }
  };

  const formatPriceInLocalCurrency = (usdAmount: number) => {
    let countryCode: string | null = detectedCountryCode || null;
    if (!countryCode && user?.region) {
      const r = user.region as string;
      if (r === 'uk') countryCode = 'GB';
      else if (r === 'us') countryCode = 'US';
      else if (r === 'eu') countryCode = detectedCountryCode || 'GB';
      else if (r === 'asia') countryCode = detectedCountryCode === 'PK' ? 'PK' : 'GB';
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

  const limitVal = (v: number | 'Unlimited') => (typeof v === 'number' ? v.toLocaleString() : v);

  return (
    <ProtectedRoute requirePackage={false}>
      <div className={styles.container}>
        <Navigation />
        <div className={`pt-16 transition-all duration-300 ${isSidebarOpen ? 'lg:pl-64' : 'lg:pl-0'}`}>
          <div className={styles.pageContainer}>
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Choose Your Package</h1>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <TrendingUp className="h-7 w-7 text-green-600" />
                  Available Plans
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {PRICING_PLANS.map((plan) => {
                  const localPrice = plan.basePriceUsd != null ? formatPriceInLocalCurrency(plan.basePriceUsd) : null;
                  return (
                    <div
                      key={plan.id}
                      className={`border-2 rounded-lg p-6 relative ${
                        plan.popular ? 'border-[#00bc7d] bg-green-50' : 'border-gray-200 bg-white'
                      }`}
                    >
                      {plan.popular && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <span className="bg-[#00bc7d] text-white text-xs font-bold px-4 py-1 rounded-full">
                            MOST POPULAR
                          </span>
                        </div>
                      )}
                      <h3 className="text-2xl font-bold text-gray-900 mb-2 mt-2">{plan.name}</h3>
                      <div className="mb-4">
                        {localPrice ? (
                          <>
                            <span className="text-4xl font-bold text-gray-900">
                              {localPrice.symbol}{localPrice.amount.toFixed(2)}
                            </span>
                            <span className="text-gray-600 ml-2">/per month</span>
                            {localPrice.countryName && localPrice.countryName !== 'United States' && (
                              <div className="text-xs text-gray-500 mt-1">({localPrice.countryName} pricing)</div>
                            )}
                          </>
                        ) : (
                          <span className="text-2xl font-semibold text-gray-600">Contact us for price</span>
                        )}
                      </div>
                      {plan.featuresSubtitle && (
                        <p className="text-sm text-gray-700 mb-4 font-medium">{plan.featuresSubtitle}</p>
                      )}
                      <div className="mb-6">
                        <p className="text-sm font-semibold text-gray-700 mb-3">Limits</p>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Chatbot Queries</span>
                            <span className="font-semibold">{limitVal(plan.limits.chatbotQueries)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Voice Minutes</span>
                            <span className="font-semibold">{limitVal(plan.limits.voiceMinutes)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Lead Generation</span>
                            <span className="font-semibold">{limitVal(plan.limits.leadGeneration)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="mb-6">
                        <p className="text-sm font-semibold text-gray-700 mb-3">Features</p>
                        <ul className="space-y-2">
                          {plan.features.map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <button
                        onClick={() => window.open(CONTACT_URL, '_blank')}
                        className={`block w-full text-center py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                          plan.popular
                            ? 'bg-[#00bc7d] text-white hover:bg-[#00a870]'
                            : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                        }`}
                      >
                        {plan.ctaContact && <ExternalLink className="h-4 w-4" />}
                        {plan.ctaLabel}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
