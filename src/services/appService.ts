import { HttpService } from './httpService';

interface CreateAppRequest {
  name: string;
  industry: string;
  description?: string;
  whatsappOption?: 'use-my-number' | 'get-from-twilio';
  whatsappNumber?: string;
}

interface UpdateAppRequest {
  name?: string;
  industry?: string;
  description?: string;
  whatsappNumber?: string;
  whatsappNumberSource?: 'user-provided' | 'twilio-provided';
  whatsappNumberStatus?: 'pending' | 'registered' | 'failed';
  twilioWhatsAppSenderId?: string;
  isActive?: boolean;
}

interface AppResponse {
  status: string;
  message?: string;
  data: {
    app?: any;
    apps?: any[];
  };
}

class AppService extends HttpService {
  async createApp(data: CreateAppRequest): Promise<AppResponse> {
    return this.request<AppResponse>('/apps', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getApps(includeInactive?: boolean): Promise<AppResponse> {
    const query = includeInactive ? '?includeInactive=true' : '';
    return this.request<AppResponse>(`/apps${query}`, {
      method: 'GET',
    });
  }

  async getApp(appId: string): Promise<AppResponse> {
    return this.request<AppResponse>(`/apps/${appId}`, {
      method: 'GET',
    });
  }

  async updateApp(appId: string, data: UpdateAppRequest): Promise<AppResponse> {
    return this.request<AppResponse>(`/apps/${appId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteApp(appId: string): Promise<AppResponse> {
    return this.request<AppResponse>(`/apps/${appId}`, {
      method: 'DELETE',
    });
  }

  async restoreApp(appId: string): Promise<AppResponse> {
    return this.request<AppResponse>(`/apps/${appId}/restore`, {
      method: 'POST',
    });
  }

  async registerWhatsApp(appId: string): Promise<AppResponse> {
    return this.request<AppResponse>(`/apps/${appId}/whatsapp/register`, {
      method: 'POST',
    });
  }

  /** Set this app as the one using the Twilio number for webhooks/leads/flows (when multiple apps share the same number). */
  async setUsesTwilioNumber(appId: string): Promise<AppResponse> {
    return this.request<AppResponse>(`/apps/${appId}/set-uses-twilio`, {
      method: 'POST',
    });
  }
}

export const appService = new AppService();
export const useAppService = () => Promise.resolve(appService);
