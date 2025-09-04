export class SignupData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  profession: string;
  package: string;
  password: string;

  constructor(data: Partial<SignupData>) {
    this.firstName = data.firstName || '';
    this.lastName = data.lastName || '';
    this.email = data.email || '';
    this.phoneNumber = data.phoneNumber || '';
    this.profession = data.profession || '';
    this.package = data.package || '';
    this.password = data.password || '';
  }

  static fromJson(json: any): SignupData {
    return new SignupData(json);
  }

  toJson(): any {
    return {
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      phoneNumber: this.phoneNumber,
      profession: this.profession,
      package: this.package,
      password: this.password,
    };
  }

  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.firstName.trim()) errors.push('First name is required');
    if (!this.lastName.trim()) errors.push('Last name is required');
    if (!this.email.trim()) errors.push('Email is required');
    if (!this.phoneNumber.trim()) errors.push('Phone number is required');
    if (!this.profession.trim()) errors.push('Profession is required');
    if (!this.package.trim()) errors.push('Package selection is required');
    if (!this.password || this.password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
