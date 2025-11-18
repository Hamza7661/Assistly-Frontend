import { HttpService } from './httpService';

interface SignupRequest {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  professionDescription: string;
  password: string;
}

interface SigninRequest {
  email: string;
  password: string;
}

interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  professionDescription?: string;
  industry?: string;
  region?: string;
  package?: string;
  preferences?: {
    notifications?: {
      email?: boolean;
      sms?: boolean;
      push?: boolean;
    };
    language?: string;
    timezone?: string;
  };
}

interface AuthResponse {
  status: string;
  message: string;
  data: {
    user: any;
    tokens?: {
      accessToken: string;
      refreshToken: string;
    };
    token?: string;
    refreshToken?: string;
    requiresEmailVerification?: boolean;
  };
}

class AuthService extends HttpService {
  async signup(data: SignupRequest): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response;
  }

  async signin(data: SigninRequest): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/signin', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response;
  }

  async getUserProfile(userId: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>(`/users/${userId}`, {
      method: 'GET',
    });
    return response;
  }

  async updateUserProfile(userId: string, data: UpdateProfileRequest): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response;
  }

  async getCurrentUser(): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/users/me');
    return response;
  }

  async sendVerificationEmail(email: string, htmlTemplate: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/email/verify/send', {
      method: 'POST',
      body: JSON.stringify({ email, htmlTemplate }),
    });
    return response;
  }



  async verifyEmail(token: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>(`/email/verify/${token}`);
    return response;
  }
}

export const authService = new AuthService();
