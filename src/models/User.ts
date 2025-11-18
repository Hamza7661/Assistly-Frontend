import { Package } from './Package';

export class User {
  _id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  twilioPhoneNumber?: string;
  email: string;
  professionDescription: string;
  industry?: string;
  region?: string;
  website?: string;
  package: Package | null;
  isActive: boolean;
  isVerified: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  lastLogin: string;
  profilePicture: string | null;
  preferences: UserPreferences;
  metadata: UserMetadata;
  createdAt: string;
  updatedAt: string;
  fullName: string;

  constructor(data: any) {
    this._id = data._id || '';
    this.firstName = data.firstName || '';
    this.lastName = data.lastName || '';
    this.phoneNumber = data.phoneNumber || '';
    this.twilioPhoneNumber = data.twilioPhoneNumber || undefined;
    this.email = data.email || '';
    this.professionDescription = data.professionDescription || '';
    this.industry = data.industry || '';
    this.region = data.region || 'us';
    this.website = data.website || '';
    this.package = data.package ? new Package(data.package) : null;
    this.isActive = data.isActive || false;
    this.isVerified = data.isVerified || false;
    this.emailVerified = data.emailVerified || false;
    this.phoneVerified = data.phoneVerified || false;
    this.lastLogin = data.lastLogin || '';
    this.profilePicture = data.profilePicture || null;
    this.preferences = new UserPreferences(data.preferences || {});
    this.metadata = new UserMetadata(data.metadata || {});
    this.createdAt = data.createdAt || '';
    this.updatedAt = data.updatedAt || '';
    this.fullName = data.fullName || `${this.firstName} ${this.lastName}`.trim();
  }

  get displayName(): string {
    return this.fullName || `${this.firstName} ${this.lastName}`.trim();
  }

  get initials(): string {
    return `${this.firstName.charAt(0)}${this.lastName.charAt(0)}`.toUpperCase();
  }

  hasPackage(): boolean {
    return this.package !== null;
  }

  needsEmailVerification(): boolean {
    return !this.emailVerified;
  }

  getPackageName(): string {
    return this.package?.name || 'No Package Selected';
  }

  getPackagePrice(): number {
    return typeof this.package?.price === 'object' ? this.package.price.amount : this.package?.price || 0;
  }

  toJSON() {
    return {
      _id: this._id,
      firstName: this.firstName,
      lastName: this.lastName,
      phoneNumber: this.phoneNumber,
      twilioPhoneNumber: this.twilioPhoneNumber,
      email: this.email,
      professionDescription: this.professionDescription,
      website: this.website,
      package: this.package?.toJson() || null,
      isActive: this.isActive,
      isVerified: this.isVerified,
      emailVerified: this.emailVerified,
      phoneVerified: this.phoneVerified,
      lastLogin: this.lastLogin,
      profilePicture: this.profilePicture,
      preferences: this.preferences.toJSON(),
      metadata: this.metadata.toJSON(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      fullName: this.fullName
    };
  }
}

export class UserPreferences {
  notifications: NotificationPreferences;
  language: string;
  timezone: string;

  constructor(data: any) {
    this.notifications = new NotificationPreferences(data.notifications || {});
    this.language = data.language || 'en';
    this.timezone = data.timezone || 'UTC';
  }

  toJSON() {
    return {
      notifications: this.notifications.toJSON(),
      language: this.language,
      timezone: this.timezone
    };
  }
}

export class NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;

  constructor(data: any) {
    this.email = data.email ?? true;
    this.sms = data.sms ?? true;
    this.push = data.push ?? true;
  }

  toJSON() {
    return {
      email: this.email,
      sms: this.sms,
      push: this.push
    };
  }
}

export class UserMetadata {
  signupSource: string;
  userAgent: string;
  ipAddress: string;
  referrer: string | null;

  constructor(data: any) {
    this.signupSource = data.signupSource || 'web';
    this.userAgent = data.userAgent || '';
    this.ipAddress = data.ipAddress || '';
    this.referrer = data.referrer || null;
  }

  toJSON() {
    return {
      signupSource: this.signupSource,
      userAgent: this.userAgent,
      ipAddress: this.ipAddress,
      referrer: this.referrer
    };
  }
}
