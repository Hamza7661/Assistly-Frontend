import { User } from './User';

export class AuthResponse {
  status: string;
  message: string;
  data: {
    user: User;
    token: string;
    refreshToken: string;
  };

  constructor(data: Partial<AuthResponse>) {
    this.status = data.status || '';
    this.message = data.message || '';
    this.data = data.data || {
      user: new User({}),
      token: '',
      refreshToken: '',
    };
  }

  static fromJson(json: any): AuthResponse {
    return new AuthResponse({
      ...json,
      data: {
        ...json.data,
        user: User.fromJson(json.data?.user || {}),
      },
    });
  }

  toJson(): any {
    return {
      status: this.status,
      message: this.message,
      data: {
        user: this.data.user.toJson(),
        token: this.data.token,
        refreshToken: this.data.refreshToken,
      },
    };
  }
}
