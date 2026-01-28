export interface LeadTypeMessage {
  id: number;
  value: string;
  text: string;
  isActive: boolean;
  order: number;
}

export interface IntegrationSettings {
  chatbotImage?: string;
  assistantName?: string;
  companyName?: string;
  greeting?: string;
  primaryColor?: string;
  validateEmail?: boolean;
  validatePhoneNumber?: boolean;
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
