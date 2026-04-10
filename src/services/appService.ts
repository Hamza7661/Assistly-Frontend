import { HttpService } from './httpService';

interface CreateAppRequest {
  name: string;
  industry: string;
  description?: string;
  whatsappOption?: 'use-my-number' | 'get-from-twilio';
  whatsappNumber?: string;
  /** Twilio-provisioned number (for get-from-twilio flow after number selection + Meta signup). */
  twilioPhoneNumber?: string;
  /** Twilio WhatsApp sender SID from registerSenderAfterMeta (Meta Embedded Signup). */
  twilioWhatsAppSenderId?: string;
  /** WABA ID from Meta Embedded Signup. */
  wabaId?: string;
  /** Short-lived Facebook user access token (from FB.login). Backend will exchange + store. */
  facebookShortLivedToken?: string;
  /** Facebook Page ID selected by the user after OAuth. */
  facebookPageId?: string;
  /** Facebook Page name (display label). */
  facebookPageName?: string;
}

interface UpdateAppRequest {
  name?: string;
  industry?: string;
  description?: string;
  whatsappNumber?: string;
  whatsappNumberSource?: 'user-provided' | 'twilio-provided';
  whatsappNumberStatus?: 'pending' | 'registered' | 'failed';
  twilioWhatsAppSenderId?: string;
  facebookPageId?: string | null;
  facebookPageName?: string | null;
  instagramBusinessAccountId?: string | null;
  instagramAccessToken?: string | null;
  instagramUsername?: string | null;
  isActive?: boolean;
}

interface ConnectFacebookRequest {
  /** Short-lived user access token from FB.login() */
  shortLivedToken: string;
  /** The Facebook Page ID the user selected */
  pageId: string;
  /** Page name (used as fallback display label if Meta doesn't return it) */
  pageName: string;
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

  /**
   * After user completes Meta Embedded Signup (WABA), register the WhatsApp sender with Twilio.
   * Returns senderSid for use in createApp (twilioWhatsAppSenderId).
   */
  async registerSenderAfterMeta(body: {
    appId: string;
    phoneNumber: string;
    wabaId: string;
  }): Promise<AppResponse & { data: { senderSid: string; phoneNumber: string } }> {
    return this.request(`/apps/register-sender-after-meta`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getAvailableNumbersForApp(
    appId: string,
    countryCode: string,
    limit?: number
  ): Promise<
    AppResponse & {
      data: {
        countryCode: string;
        numbers: {
          phoneNumber: string;
          friendlyName?: string;
          capabilities?: { sms: boolean; voice: boolean };
          monthlyPrice?: string;
          priceUnit?: string;
        }[];
      };
    }
  > {
    const params = new URLSearchParams({ countryCode: countryCode.toUpperCase() });
    if (limit != null) params.set('limit', String(limit));
    return this.request(`/apps/${appId}/available-numbers?${params}`, { method: 'GET' });
  }

  async provisionNumberForApp(
    appId: string,
    body: { countryCode: string; phoneNumber?: string }
  ): Promise<AppResponse & { data: { phoneNumber: string } }> {
    return this.request(`/apps/${appId}/provision-number`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * List available Twilio phone numbers for a country (for get-from-twilio flow).
   */
  async getAvailableNumbers(countryCode: string, limit?: number): Promise<
    AppResponse & {
      data: {
        countryCode: string;
        numbers: {
          phoneNumber: string;
          friendlyName?: string;
          capabilities?: { sms: boolean; voice: boolean };
          monthlyPrice?: string;
          priceUnit?: string;
        }[];
      };
    }
  > {
    const params = new URLSearchParams({ countryCode: countryCode.toUpperCase() });
    if (limit != null) params.set('limit', String(limit));
    return this.request(`/apps/available-numbers?${params}`, { method: 'GET' });
  }

  /**
   * Provision (purchase) a Twilio number. Optionally pass phoneNumber to buy a specific number.
   */
  async provisionNumber(body: {
    countryCode: string;
    phoneNumber?: string;
  }): Promise<
    AppResponse & {
      data: { phoneNumber: string; friendlyName?: string };
    }
  > {
    return this.request(`/apps/provision-number`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /** Set this app as the one using the Twilio number for webhooks/leads/flows (when multiple apps share the same number). */
  async setUsesTwilioNumber(appId: string): Promise<AppResponse> {
    return this.request<AppResponse>(`/apps/${appId}/set-uses-twilio`, {
      method: 'POST',
    });
  }

  /**
   * Exchange a short-lived Facebook token for a long-lived one,
   * retrieve the page access token, and store everything on the app.
   * The actual tokens are stored server-side only (never returned to the frontend).
   */
  async connectFacebook(appId: string, data: ConnectFacebookRequest): Promise<AppResponse> {
    return this.request<AppResponse>(`/apps/${appId}/facebook/connect`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /** Remove all Facebook OAuth tokens from this app. */
  async disconnectFacebook(appId: string): Promise<AppResponse> {
    return this.request<AppResponse>(`/apps/${appId}/facebook/disconnect`, {
      method: 'POST',
    });
  }
}

export const appService = new AppService();
export const useAppService = () => Promise.resolve(appService);
