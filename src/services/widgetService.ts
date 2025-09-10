import { HttpService } from './httpService';
import type { IntegrationSettingsResponse } from '@/models/IntegrationSettings';

class WidgetService extends HttpService {
  private async generateHmacSignature(ts: string, nonce: string, secret: string, userId: string): Promise<string> {
    // Create the string to sign in the format expected by the backend
    const method = "GET";
    const path = `/api/v1/integration/public/${userId}/me`;
    const stringToSign = `${method}\n${path}\nuserId=${userId}\n${ts}\n${nonce}`;
    
    console.log('HMAC Debug:', { 
      method, 
      path, 
      userId, 
      ts, 
      nonce, 
      stringToSign, 
      secret 
    });
    
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
      
      console.log('Generated signature:', hexSignature);
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
}

export const widgetService = new WidgetService();
