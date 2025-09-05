export interface Lead {
  _id?: string;
  title: string;
  summary?: string;
  description?: string;
  leadType?: string;
  serviceType?: string;
  leadDateTime?: string; // ISO string
  createdAt?: string;
  updatedAt?: string;
}

export interface LeadsListResponse {
  status: 'success' | 'fail';
  data: {
    leads: Lead[];
    count: number;
  };
}

export interface LeadResponse {
  status: 'success' | 'fail';
  data: {
    lead: Lead;
  };
}

