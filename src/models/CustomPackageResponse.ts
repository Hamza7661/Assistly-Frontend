import { CustomPackage } from './CustomPackage';

export class CustomPackageResponse {
  status: string;
  message: string;
  data: {
    customPackage: CustomPackage;
  };

  constructor(data: Partial<CustomPackageResponse>) {
    this.status = data.status || '';
    this.message = data.message || '';
    this.data = {
      customPackage: data.data?.customPackage 
        ? CustomPackage.fromJson(data.data.customPackage)
        : new CustomPackage({}),
    };
  }

  static fromJson(json: any): CustomPackageResponse {
    return new CustomPackageResponse(json);
  }

  toJson(): any {
    return {
      status: this.status,
      message: this.message,
      data: {
        customPackage: this.data.customPackage.toJson(),
      },
    };
  }
}
