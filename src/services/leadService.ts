import { HttpService } from './httpService';
import type { Lead, LeadsListResponse, LeadResponse } from '@/models/Lead';

class LeadService extends HttpService {
  async listByUser(
    userId: string,
    params: {
      q?: string;
      leadType?: string;
      serviceType?: string;
      sourceChannel?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      page?: number;
      limit?: number;
    } = {}
  ) {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.leadType) query.set('leadType', params.leadType);
    if (params.serviceType) query.set('serviceType', params.serviceType);
    if (params.sourceChannel) query.set('sourceChannel', params.sourceChannel);
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    const endpoint = `/leads/user/${userId}${query.toString() ? `?${query.toString()}` : ''}`;
    return this.request<LeadsListResponse>(endpoint, { method: 'GET' });
  }

  async listByApp(
    appId: string,
    params: {
      q?: string;
      leadType?: string;
      serviceType?: string;
      sourceChannel?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      page?: number;
      limit?: number;
    } = {}
  ) {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.leadType) query.set('leadType', params.leadType);
    if (params.serviceType) query.set('serviceType', params.serviceType);
    if (params.sourceChannel) query.set('sourceChannel', params.sourceChannel);
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    const endpoint = `/leads/apps/${appId}${query.toString() ? `?${query.toString()}` : ''}`;
    return this.request<LeadsListResponse>(endpoint, { method: 'GET' });
  }

  async getById(id: string) {
    return this.request<LeadResponse>(`/leads/${id}`, { method: 'GET' });
  }

  async getReadStateByApp(appId: string, leadIds: string[]) {
    const uniq = Array.from(new Set(leadIds.filter(Boolean)));
    if (uniq.length === 0) {
      return { status: 'success' as const, data: { reads: {} as Record<string, string> } };
    }
    const query = new URLSearchParams();
    query.set('leadIds', uniq.join(','));
    return this.request<{ status: 'success' | 'fail'; data: { reads: Record<string, string> } }>(
      `/leads/apps/${appId}/read-state?${query.toString()}`,
      { method: 'GET' }
    );
  }

  async markReadByApp(appId: string, leadIds: string[]) {
    const uniq = Array.from(new Set(leadIds.filter(Boolean)));
    return this.request<{ status: 'success' | 'fail'; data: { updated: number } }>(
      `/leads/apps/${appId}/read-state/mark`,
      {
        method: 'POST',
        body: JSON.stringify({ leadIds: uniq }),
      }
    );
  }

  async update(id: string, lead: Partial<Lead>) {
    return this.request<LeadResponse>(`/leads/${id}`, {
      method: 'PUT',
      body: JSON.stringify(lead),
    });
  }

  async remove(id: string) {
    return this.request<{ status: string }>(`/leads/${id}`, { method: 'DELETE' });
  }
}

export const leadService = new LeadService();

