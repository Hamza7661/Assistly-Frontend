export class SigninData {
  email: string;
  password: string;

  constructor(data: Partial<SigninData>) {
    this.email = data.email || '';
    this.password = data.password || '';
  }

  static fromJson(json: any): SigninData {
    return new SigninData(json);
  }

  toJson(): any {
    return {
      email: this.email,
      password: this.password,
    };
  }

  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.email.trim()) errors.push('Email is required');
    if (!this.password) errors.push('Password is required');

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
