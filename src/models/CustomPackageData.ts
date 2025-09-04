export class CustomPackageData {
  name: string;
  description: string;
  price: {
    amount: number;
    currency: string;
    billingCycle: string;
  };
  limits: {
    chatbotQueries: number;
    voiceMinutes: number;
    storageGB: number;
    teamMembers: number;
  };
  features: {
    chatbot: boolean;
    voiceAgent: boolean;
    analytics: boolean;
    apiAccess: boolean;
    prioritySupport: boolean;
    customIntegration: boolean;
    whiteLabel: boolean;
  };
  isActive: boolean;

  constructor(data: Partial<CustomPackageData>) {
    this.name = data.name || '';
    this.description = data.description || '';
    this.price = data.price || {
      amount: 0,
      currency: 'USD',
      billingCycle: 'monthly',
    };
    this.limits = data.limits || {
      chatbotQueries: 0,
      voiceMinutes: 0,
      storageGB: 0,
      teamMembers: 0,
    };
    this.features = data.features || {
      chatbot: false,
      voiceAgent: false,
      analytics: false,
      apiAccess: false,
      prioritySupport: false,
      customIntegration: false,
      whiteLabel: false,
    };
    this.isActive = data.isActive || true;
  }

  static fromJson(json: any): CustomPackageData {
    return new CustomPackageData(json);
  }

  toJson(): any {
    return {
      name: this.name,
      description: this.description,
      price: this.price,
      limits: this.limits,
      features: this.features,
      isActive: this.isActive,
    };
  }

  calculatePrice(): number {
    let basePrice = 20;
    
    if (this.limits.chatbotQueries > 1000) {
      basePrice += Math.ceil((this.limits.chatbotQueries - 1000) / 1000) * 10;
    }
    
    if (this.limits.voiceMinutes > 300) {
      basePrice += Math.ceil((this.limits.voiceMinutes - 300) / 300) * 15;
    }
    
    if (this.limits.storageGB > 10) {
      basePrice += Math.ceil((this.limits.storageGB - 10) / 10) * 5;
    }
    
    if (this.limits.teamMembers > 5) {
      basePrice += Math.ceil((this.limits.teamMembers - 5) / 5) * 8;
    }

    return basePrice;
  }

  updatePrice(): void {
    this.price.amount = this.calculatePrice();
  }
}
