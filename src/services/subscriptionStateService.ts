import { HttpService } from './httpService';

type ChannelKey = 'web' | 'whatsapp' | 'messenger' | 'instagram' | 'voice';

interface AssignPlanPayload {
  packageId?: string | null;
  paymentCleared?: boolean;
  billingStatus?: string;
  customChannelLimits: Record<ChannelKey, { maxConversations: number; unlimited: boolean }>;
  smsVerificationAddon: { enabled: boolean; limit: number };
}

interface ApiResponse<T = any> {
  status: string;
  message?: string;
  data: T;
}

class SubscriptionStateService extends HttpService {
  async assignPlanToApp(appId: string, payload: AssignPlanPayload): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/subscription-state/admin/apps/${appId}/assign-plan`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getAppSubscriptionState(appId: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/subscription-state/apps/${appId}/state`, { method: 'GET' });
  }

  async getAdminAppSubscriptionState(appId: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/subscription-state/admin/apps/${appId}/state`, { method: 'GET' });
  }

  async getAppSubscriptionReport(appId: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/subscription-state/apps/${appId}/report`, { method: 'GET' });
  }

  async setAppPaymentClear(appId: string, payload: { paymentCleared: boolean; billingStatus?: string }): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/subscription-state/apps/${appId}/payment-clear`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async resetAppCycle(appId: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/subscription-state/apps/${appId}/reset-cycle`, {
      method: 'POST',
    });
  }
}

export const subscriptionStateService = new SubscriptionStateService();

