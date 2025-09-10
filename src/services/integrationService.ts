import { HttpService } from './httpService';
import type { IntegrationSettings, IntegrationSettingsResponse } from '@/models/IntegrationSettings';

class IntegrationService extends HttpService {
  async getSettings() {
    return this.request<IntegrationSettingsResponse>('/integration/me', { method: 'GET' });
  }

  async updateSettings(settings: Partial<IntegrationSettings>, imageFile?: File) {
    const formData = new FormData();
    
    // Add text fields
    if (settings.assistantName) formData.append('assistantName', settings.assistantName);
    if (settings.greeting) formData.append('greeting', settings.greeting);
    if (settings.primaryColor) formData.append('primaryColor', settings.primaryColor);
    
    // Add image file if provided
    if (imageFile) {
      formData.append('chatbotImage', imageFile);
    }
    
    return this.request<IntegrationSettingsResponse>('/integration/me', {
      method: 'PUT',
      body: formData,
      // Don't pass headers, let HttpService handle Authorization
    });
  }
}

export const integrationService = new IntegrationService();
