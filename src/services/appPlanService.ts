import { HttpService } from './httpService';

export type ChannelQuotaUsage = {
  enabled: boolean;
  limit: number;
  used: number;
  periodStart: string | null;
  resetAt: string | null;
  lastResetAt: string | null;
  remaining: number | null;
  unlimited: boolean;
};

export type AppUsagePayload = {
  appId: string;
  channels: Record<string, { enabled: boolean }>;
  quotas: Record<string, ChannelQuotaUsage>;
  addons: { smsVerification: boolean };
  resetCycle: string;
  paymentCleared: boolean;
  paymentClearedAt: string | null;
  nextPaymentDue: string | null;
};

class AppPlanService extends HttpService {
  async getOwnerUsage(appId: string): Promise<{ status: string; data: AppUsagePayload }> {
    return this.request<{ status: string; data: AppUsagePayload }>(
      `/app-plan/owner/apps/${appId}/usage`
    );
  }
}

export const appPlanService = new AppPlanService();
export const useAppPlanService = () => import('./appPlanService').then((m) => m.appPlanService);
