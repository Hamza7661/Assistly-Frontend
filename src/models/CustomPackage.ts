import { Package } from './Package';

export class CustomPackage extends Package {
  userId: string;

  constructor(data: Partial<CustomPackage>) {
    super(data);
    this.userId = data.userId || '';
    this.type = 'custom';
  }

  static fromJson(json: any): CustomPackage {
    return new CustomPackage(json);
  }

  toJson(): any {
    return {
      ...super.toJson(),
      userId: this.userId,
    };
  }
}
