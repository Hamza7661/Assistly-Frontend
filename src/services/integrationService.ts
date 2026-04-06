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
    if (settings.captureLeadName !== undefined) formData.append('captureLeadName', settings.captureLeadName.toString());
    if (settings.captureLeadEmail !== undefined) formData.append('captureLeadEmail', settings.captureLeadEmail.toString());
    if (settings.captureLeadPhoneNumber !== undefined) formData.append('captureLeadPhoneNumber', settings.captureLeadPhoneNumber.toString());
    if (settings.captureFeedbackEnabled !== undefined) formData.append('captureFeedbackEnabled', settings.captureFeedbackEnabled.toString());
    
    if (settings.conversationStyle !== undefined) {
      formData.append('conversationStyle', settings.conversationStyle.toString());
    }
    
    // Google review (per-app)
    if (settings.googleReviewEnabled !== undefined) formData.append('googleReviewEnabled', settings.googleReviewEnabled.toString());
    if (settings.googleReviewUrl !== undefined) formData.append('googleReviewUrl', settings.googleReviewUrl ?? '');
    if (settings.calendarSlotMinutes !== undefined) formData.append('calendarSlotMinutes', String(settings.calendarSlotMinutes));

    if (settings.preferredLanguages !== undefined) formData.append('preferredLanguages', JSON.stringify(settings.preferredLanguages));
    
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

  /** Get Google Calendar OAuth URL for connecting; frontend redirects user to this URL. */
  async getCalendarAuthUrl(appId: string) {
    const res = await this.request<{ status: string; data: { url: string } }>(
      `/integration/apps/${appId}/calendar/auth-url`,
      { method: 'GET' }
    );
    return res.data?.url;
  }

  /** Disconnect calendar for the app. */
  async disconnectCalendar(appId: string) {
    return this.request<{ status: string; data: { calendarConnected: boolean } }>(
      `/integration/apps/${appId}/calendar`,
      { method: 'DELETE' }
    );
  }
}

export const integrationService = new IntegrationService();
