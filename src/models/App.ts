export interface App {
  id: string;
  name: string;
  industry: string;
  description?: string;
  whatsappNumber?: string;
  whatsappNumberSource?: 'user-provided' | 'twilio-provided';
  whatsappNumberStatus?: 'pending' | 'registered' | 'failed';
  twilioWhatsAppSenderId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export class AppModel implements App {
  id: string;
  name: string;
  industry: string;
  description?: string;
  whatsappNumber?: string;
  whatsappNumberSource?: 'user-provided' | 'twilio-provided';
  whatsappNumberStatus?: 'pending' | 'registered' | 'failed';
  twilioWhatsAppSenderId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  constructor(data: any) {
    this.id = data.id || data._id || '';
    this.name = data.name || '';
    this.industry = data.industry || '';
    this.description = data.description || undefined;
    this.whatsappNumber = data.whatsappNumber || undefined;
    this.whatsappNumberSource = data.whatsappNumberSource || undefined;
    this.whatsappNumberStatus = data.whatsappNumberStatus || undefined;
    this.twilioWhatsAppSenderId = data.twilioWhatsAppSenderId || undefined;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.createdAt = data.createdAt || '';
    this.updatedAt = data.updatedAt || '';
  }

  toJSON(): App {
    return {
      id: this.id,
      name: this.name,
      industry: this.industry,
      description: this.description,
      whatsappNumber: this.whatsappNumber,
      whatsappNumberSource: this.whatsappNumberSource,
      whatsappNumberStatus: this.whatsappNumberStatus,
      twilioWhatsAppSenderId: this.twilioWhatsAppSenderId,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
