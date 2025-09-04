import { PackageType } from '@/enums/PackageType';

export class Package {
  _id: string;
  id: number;
  name: string;
  type: PackageType;
  price: {
    amount: number;
    currency: string;
    billingCycle?: string;
    formatted?: string;
  };
  limits: {
    chatbotQueries: number;
    voiceMinutes: number;
    leadGeneration: number;
    formatted?: {
      chatbotQueries: string;
      voiceMinutes: string;
      leadGeneration: string;
    };
  };
  features: {
    chatbot: boolean;
    voiceAgent: boolean;
    leadGeneration: boolean;
  };
  description: string;
  isActive: boolean;
  isPopular?: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
  isUnlimited?: boolean;
  isFree?: boolean;

  constructor(data: Partial<Package>) {
    this._id = data._id || '';
    this.id = data.id || 0;
    this.name = data.name || '';
    // Properly parse the type field, ensuring it's a valid PackageType enum value
    this.type = this.parsePackageType(data.type);
    this.price = data.price || { amount: 0, currency: 'USD' };
    this.limits = data.limits || {
      chatbotQueries: 0,
      voiceMinutes: 0,
      leadGeneration: 0,
    };
    this.features = data.features || {
      chatbot: false,
      voiceAgent: false,
      leadGeneration: false,
    };
    this.description = data.description || '';
    this.isActive = data.isActive || false;
    this.isPopular = data.isPopular || false;
    this.sortOrder = data.sortOrder || 0;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.isUnlimited = data.isUnlimited || false;
    this.isFree = data.isFree || false;
  }

  private parsePackageType(type: any): PackageType {
    if (!type) return PackageType.BASIC;
    
    // If it's already a PackageType enum value, return it
    if (Object.values(PackageType).includes(type)) {
      return type as PackageType;
    }
    
    // If it's a string, try to match it to enum values
    if (typeof type === 'string') {
      const typeStr = type.toLowerCase();
      switch (typeStr) {
        case 'custom':
          return PackageType.CUSTOM;
        case 'free-trial':
        case 'freetrial':
          return PackageType.FREE_TRIAL;
        case 'basic':
          return PackageType.BASIC;
        case 'pro':
          return PackageType.PRO;
        case 'premium':
          return PackageType.PREMIUM;
        case 'enterprise':
          return PackageType.ENTERPRISE;
        default:
          return PackageType.BASIC;
      }
    }
    
    return PackageType.BASIC;
  }

  get formattedPrice(): string {
    if (this.price.amount === 0) {
      return 'Free';
    }
    return `${this.price.currency} ${this.price.amount}`;
  }

  get isCustom(): boolean {
    return this.type === PackageType.CUSTOM;
  }

  static fromJson(json: any): Package {
    return new Package(json);
  }

  toJson(): any {
    return {
      _id: this._id,
      id: this.id,
      name: this.name,
      type: this.type,
      price: this.price,
      limits: this.limits,
      features: this.features,
      description: this.description,
      isActive: this.isActive,
      isPopular: this.isPopular,
      sortOrder: this.sortOrder,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      isUnlimited: this.isUnlimited,
      isFree: this.isFree,
    };
  }
}
