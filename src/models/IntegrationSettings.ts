export interface LeadTypeMessage {
  id: number;
  value: string;
  text: string;
  isActive: boolean;
  order: number;
  relevantServicePlans?: string[];  // Optional: service plan names to show for this lead type
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
  googleReviewEnabled?: boolean;
  googleReviewUrl?: string | null;
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
