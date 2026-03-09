export interface App {
  id: string;
  name: string;
  industry: string;
  description?: string;
  whatsappNumber?: string;
  whatsappNumberSource?: 'user-provided' | 'twilio-provided';
  whatsappNumberStatus?: 'pending' | 'registered' | 'failed';
  twilioWhatsAppSenderId?: string;
  /** When true, this app is the one that receives Twilio webhooks/leads for its number (when multiple apps share the same number). */
  usesTwilioNumber?: boolean;
  /** Facebook Page ID (stored by OAuth flow; used for Messenger routing). */
  facebookPageId?: string;
  /** Display name of the connected Facebook Page. */
  facebookPageName?: string;
  /** When the long-lived Facebook token expires (~60 days from last connect). */
  facebookTokenExpiry?: string;
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
  usesTwilioNumber?: boolean;
  facebookPageId?: string;
  facebookPageName?: string;
  facebookTokenExpiry?: string;
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
    this.usesTwilioNumber = !!data.usesTwilioNumber;
    this.facebookPageId = data.facebookPageId || undefined;
    this.facebookPageName = data.facebookPageName || undefined;
    this.facebookTokenExpiry = data.facebookTokenExpiry || undefined;
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
      usesTwilioNumber: this.usesTwilioNumber,
      facebookPageId: this.facebookPageId,
      facebookPageName: this.facebookPageName,
      facebookTokenExpiry: this.facebookTokenExpiry,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
