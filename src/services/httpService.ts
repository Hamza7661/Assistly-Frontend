import { handleUnauthorized, isAuthError } from '@/utils/authUtils';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export class HttpService {
  protected async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Automatically get token from localStorage if not provided
    const hasAuthHeader = options.headers && typeof options.headers === 'object' && 'Authorization' in options.headers;
    const token = hasAuthHeader ? null : localStorage.getItem('token');
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);
    
    if (!response.ok) {
      // Try to parse error response to get API error message
      let errorMessage = `HTTP request failed: ${response.statusText}`;
      let apiError: any = null;
      
      try {
        const errorData = await response.json();
        apiError = errorData;
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (parseError) {
        // If we can't parse JSON, use default error message
      }
      
      // Handle 401 Unauthorized - token is invalid/expired
      if (isAuthError(response)) {
        handleUnauthorized();
        // For auth errors, preserve the API error message if available
        if (apiError && apiError.message) {
          throw new Error(apiError.message);
        }
        throw new Error('Authentication failed. Please sign in again.');
      }
      
      // For other errors, throw with API error message if available
      const error = new Error(errorMessage);
      (error as any).response = { status: response.status, data: apiError };
      throw error;
    }

    return response.json();
  }
}
