import { HttpService } from './httpService';
import type { IntegrationSettings, IntegrationSettingsResponse } from '@/models/IntegrationSettings';

class IntegrationService extends HttpService {
  async getSettings(appId: string) {
    return this.request<IntegrationSettingsResponse>(`/integration/apps/${appId}`, { method: 'GET' });
  }

  async updateSettings(appId: string, settings: Partial<IntegrationSettings>, imageFile?: File) {
    const formData = new FormData();
    
    // Add text fields
    if (settings.assistantName !== undefined) formData.append('assistantName', settings.assistantName);
    if (settings.companyName !== undefined) formData.append('companyName', settings.companyName);
    if (settings.greeting !== undefined) formData.append('greeting', settings.greeting);
    if (settings.primaryColor !== undefined) formData.append('primaryColor', settings.primaryColor);
    
    // Add validation fields
    if (settings.validateEmail !== undefined) formData.append('validateEmail', settings.validateEmail.toString());
    if (settings.validatePhoneNumber !== undefined) formData.append('validatePhoneNumber', settings.validatePhoneNumber.toString());
    
    // Google review (per-app)
    if (settings.googleReviewEnabled !== undefined) formData.append('googleReviewEnabled', settings.googleReviewEnabled.toString());
    if (settings.googleReviewUrl !== undefined) formData.append('googleReviewUrl', settings.googleReviewUrl ?? '');
    
    // Add leadTypeMessages if provided
    if (settings.leadTypeMessages !== undefined) {
      formData.append('leadTypeMessages', JSON.stringify(settings.leadTypeMessages));
    }
    
    // Add image file if provided
    if (imageFile) {
      formData.append('chatbotImage', imageFile);
    }
    
    return this.request<IntegrationSettingsResponse>(`/integration/apps/${appId}`, {
      method: 'PUT',
      body: formData,
      // Don't pass headers, let HttpService handle Authorization
    });
  }
}

export const integrationService = new IntegrationService();
