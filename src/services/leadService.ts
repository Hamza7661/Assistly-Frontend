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
    const isObjectId = (value: string) => /^[a-fA-F0-9]{24}$/.test(value);
    const uniq = Array.from(
      new Set(
        leadIds
          .map((id) => String(id || '').trim())
          .filter((id) => id && isObjectId(id))
      )
    );
    if (uniq.length === 0) {
      return { status: 'success' as const, data: { reads: {} as Record<string, string> } };
    }

    // Keep query strings short and resilient to proxy/path limits.
    const CHUNK_SIZE = 80;
    const readMap: Record<string, string> = {};
    try {
      for (let i = 0; i < uniq.length; i += CHUNK_SIZE) {
        const chunk = uniq.slice(i, i + CHUNK_SIZE);
        const query = new URLSearchParams();
        query.set('leadIds', chunk.join(','));
        const res = await this.request<{ status: 'success' | 'fail'; data: { reads: Record<string, string> } }>(
          `/leads/apps/${appId}/read-state?${query.toString()}`,
          { method: 'GET' }
        );
        Object.assign(readMap, res?.data?.reads || {});
      }
      return { status: 'success' as const, data: { reads: readMap } };
    } catch {
      // Non-blocking UX: notifications should still render even if read-state sync fails.
      return { status: 'success' as const, data: { reads: {} as Record<string, string> } };
    }
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

