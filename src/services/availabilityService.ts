import { HttpService } from './httpService';
import { AvailabilityListResponse, AvailabilityBulkRequest } from '@/models/Availability';

class AvailabilityService extends HttpService {
  async getMyAvailability(): Promise<AvailabilityListResponse> {
    const res = await this.request<AvailabilityListResponse>('/availability/me');
    return res;
  }

  async getByUser(userId: string): Promise<AvailabilityListResponse> {
    const res = await this.request<AvailabilityListResponse>(`/availability/user/${userId}`);
    return res;
  }

  async bulkReplace(payload: AvailabilityBulkRequest): Promise<AvailabilityListResponse> {
    const res = await this.request<AvailabilityListResponse>('/availability/bulk', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res;
  }
}

export const availabilityService = new AvailabilityService();
export const useAvailabilityService = () => import('./availabilityService').then(m => m.availabilityService);


