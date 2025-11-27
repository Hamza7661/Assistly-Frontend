export interface IntegrationSettings {
  chatbotImage?: string;
  assistantName?: string;
  companyName?: string;
  greeting?: string;
  primaryColor?: string;
  validateEmail?: boolean;
  validatePhoneNumber?: boolean;
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
