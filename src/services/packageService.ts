import { HttpService } from './httpService';
import { PackageType } from '@/enums/PackageType';

interface Package {
  _id: string;
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
  };
  features: {
    chatbot: boolean;
    voiceAgent: boolean;
    leadGeneration: boolean;
  };
  description: string;
}

interface CustomPackageRequest {
  type: PackageType.CUSTOM; // Fixed to custom type
  price: {
    amount: number;
    currency: string;
    billingCycle: string;
  };
  limits: {
    chatbotQueries: number;
    voiceMinutes: number;
    leadGeneration: number;
  };
  features: {
    chatbot: boolean;
    voiceAgent: boolean;
    leadGeneration: boolean;
  };
}

interface PackagesResponse {
  status: string;
  data: {
    packages: Package[];
  };
}

interface CustomPackageResponse {
  status: string;
  message: string;
  data: {
    package: Package;
  };
}

class PackageService extends HttpService {
  async getPackages(): Promise<PackagesResponse> {
    const response = await this.request<PackagesResponse>('/packages');
    return response;
  }

  async createCustomPackage(data: CustomPackageRequest): Promise<CustomPackageResponse> {
    const response = await this.request<CustomPackageResponse>('/packages/custom', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response;
  }
}

export const packageService = new PackageService();
