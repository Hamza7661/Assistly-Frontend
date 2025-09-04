import { HttpService } from './httpService';
import { TreatmentPlanListResponse, TreatmentPlanMutationResponse } from '@/models/TreatmentPlanResponses';

class TreatmentPlanService extends HttpService {
  async getUserPlans(userId: string): Promise<TreatmentPlanListResponse> {
    const res = await this.request<any>(`/treatment-plans/user/${userId}`);
    return new TreatmentPlanListResponse(res);
  }

  async upsertUserPlans(userId: string, plans: Array<{ title: string; description: string }>): Promise<TreatmentPlanListResponse | TreatmentPlanMutationResponse> {
    const res = await this.request<any>(`/treatment-plans/user/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ plans }),
    });
    if (res?.data?.plan) return new TreatmentPlanMutationResponse(res);
    return new TreatmentPlanListResponse(res);
  }
}

export const treatmentPlanService = new TreatmentPlanService();
export const useTreatmentPlanService = () => import('./treatmentPlanService').then(m => m.treatmentPlanService);


