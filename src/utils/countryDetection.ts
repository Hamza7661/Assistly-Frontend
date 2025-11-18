/**
 * Utility functions for detecting client country code
 * Uses multiple methods with caching for reliability
 */

export interface CountryDetectionResult {
  countryCode: string;
  method: 'stored' | 'ip' | 'ipapi' | 'timezone' | 'locale' | 'default';
  confidence: 'high' | 'medium' | 'low';
}

const STORAGE_KEY = 'assistly_detected_country';
const STORAGE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

/**
 * Get cached country code from localStorage
 */
function getCachedCountry(): CountryDetectionResult | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) return null;
    
    const { countryCode, timestamp } = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid (7 days)
    if (now - timestamp < STORAGE_EXPIRY) {
      return {
        countryCode,
        method: 'stored',
        confidence: 'high'
      };
    }
    
    // Cache expired, remove it
    localStorage.removeItem(STORAGE_KEY);
    return null;
  } catch (error) {
    console.warn('Failed to read cached country:', error);
    return null;
  }
}

/**
 * Cache country code in localStorage
 */
function cacheCountry(countryCode: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      countryCode,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.warn('Failed to cache country:', error);
  }
}

/**
 * Detect country using IP geolocation - Method 1: ip-api.com (free, reliable)
 */
async function detectCountryByIPAPI(): Promise<string | null> {
  try {
    const response = await fetch('http://ip-api.com/json/?fields=countryCode', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.countryCode && typeof data.countryCode === 'string') {
      return data.countryCode.toUpperCase();
    }
    
    return null;
  } catch (error) {
    console.warn('ip-api.com geolocation failed:', error);
    return null;
  }
}

/**
 * Detect country using IP geolocation - Method 2: ipapi.co (backup)
 */
async function detectCountryByIPAPICo(): Promise<string | null> {
  try {
    const response = await fetch('https://ipapi.co/json/', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.country_code && typeof data.country_code === 'string') {
      return data.country_code.toUpperCase();
    }
    
    return null;
  } catch (error) {
    console.warn('ipapi.co geolocation failed:', error);
    return null;
  }
}

/**
 * Detect country using browser's Intl API (most reliable client-side method)
 */
function detectCountryByIntl(): string | null {
  try {
    // Method 1: Use Intl.DateTimeFormat to get timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Map timezones to countries (most common ones)
    const timezoneMap: Record<string, string> = {
      'Europe/London': 'GB',
      'Europe/Dublin': 'IE',
      'Europe/Paris': 'FR',
      'Europe/Berlin': 'DE',
      'Europe/Rome': 'IT',
      'Europe/Madrid': 'ES',
      'Europe/Amsterdam': 'NL',
      'Europe/Brussels': 'BE',
      'Europe/Vienna': 'AT',
      'Europe/Zurich': 'CH',
      'Europe/Stockholm': 'SE',
      'Europe/Oslo': 'NO',
      'Europe/Copenhagen': 'DK',
      'Europe/Helsinki': 'FI',
      'Europe/Warsaw': 'PL',
      'Europe/Prague': 'CZ',
      'Europe/Budapest': 'HU',
      'Europe/Lisbon': 'PT',
      'Europe/Athens': 'GR',
      'Europe/Istanbul': 'TR',
      'America/New_York': 'US',
      'America/Chicago': 'US',
      'America/Denver': 'US',
      'America/Los_Angeles': 'US',
      'America/Phoenix': 'US',
      'America/Anchorage': 'US',
      'America/Honolulu': 'US',
      'America/Toronto': 'CA',
      'America/Vancouver': 'CA',
      'America/Mexico_City': 'MX',
      'America/Sao_Paulo': 'BR',
      'America/Argentina/Buenos_Aires': 'AR',
      'America/Lima': 'PE',
      'America/Santiago': 'CL',
      'America/Bogota': 'CO',
      'Asia/Karachi': 'PK',
      'Asia/Kolkata': 'IN',
      'Asia/Dhaka': 'BD',
      'Asia/Colombo': 'LK',
      'Asia/Kathmandu': 'NP',
      'Asia/Tokyo': 'JP',
      'Asia/Shanghai': 'CN',
      'Asia/Hong_Kong': 'HK',
      'Asia/Singapore': 'SG',
      'Asia/Seoul': 'KR',
      'Asia/Taipei': 'TW',
      'Asia/Bangkok': 'TH',
      'Asia/Jakarta': 'ID',
      'Asia/Manila': 'PH',
      'Asia/Kuala_Lumpur': 'MY',
      'Asia/Ho_Chi_Minh': 'VN',
      'Asia/Dubai': 'AE',
      'Asia/Riyadh': 'SA',
      'Australia/Sydney': 'AU',
      'Australia/Melbourne': 'AU',
      'Australia/Perth': 'AU',
      'Australia/Adelaide': 'AU',
      'Australia/Brisbane': 'AU',
      'Pacific/Auckland': 'NZ',
      'Africa/Cairo': 'EG',
      'Africa/Johannesburg': 'ZA',
      'Africa/Lagos': 'NG',
      'Africa/Nairobi': 'KE',
    };

    if (timezoneMap[timezone]) {
      return timezoneMap[timezone];
    }

    // Method 2: Try to extract from locale
    const locale = navigator.language || (navigator as any).userLanguage;
    if (locale) {
      const parts = locale.split('-');
      if (parts.length >= 2) {
        const countryCode = parts[parts.length - 1].toUpperCase();
        if (countryCode.length === 2 && /^[A-Z]{2}$/.test(countryCode)) {
          return countryCode;
        }
      }
    }

    return null;
  } catch (error) {
    console.warn('Intl-based detection failed:', error);
    return null;
  }
}

/**
 * Detects country code using multiple methods with fallbacks
 */
export async function detectCountryCode(): Promise<CountryDetectionResult> {
  // Step 1: Check cache first
  const cached = getCachedCountry();
  if (cached) {
    return cached;
  }

  // Step 2: Try IP-based geolocation (most accurate)
  try {
    // Try ip-api.com first (free, no API key needed)
    const ipResult1 = await Promise.race([
      detectCountryByIPAPI(),
      new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 3000)) // 3 second timeout
    ]);
    
    if (ipResult1) {
      cacheCountry(ipResult1);
      return {
        countryCode: ipResult1,
        method: 'ipapi',
        confidence: 'high'
      };
    }

    // Fallback to ipapi.co
    const ipResult2 = await Promise.race([
      detectCountryByIPAPICo(),
      new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 3000)) // 3 second timeout
    ]);
    
    if (ipResult2) {
      cacheCountry(ipResult2);
      return {
        countryCode: ipResult2,
        method: 'ip',
        confidence: 'high'
      };
    }
  } catch (error) {
    console.warn('IP-based country detection failed:', error);
  }

  // Step 3: Try Intl API (browser-based, no network needed)
  try {
    const intlResult = detectCountryByIntl();
    if (intlResult) {
      cacheCountry(intlResult);
      return {
        countryCode: intlResult,
        method: 'timezone',
        confidence: 'medium'
      };
    }
  } catch (error) {
    console.warn('Intl-based country detection failed:', error);
  }

  // Step 4: Fallback to default (UK)
  const defaultCountry = process.env.NEXT_PUBLIC_DEFAULT_COUNTRY || 'GB';
  return {
    countryCode: defaultCountry,
    method: 'default',
    confidence: 'low'
  };
}

/**
 * Get a cached country code or detect it
 */
let cachedCountryCode: CountryDetectionResult | null = null;

export async function getCountryCode(): Promise<CountryDetectionResult> {
  // Check in-memory cache first
  if (cachedCountryCode) {
    return cachedCountryCode;
  }
  
  // Check localStorage cache
  const stored = getCachedCountry();
  if (stored) {
    cachedCountryCode = stored;
    return stored;
  }
  
  // Detect and cache
  cachedCountryCode = await detectCountryCode();
  return cachedCountryCode;
}

/**
 * Clear cached country code (useful for testing or manual override)
 */
export function clearCountryCache(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
  cachedCountryCode = null;
}
