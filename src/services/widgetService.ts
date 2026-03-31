import { HttpService } from './httpService';
import type { IntegrationSettingsResponse } from '@/models/IntegrationSettings';

class WidgetService extends HttpService {
  private async hmacSha256Hex(secret: string, stringToSign: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(stringToSign);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
  }

  private async buildSignedParams(
    method: string,
    path: string,
    paramName: string,
    paramValue: string
  ): Promise<URLSearchParams> {
    const ts = Date.now().toString();
    const nonce = crypto.randomUUID();
    const secret = process.env.NEXT_PUBLIC_WIDGET_HMAC_SECRET || '';

    if (!secret) {
      throw new Error('Widget HMAC secret not configured');
    }

    const stringToSign = `${method.toUpperCase()}\n${path}\n${paramName}=${paramValue}\n${ts}\n${nonce}`;
    const sign = await this.hmacSha256Hex(secret, stringToSign);

    return new URLSearchParams({ ts, nonce, sign });
  }

  private async generateHmacSignature(ts: string, nonce: string, secret: string, userId: string): Promise<string> {
    // Create the string to sign in the format expected by the backend
    const method = "GET";
    const path = `/api/v1/integration/public/${userId}/me`;
    const stringToSign = `${method}\n${path}\nuserId=${userId}\n${ts}\n${nonce}`;
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(stringToSign);
    
    try {
      // Import the key
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      // Sign the message
      const signature = await crypto.subtle.sign('HMAC', key, messageData);
      
      // Convert ArrayBuffer to hex string (lowercase)
      const hashArray = Array.from(new Uint8Array(signature));
      const hexSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
      
      return hexSignature;
    } catch (error) {
      console.error('HMAC generation error:', error);
      throw error;
    }
  }

  async getIntegrationSettings(userId: string) {
    const ts = Date.now().toString();
    const nonce = crypto.randomUUID();
    const secret = process.env.NEXT_PUBLIC_WIDGET_HMAC_SECRET || '';
    
    if (!secret) {
      throw new Error('Widget HMAC secret not configured');
    }
    
    const sign = await this.generateHmacSignature(ts, nonce, secret, userId);
    
    const params = new URLSearchParams({
      ts,
      nonce,
      sign
    });
    
    return this.request<IntegrationSettingsResponse>(`/integration/public/${userId}/me?${params.toString()}`, { 
      method: 'GET' 
    });
  }

  async getIntegrationSettingsByApp(appId: string) {
    const method = "GET";
    const path = `/api/v1/integration/public/apps/${appId}`;
    const params = await this.buildSignedParams(method, path, 'appId', appId);
    
    return this.request<IntegrationSettingsResponse>(`/integration/public/apps/${appId}?${params.toString()}`, { 
      method: 'GET' 
    });
  }

  async createPublicLead(identifier: string, payload: Record<string, unknown>) {
    const method = 'POST';
    const path = `/api/v1/leads/public/${identifier}`;
    const params = await this.buildSignedParams(method, path, 'userId', identifier);
    return this.request<any>(`/leads/public/${identifier}?${params.toString()}`, {
      method,
      body: JSON.stringify(payload),
    });
  }

  async updatePublicLead(identifier: string, leadId: string, payload: Record<string, unknown>) {
    const method = 'PATCH';
    const path = `/api/v1/leads/public/${identifier}/${leadId}`;
    const params = await this.buildSignedParams(method, path, 'userId', identifier);
    return this.request<any>(`/leads/public/${identifier}/${leadId}?${params.toString()}`, {
      method,
      body: JSON.stringify(payload),
    });
  }
}

export const widgetService = new WidgetService();
