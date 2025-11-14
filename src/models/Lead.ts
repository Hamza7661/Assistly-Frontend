export interface ConversationMessage {
  role: 'assistant' | 'user';
  content: string;
}

export interface Lead {
  _id?: string;
  title: string;
  summary?: string;
  description?: string;
  leadName?: string;
  leadPhoneNumber?: string;
  leadEmail?: string;
  leadType?: string;
  serviceType?: string;
  leadDateTime?: string; // ISO string
  history?: ConversationMessage[];
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

