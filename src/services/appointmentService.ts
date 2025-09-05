import { HttpService } from './httpService';
import type { Appointment, AppointmentListResponse, AppointmentResponse } from '@/models/Appointment';

export interface AppointmentListParams {
  page?: number;
  limit?: number;
  from?: string; // ISO
  to?: string;   // ISO
  q?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class AppointmentService extends HttpService {
  async listByUser(userId: string, params: AppointmentListParams = {}): Promise<AppointmentListResponse> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.q) qs.set('q', params.q);
    if (params.sortBy) qs.set('sortBy', params.sortBy);
    if (params.sortOrder) qs.set('sortOrder', params.sortOrder);
    const url = `/appointments/user/${userId}` + (qs.toString() ? `?${qs.toString()}` : '');
    return this.request<AppointmentListResponse>(url);
  }

  async create(payload: Appointment): Promise<AppointmentResponse> {
    return this.request<AppointmentResponse>('/appointments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async update(id: string, payload: Partial<Appointment>): Promise<AppointmentResponse> {
    return this.request<AppointmentResponse>(`/appointments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async remove(id: string): Promise<{ status: string }> {
    return this.request<{ status: string }>(`/appointments/${id}`, { method: 'DELETE' });
  }
}

export const appointmentService = new AppointmentService();
export const useAppointmentService = () => import('./appointmentService').then(m => m.appointmentService);


