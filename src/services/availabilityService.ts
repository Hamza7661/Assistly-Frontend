import { HttpService } from './httpService';
import {
  AvailabilityListResponse,
  AvailabilityBulkRequest,
  AvailabilityExceptionsResponse,
  AvailabilityExceptionUpsertRequest,
  AvailabilityExceptionsBulkRequest,
} from '@/models/Availability';

class AvailabilityService extends HttpService {
  async getMyAvailability(): Promise<AvailabilityListResponse> {
    const res = await this.request<AvailabilityListResponse>('/availability/me');
    return res;
  }

  async getByUser(userId: string): Promise<AvailabilityListResponse> {
    const res = await this.request<AvailabilityListResponse>(`/availability/user/${userId}`);
    return res;
  }

  /** App-scoped: get weekly availability for an app. */
  async getByApp(appId: string): Promise<AvailabilityListResponse> {
    const res = await this.request<AvailabilityListResponse>(`/availability/apps/${appId}`);
    return res;
  }

  async bulkReplace(payload: AvailabilityBulkRequest): Promise<AvailabilityListResponse> {
    const res = await this.request<AvailabilityListResponse>('/availability/bulk', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res;
  }

  /** App-scoped: bulk replace weekly availability for an app. */
  async bulkReplaceForApp(appId: string, payload: AvailabilityBulkRequest): Promise<AvailabilityListResponse> {
    const res = await this.request<AvailabilityListResponse>(`/availability/apps/${appId}/bulk`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res;
  }

  /** App-scoped: get availability exceptions in date range. */
  async getExceptions(appId: string, from: string, to: string): Promise<AvailabilityExceptionsResponse> {
    const res = await this.request<AvailabilityExceptionsResponse>(
      `/availability/apps/${appId}/exceptions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    );
    return res;
  }

  /** App-scoped: upsert a single availability exception. */
  async putException(appId: string, payload: AvailabilityExceptionUpsertRequest): Promise<{ status: string; data: { exception: AvailabilityExceptionUpsertRequest } }> {
    return this.request(`/availability/apps/${appId}/exceptions`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  /** App-scoped: bulk upsert availability exceptions. */
  async putExceptionsBulk(appId: string, payload: AvailabilityExceptionsBulkRequest): Promise<{ status: string; data: { count: number } }> {
    return this.request(`/availability/apps/${appId}/exceptions/bulk`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  /** App-scoped: delete a single availability exception by date. */
  async deleteException(appId: string, date: string): Promise<{ status: string; message: string }> {
    return this.request(`/availability/apps/${appId}/exceptions/${encodeURIComponent(date)}`, {
      method: 'DELETE',
    });
  }

  /** App-scoped: retry Outlook sync for an exception by date. */
  async retryExceptionSync(appId: string, date: string): Promise<{ status: string; message: string }> {
    return this.request(`/availability/apps/${appId}/exceptions/${encodeURIComponent(date)}/retry-sync`, {
      method: 'POST',
    });
  }
}

export const availabilityService = new AvailabilityService();
export const useAvailabilityService = () => import('./availabilityService').then(m => m.availabilityService);


