/** Available languages for chatbot (labels/synonyms). User can pick up to 3. */
export const AVAILABLE_LANGUAGES: { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'ur', name: 'Urdu' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ar', name: 'Arabic' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'bn', name: 'Bengali' },
  { code: 'fa', name: 'Persian' },
  { code: 'tr', name: 'Turkish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'id', name: 'Indonesian' },
  { code: 'zh-cn', name: 'Chinese (Simplified)' },
  { code: 'zh-tw', name: 'Chinese (Traditional)' },
];

export const PREFERRED_LANGUAGES_MAX = 3;
