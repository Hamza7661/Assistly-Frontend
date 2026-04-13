export interface LeadTypeMessage {
  id: number;
  value: string;
  text: string;
  isActive: boolean;
  order: number;
  relevantServicePlans?: string[];  // Optional: service plan names to show for this lead type
  emoji?: string;
  /** Alternate phrases/languages that match this option (e.g. ["مینو", "menü"] for Menu). Optional. */
  synonyms?: string[];
  /** Display label per language for greeting (e.g. { ur: "مینو", hi: "मेन्यू" }). Optional. */
  labels?: Record<string, string>;
}

export interface IntegrationSettings {
  chatbotImage?: string;
  assistantName?: string;
  companyName?: string;
  greeting?: string;
  primaryColor?: string;
  validateEmail?: boolean;
  validatePhoneNumber?: boolean;
  captureLeadName?: boolean;
  captureLeadEmail?: boolean;
  captureLeadPhoneNumber?: boolean;
  /**
   * When true, non-voice channels use a conversational/free-form style
   * (no option buttons/numbered lists for lead type, service selection, and workflow questions).
   */
  conversationStyle?: boolean;
  captureFeedbackEnabled?: boolean;
  googleReviewEnabled?: boolean;
  googleReviewUrl?: string | null;
  /** Calendar connected for scheduling/availability (same shape for all providers). */
  calendarConnected?: boolean;
  /** Provider-specific calendar connection flags. */
  googleCalendarConnected?: boolean;
  outlookCalendarConnected?: boolean;
  calendlyConnected?: boolean;
  /** Provider type: 'google_calendar' | 'outlook' | 'calendly'. */
  calendarProvider?: string | null;
  /** Email of the connected calendar account (e.g. Google). Shown in UI. */
  calendarAccountEmail?: string | null;
  /** Slot length in minutes for calendar (15, 30, or 60). Used when showing available slots to users. */
  calendarSlotMinutes?: number;
  /** Preferred languages for this app (max 3). Used for labels/synonyms UI. */
  preferredLanguages?: string[];
  leadTypeMessages?: LeadTypeMessage[];
}

export interface IntegrationSettingsResponse {
  status: 'success' | 'fail';
  data: {
    integration: IntegrationSettings & {
      id: string;
      owner: string;
      createdAt: string;
      updatedAt: string;
      chatbotImage?: {
        hasImage: boolean;
        contentType: string;
        filename: string;
        data: string;
      };
    };
  };
}
