/**
 * Shared pricing plan definitions (plans, limits, features).
 * Base prices are in USD; display prices are computed with regional multipliers.
 */

export interface PricingPlanLimit {
  chatbotQueries: number | 'Unlimited';
  voiceMinutes: number | 'Unlimited';
  leadGeneration: number | 'Unlimited';
}

export interface PricingPlan {
  id: string;
  name: string;
  /** Base price in USD per month (used with regional multiplier) */
  basePriceUsd: number | null; // null = contact for price
  popular?: boolean;
  limits: PricingPlanLimit;
  features: string[];
  /** Extra line above features (e.g. "Everything in Basic Plan in addition to:") */
  featuresSubtitle?: string;
  ctaLabel: string;
  ctaContact?: boolean; // true = open contact page instead of "Upgrade"
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'basic',
    name: 'Basic Plan',
    basePriceUsd: 186,
    limits: {
      chatbotQueries: 500,
      voiceMinutes: 300,
      leadGeneration: 0
    },
    features: [
      '1 UK Phone Number Included',
      'WhatsApp Integration',
      'AI Chatbot Integration on Website',
      'Unified Inbox Dashboard',
      'Call Logs + Message History',
      'Basic Customer Support'
    ],
    ctaLabel: 'Upgrade'
  },
  {
    id: 'premium',
    name: 'Premium Plan',
    basePriceUsd: 311,
    popular: true,
    limits: {
      chatbotQueries: 2000,
      voiceMinutes: 1000,
      leadGeneration: 0
    },
    featuresSubtitle: 'Everything in Basic Plan in addition to:',
    features: [
      'Facebook Messenger Integration',
      'Instagram DM Integration',
      'Priority Support',
      'Advanced Monitoring & Reliability Support',
      'Faster Response & Issue Resolution',
      'Reporting & Usage Tracking',
      'Enhanced Call Management'
    ],
    ctaLabel: 'Upgrade'
  },
  {
    id: 'enterprise',
    name: 'Enterprise Plan',
    basePriceUsd: null,
    limits: {
      chatbotQueries: 'Unlimited',
      voiceMinutes: 'Unlimited',
      leadGeneration: 'Unlimited'
    },
    featuresSubtitle: 'Everything in Basic Plan in addition to:',
    features: [
      'Facebook Messenger Integration',
      'Instagram DM Integration',
      'Priority Support',
      'Advanced Monitoring & Reliability Support',
      'Faster Response & Issue Resolution',
      'Reporting & Usage Tracking',
      'Enhanced Call Management',
      'Unlimited AI chatbot queries per month',
      'Unlimited voice minutes per month',
      'Unlimited lead generation calls per month',
      'More Support & Optimization included'
    ],
    ctaLabel: 'Contact Us',
    ctaContact: true
  }
];

export const CONTACT_URL = 'https://upzilo.com/contact/';
