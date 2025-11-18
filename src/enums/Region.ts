export enum Region {
  US = 'us',
  UK = 'uk',
  EU = 'eu',
  ASIA = 'asia',
  MIDDLE_EAST = 'middle-east',
  AFRICA = 'africa',
  OCEANIA = 'oceania',
  LATIN_AMERICA = 'latin-america'
}

export const REGIONS_LIST = [
  { value: Region.US, label: 'United States', currency: 'USD' },
  { value: Region.UK, label: 'United Kingdom', currency: 'GBP' },
  { value: Region.EU, label: 'Europe', currency: 'EUR' },
  { value: Region.ASIA, label: 'Asia', currency: 'USD' },
  { value: Region.MIDDLE_EAST, label: 'Middle East', currency: 'USD' },
  { value: Region.AFRICA, label: 'Africa', currency: 'USD' },
  { value: Region.OCEANIA, label: 'Oceania', currency: 'USD' },
  { value: Region.LATIN_AMERICA, label: 'Latin America', currency: 'USD' }
];

// Region-based pricing multipliers
export const REGION_PRICING_MULTIPLIERS: Record<string, number> = {
  [Region.US]: 1.0,
  [Region.UK]: 0.8,
  [Region.EU]: 0.9,
  [Region.ASIA]: 0.7,
  [Region.MIDDLE_EAST]: 0.85,
  [Region.AFRICA]: 0.6,
  [Region.OCEANIA]: 1.1,
  [Region.LATIN_AMERICA]: 0.65
};

/**
 * Country information mapping
 */
export interface CountryInfo {
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  region: Region;
  pricingMultiplier: number;
}

export const COUNTRY_INFO: Record<string, CountryInfo> = {
  // United States
  US: { code: 'US', name: 'United States', currency: 'USD', currencySymbol: '$', region: Region.US, pricingMultiplier: 1.0 },
  
  // United Kingdom
  GB: { code: 'GB', name: 'United Kingdom', currency: 'GBP', currencySymbol: '£', region: Region.UK, pricingMultiplier: 0.8 },
  UK: { code: 'UK', name: 'United Kingdom', currency: 'GBP', currencySymbol: '£', region: Region.UK, pricingMultiplier: 0.8 },
  
  // Pakistan
  PK: { code: 'PK', name: 'Pakistan', currency: 'PKR', currencySymbol: 'Rs', region: Region.ASIA, pricingMultiplier: 0.7 },
  
  // Europe
  AT: { code: 'AT', name: 'Austria', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
  BE: { code: 'BE', name: 'Belgium', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
  BG: { code: 'BG', name: 'Bulgaria', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
  HR: { code: 'HR', name: 'Croatia', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
  CY: { code: 'CY', name: 'Cyprus', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
  CZ: { code: 'CZ', name: 'Czech Republic', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
  DK: { code: 'DK', name: 'Denmark', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
  EE: { code: 'EE', name: 'Estonia', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
  FI: { code: 'FI', name: 'Finland', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
  FR: { code: 'FR', name: 'France', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
  DE: { code: 'DE', name: 'Germany', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
  GR: { code: 'GR', name: 'Greece', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
  HU: { code: 'HU', name: 'Hungary', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
  IE: { code: 'IE', name: 'Ireland', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
  IT: { code: 'IT', name: 'Italy', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
  LV: { code: 'LV', name: 'Latvia', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
  LT: { code: 'LT', name: 'Lithuania', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
  LU: { code: 'LU', name: 'Luxembourg', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
  MT: { code: 'MT', name: 'Malta', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
  NL: { code: 'NL', name: 'Netherlands', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
  PL: { code: 'PL', name: 'Poland', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
  PT: { code: 'PT', name: 'Portugal', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
  RO: { code: 'RO', name: 'Romania', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
  SK: { code: 'SK', name: 'Slovakia', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
  SI: { code: 'SI', name: 'Slovenia', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
  ES: { code: 'ES', name: 'Spain', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
  SE: { code: 'SE', name: 'Sweden', currency: 'EUR', currencySymbol: '€', region: Region.EU, pricingMultiplier: 0.9 },
};

/**
 * Get country info by country code
 */
export function getCountryInfo(countryCode: string): CountryInfo {
  const code = countryCode.toUpperCase();
  return COUNTRY_INFO[code] || COUNTRY_INFO.GB; // Default to UK
}

/**
 * Map country codes to regions (for backward compatibility)
 */
export function countryCodeToRegion(countryCode: string): Region {
  const countryInfo = getCountryInfo(countryCode);
  return countryInfo.region;
}

