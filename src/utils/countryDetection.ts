/**
 * Utility functions for detecting client country code
 */

export interface CountryDetectionResult {
  countryCode: string;
  method: 'ip' | 'timezone' | 'locale' | 'default';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Detects country code using multiple methods with fallbacks
 */
export async function detectCountryCode(): Promise<CountryDetectionResult> {
  // Method 1: Try IP-based geolocation (most accurate)
  try {
    const ipResult = await detectCountryByIP();
    if (ipResult) {
      return {
        countryCode: ipResult,
        method: 'ip',
        confidence: 'high'
      };
    }
  } catch (error) {
    console.warn('IP-based country detection failed:', error);
  }

  // Method 2: Try timezone-based detection
  try {
    const timezoneResult = detectCountryByTimezone();
    if (timezoneResult) {
      return {
        countryCode: timezoneResult,
        method: 'timezone',
        confidence: 'medium'
      };
    }
  } catch (error) {
    console.warn('Timezone-based country detection failed:', error);
  }

  // Method 3: Try locale-based detection
  try {
    const localeResult = detectCountryByLocale();
    if (localeResult) {
      return {
        countryCode: localeResult,
        method: 'locale',
        confidence: 'low'
      };
    }
  } catch (error) {
    console.warn('Locale-based country detection failed:', error);
  }

  // Method 4: Fallback to default
  const defaultCountry = process.env.NEXT_PUBLIC_DEFAULT_COUNTRY || 'US';
  return {
    countryCode: defaultCountry,
    method: 'default',
    confidence: 'low'
  };
}

/**
 * Detect country using IP-based geolocation
 */
async function detectCountryByIP(): Promise<string | null> {
  try {
    // Using a free IP geolocation service
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
    console.warn('IP geolocation failed:', error);
    return null;
  }
}

/**
 * Detect country using timezone
 */
function detectCountryByTimezone(): string | null {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Map common timezones to country codes
    const timezoneToCountry: Record<string, string> = {
      'America/New_York': 'US',
      'America/Chicago': 'US',
      'America/Denver': 'US',
      'America/Los_Angeles': 'US',
      'America/Toronto': 'CA',
      'America/Vancouver': 'CA',
      'Europe/London': 'GB',
      'Europe/Paris': 'FR',
      'Europe/Berlin': 'DE',
      'Europe/Rome': 'IT',
      'Europe/Madrid': 'ES',
      'Europe/Amsterdam': 'NL',
      'Europe/Stockholm': 'SE',
      'Europe/Oslo': 'NO',
      'Europe/Copenhagen': 'DK',
      'Europe/Helsinki': 'FI',
      'Europe/Warsaw': 'PL',
      'Europe/Prague': 'CZ',
      'Europe/Budapest': 'HU',
      'Europe/Vienna': 'AT',
      'Europe/Zurich': 'CH',
      'Europe/Brussels': 'BE',
      'Europe/Dublin': 'IE',
      'Europe/Lisbon': 'PT',
      'Europe/Athens': 'GR',
      'Europe/Istanbul': 'TR',
      'Europe/Moscow': 'RU',
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
      'Asia/Tehran': 'IR',
      'Asia/Karachi': 'PK',
      'Asia/Kolkata': 'IN',
      'Asia/Dhaka': 'BD',
      'Asia/Colombo': 'LK',
      'Asia/Kathmandu': 'NP',
      'Asia/Dhaka': 'BD',
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
      'America/Sao_Paulo': 'BR',
      'America/Argentina/Buenos_Aires': 'AR',
      'America/Mexico_City': 'MX',
      'America/Lima': 'PE',
      'America/Santiago': 'CL',
      'America/Bogota': 'CO',
      'America/Caracas': 'VE',
    };

    return timezoneToCountry[timezone] || null;
  } catch (error) {
    console.warn('Timezone detection failed:', error);
    return null;
  }
}

/**
 * Detect country using browser locale
 */
function detectCountryByLocale(): string | null {
  try {
    const locale = navigator.language || (navigator as any).userLanguage;
    
    if (!locale) return null;
    
    // Extract country code from locale (e.g., 'en-US' -> 'US')
    const parts = locale.split('-');
    if (parts.length >= 2) {
      const countryCode = parts[parts.length - 1].toUpperCase();
      
      // Validate it's a 2-letter country code
      if (countryCode.length === 2 && /^[A-Z]{2}$/.test(countryCode)) {
        return countryCode;
      }
    }
    
    return null;
  } catch (error) {
    console.warn('Locale detection failed:', error);
    return null;
  }
}

/**
 * Get a cached country code or detect it
 */
let cachedCountryCode: CountryDetectionResult | null = null;

export async function getCountryCode(): Promise<CountryDetectionResult> {
  if (cachedCountryCode) {
    return cachedCountryCode;
  }
  
  cachedCountryCode = await detectCountryCode();
  return cachedCountryCode;
}
