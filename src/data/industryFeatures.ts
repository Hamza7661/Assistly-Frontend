import { Industry } from '@/enums/Industry';

export interface IndustryFeature {
  title: string;
  description: string;
  benefits: string[];
}

export interface IndustryFeatures {
  chatbot: IndustryFeature;
  voice: IndustryFeature;
  whatsapp: IndustryFeature;
}

export const INDUSTRY_FEATURES: Record<string, IndustryFeatures> = {
  [Industry.HEALTHCARE]: {
    chatbot: {
      title: 'Healthcare Chatbot',
      description: '24/7 patient support and appointment scheduling',
      benefits: [
        'Schedule appointments automatically',
        'Answer common health questions',
        'Provide medication reminders',
        'Collect patient information securely',
        'Direct patients to emergency services when needed'
      ]
    },
    voice: {
      title: 'Voice Assistant for Healthcare',
      description: 'Automated phone system for patient care',
      benefits: [
        'Handle appointment confirmations via phone',
        'Provide test results and lab reports',
        'Remind patients about upcoming appointments',
        'Answer insurance and billing questions',
        'Route urgent calls to medical staff'
      ]
    },
    whatsapp: {
      title: 'WhatsApp Integration for Healthcare',
      description: 'Secure patient communication via WhatsApp',
      benefits: [
        'Send appointment reminders via WhatsApp',
        'Share test results and medical reports',
        'Provide medication instructions',
        'Answer patient queries in real-time',
        'Schedule follow-up appointments'
      ]
    }
  },
  [Industry.DENTAL]: {
    chatbot: {
      title: 'Dental Practice Chatbot',
      description: 'Automate patient inquiries and appointment booking',
      benefits: [
        'Book dental appointments online',
        'Answer questions about treatments',
        'Provide pricing information',
        'Send appointment reminders',
        'Collect patient dental history'
      ]
    },
    voice: {
      title: 'Voice Assistant for Dental Practices',
      description: 'Handle phone calls and appointment scheduling',
      benefits: [
        'Confirm dental appointments via phone',
        'Provide treatment information',
        'Remind patients about cleanings',
        'Answer insurance coverage questions',
        'Schedule emergency appointments'
      ]
    },
    whatsapp: {
      title: 'WhatsApp for Dental Practices',
      description: 'Engage with patients through WhatsApp',
      benefits: [
        'Send appointment confirmations',
        'Share pre-appointment instructions',
        'Provide post-treatment care tips',
        'Send payment reminders',
        'Answer treatment questions'
      ]
    }
  },
  [Industry.LEGAL]: {
    chatbot: {
      title: 'Legal Practice Chatbot',
      description: 'Client intake and consultation scheduling',
      benefits: [
        'Schedule initial consultations',
        'Collect case information',
        'Answer common legal questions',
        'Provide service pricing',
        'Direct clients to appropriate attorneys'
      ]
    },
    voice: {
      title: 'Voice Assistant for Law Firms',
      description: 'Professional phone handling for legal services',
      benefits: [
        'Handle consultation requests',
        'Provide office hours and location',
        'Route calls to appropriate departments',
        'Schedule court date reminders',
        'Answer billing inquiries'
      ]
    },
    whatsapp: {
      title: 'WhatsApp for Legal Services',
      description: 'Secure client communication platform',
      benefits: [
        'Send case updates to clients',
        'Schedule consultations',
        'Share legal documents securely',
        'Provide court date reminders',
        'Answer client questions'
      ]
    }
  },
  [Industry.REAL_ESTATE]: {
    chatbot: {
      title: 'Real Estate Chatbot',
      description: 'Property inquiries and lead generation',
      benefits: [
        'Answer property questions 24/7',
        'Schedule property viewings',
        'Collect buyer/seller information',
        'Provide neighborhood information',
        'Qualify leads automatically'
      ]
    },
    voice: {
      title: 'Voice Assistant for Real Estate',
      description: 'Handle property inquiries via phone',
      benefits: [
        'Schedule property tours',
        'Provide property details over phone',
        'Answer mortgage questions',
        'Connect buyers with agents',
        'Follow up on property inquiries'
      ]
    },
    whatsapp: {
      title: 'WhatsApp for Real Estate',
      description: 'Engage property buyers and sellers',
      benefits: [
        'Send property listings via WhatsApp',
        'Share virtual tour links',
        'Schedule property viewings',
        'Provide neighborhood insights',
        'Follow up with leads'
      ]
    }
  },
  [Industry.FINANCE]: {
    chatbot: {
      title: 'Financial Services Chatbot',
      description: 'Customer support and account inquiries',
      benefits: [
        'Answer account balance questions',
        'Provide investment information',
        'Help with loan applications',
        'Explain financial products',
        'Schedule consultations with advisors'
      ]
    },
    voice: {
      title: 'Voice Assistant for Finance',
      description: 'Secure phone banking and support',
      benefits: [
        'Verify account information',
        'Provide transaction details',
        'Answer product questions',
        'Schedule financial consultations',
        'Handle loan inquiries'
      ]
    },
    whatsapp: {
      title: 'WhatsApp for Financial Services',
      description: 'Secure financial communication',
      benefits: [
        'Send account alerts',
        'Share investment updates',
        'Provide transaction confirmations',
        'Answer customer queries',
        'Schedule appointments'
      ]
    }
  },
  [Industry.EDUCATION]: {
    chatbot: {
      title: 'Education Chatbot',
      description: 'Student support and enrollment assistance',
      benefits: [
        'Answer admission questions',
        'Provide course information',
        'Schedule campus tours',
        'Help with enrollment process',
        'Answer financial aid questions'
      ]
    },
    voice: {
      title: 'Voice Assistant for Education',
      description: 'Student and parent communication',
      benefits: [
        'Handle enrollment inquiries',
        'Provide course schedules',
        'Answer tuition questions',
        'Schedule campus visits',
        'Connect with admissions staff'
      ]
    },
    whatsapp: {
      title: 'WhatsApp for Education',
      description: 'Student engagement platform',
      benefits: [
        'Send class reminders',
        'Share assignment deadlines',
        'Provide exam schedules',
        'Answer student questions',
        'Send important announcements'
      ]
    }
  },
  [Industry.RETAIL]: {
    chatbot: {
      title: 'Retail Chatbot',
      description: 'Customer support and product inquiries',
      benefits: [
        'Answer product questions',
        'Help with order tracking',
        'Process returns and exchanges',
        'Provide product recommendations',
        'Handle customer complaints'
      ]
    },
    voice: {
      title: 'Voice Assistant for Retail',
      description: 'Customer service via phone',
      benefits: [
        'Handle order inquiries',
        'Process phone orders',
        'Answer product questions',
        'Handle returns and refunds',
        'Provide store hours and locations'
      ]
    },
    whatsapp: {
      title: 'WhatsApp for Retail',
      description: 'Customer engagement and support',
      benefits: [
        'Send order confirmations',
        'Share shipping updates',
        'Provide product recommendations',
        'Send promotional offers',
        'Handle customer service'
      ]
    }
  },
  [Industry.HOSPITALITY]: {
    chatbot: {
      title: 'Hospitality Chatbot',
      description: 'Guest services and booking management',
      benefits: [
        'Handle room bookings',
        'Answer amenity questions',
        'Provide local recommendations',
        'Process special requests',
        'Handle check-in/check-out inquiries'
      ]
    },
    voice: {
      title: 'Voice Assistant for Hospitality',
      description: 'Guest services via phone',
      benefits: [
        'Handle reservation inquiries',
        'Provide hotel information',
        'Process room service orders',
        'Answer amenity questions',
        'Connect guests with concierge'
      ]
    },
    whatsapp: {
      title: 'WhatsApp for Hospitality',
      description: 'Enhanced guest communication',
      benefits: [
        'Send booking confirmations',
        'Share check-in instructions',
        'Provide local recommendations',
        'Handle guest requests',
        'Send promotional offers'
      ]
    }
  },
  [Industry.FITNESS]: {
    chatbot: {
      title: 'Fitness Chatbot',
      description: 'Member support and class scheduling',
      benefits: [
        'Schedule fitness classes',
        'Answer membership questions',
        'Provide workout information',
        'Handle personal training bookings',
        'Share nutrition tips'
      ]
    },
    voice: {
      title: 'Voice Assistant for Fitness',
      description: 'Member services via phone',
      benefits: [
        'Handle membership inquiries',
        'Schedule classes over phone',
        'Answer facility questions',
        'Process membership renewals',
        'Connect with trainers'
      ]
    },
    whatsapp: {
      title: 'WhatsApp for Fitness',
      description: 'Member engagement platform',
      benefits: [
        'Send class reminders',
        'Share workout tips',
        'Provide nutrition guidance',
        'Send promotional offers',
        'Handle member inquiries'
      ]
    }
  },
  [Industry.BEAUTY]: {
    chatbot: {
      title: 'Beauty & Spa Chatbot',
      description: 'Appointment booking and service inquiries',
      benefits: [
        'Book beauty appointments',
        'Answer service questions',
        'Provide pricing information',
        'Send appointment reminders',
        'Handle product inquiries'
      ]
    },
    voice: {
      title: 'Voice Assistant for Beauty & Spa',
      description: 'Client services via phone',
      benefits: [
        'Schedule appointments',
        'Provide service information',
        'Answer pricing questions',
        'Handle cancellations',
        'Connect with stylists'
      ]
    },
    whatsapp: {
      title: 'WhatsApp for Beauty & Spa',
      description: 'Client communication platform',
      benefits: [
        'Send appointment confirmations',
        'Share beauty tips',
        'Send promotional offers',
        'Provide service reminders',
        'Handle client inquiries'
      ]
    }
  },
  [Industry.AUTOMOTIVE]: {
    chatbot: {
      title: 'Automotive Chatbot',
      description: 'Service scheduling and vehicle inquiries',
      benefits: [
        'Schedule vehicle service',
        'Answer car questions',
        'Provide pricing information',
        'Track service status',
        'Handle parts inquiries'
      ]
    },
    voice: {
      title: 'Voice Assistant for Automotive',
      description: 'Customer service via phone',
      benefits: [
        'Schedule service appointments',
        'Provide vehicle information',
        'Answer parts questions',
        'Handle warranty inquiries',
        'Connect with service advisors'
      ]
    },
    whatsapp: {
      title: 'WhatsApp for Automotive',
      description: 'Customer engagement platform',
      benefits: [
        'Send service reminders',
        'Share service updates',
        'Provide vehicle maintenance tips',
        'Send promotional offers',
        'Handle customer inquiries'
      ]
    }
  },
  [Industry.CONSULTING]: {
    chatbot: {
      title: 'Consulting Chatbot',
      description: 'Client intake and consultation scheduling',
      benefits: [
        'Schedule consultations',
        'Collect client information',
        'Answer service questions',
        'Provide pricing information',
        'Qualify leads automatically'
      ]
    },
    voice: {
      title: 'Voice Assistant for Consulting',
      description: 'Professional client communication',
      benefits: [
        'Handle consultation requests',
        'Provide service information',
        'Schedule meetings',
        'Answer pricing questions',
        'Connect with consultants'
      ]
    },
    whatsapp: {
      title: 'WhatsApp for Consulting',
      description: 'Client engagement platform',
      benefits: [
        'Send meeting reminders',
        'Share consultation materials',
        'Provide project updates',
        'Answer client questions',
        'Schedule follow-ups'
      ]
    }
  },
  [Industry.TECHNOLOGY]: {
    chatbot: {
      title: 'Tech Support Chatbot',
      description: 'Customer support and technical assistance',
      benefits: [
        'Answer technical questions',
        'Provide product information',
        'Handle support tickets',
        'Guide troubleshooting steps',
        'Schedule technical consultations'
      ]
    },
    voice: {
      title: 'Voice Assistant for Technology',
      description: 'Technical support via phone',
      benefits: [
        'Handle support calls',
        'Provide technical guidance',
        'Schedule service appointments',
        'Answer product questions',
        'Connect with technical team'
      ]
    },
    whatsapp: {
      title: 'WhatsApp for Technology',
      description: 'Customer support platform',
      benefits: [
        'Send support updates',
        'Share technical documentation',
        'Provide product announcements',
        'Handle customer inquiries',
        'Schedule support calls'
      ]
    }
  },
  [Industry.FOOD]: {
    chatbot: {
      title: 'Restaurant Chatbot',
      description: 'Order management and customer service',
      benefits: [
        'Take food orders online',
        'Answer menu questions',
        'Handle reservations',
        'Provide delivery updates',
        'Process special dietary requests'
      ]
    },
    voice: {
      title: 'Voice Assistant for Restaurants',
      description: 'Phone ordering and reservation system',
      benefits: [
        'Take phone orders',
        'Handle reservations',
        'Provide menu information',
        'Answer hours and location questions',
        'Process takeout orders'
      ]
    },
    whatsapp: {
      title: 'WhatsApp for Restaurants',
      description: 'Customer engagement and ordering',
      benefits: [
        'Send menu updates',
        'Take orders via WhatsApp',
        'Send order confirmations',
        'Provide delivery tracking',
        'Send promotional offers'
      ]
    }
  },
  [Industry.OTHER]: {
    chatbot: {
      title: 'Business Chatbot',
      description: 'Customer support and inquiry handling',
      benefits: [
        'Answer customer questions',
        'Schedule appointments',
        'Provide service information',
        'Collect lead information',
        'Handle customer inquiries 24/7'
      ]
    },
    voice: {
      title: 'Voice Assistant',
      description: 'Phone support and customer service',
      benefits: [
        'Handle phone inquiries',
        'Schedule appointments',
        'Provide business information',
        'Answer customer questions',
        'Route calls appropriately'
      ]
    },
    whatsapp: {
      title: 'WhatsApp Integration',
      description: 'Customer communication platform',
      benefits: [
        'Send updates to customers',
        'Answer inquiries in real-time',
        'Share important information',
        'Schedule appointments',
        'Engage with customers'
      ]
    }
  }
};

export function getIndustryFeatures(industry: string): IndustryFeatures {
  return INDUSTRY_FEATURES[industry] || INDUSTRY_FEATURES[Industry.OTHER];
}

