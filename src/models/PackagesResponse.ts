import { Package } from './Package';

export class PackagesResponse {
  status: string;
  count: number;
  data: {
    packages: Package[];
  };

  constructor(data: Partial<PackagesResponse>) {
    this.status = data.status || '';
    this.count = data.count || 0;
    this.data = {
      packages: (data.data?.packages || []).map(pkg => Package.fromJson(pkg)),
    };
  }

  static fromJson(json: any): PackagesResponse {
    return new PackagesResponse(json);
  }

  toJson(): any {
    return {
      status: this.status,
      count: this.count,
      data: {
        packages: this.data.packages.map(pkg => pkg.toJson()),
      },
    };
  }
}
