/**
 * Handle 401 Unauthorized responses by clearing auth data and redirecting
 */
export const handleUnauthorized = () => {
  // Clear all authentication data
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  
  // Only redirect if not already on signin page to avoid loops
  if (window.location.pathname !== '/signin') {
    window.location.href = '/signin';
  }
};

/**
 * Check if a response indicates authentication failure
 */
export const isAuthError = (response: Response): boolean => {
  return response.status === 401;
};

/**
 * Validate token exists in localStorage
 */
export const hasValidToken = (): boolean => {
  const token = localStorage.getItem('token');
  return !!token;
};
