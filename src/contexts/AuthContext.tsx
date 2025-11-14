'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/models/User';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      // Validate the token by trying to get current user
      const validateToken = async () => {
        try {
          const { useAuthService } = await import('@/services');
          const authService = await useAuthService();
          const response = await authService.getCurrentUser();
          if (response.status === 'success') {
            setToken(savedToken);
            setUser(new User(response.data.user));
          } else {
            // Token is invalid, remove it
            localStorage.removeItem('token');
          }
        } catch (error) {
          // Token is invalid, remove it
          localStorage.removeItem('token');
        } finally {
          setIsLoading(false);
        }
      };
      validateToken();
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (token: string) => {
    setToken(token);
    localStorage.setItem('token', token);
    // Fetch user immediately after login
    try {
      const { useAuthService } = await import('@/services');
      const authService = await useAuthService();
      const response = await authService.getCurrentUser();
      if (response.status === 'success') {
        setUser(new User(response.data.user));
      }
    } catch (error) {
      console.error('Failed to fetch user after login:', error);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    // Don't need to remove user from localStorage
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    // Don't store user in localStorage
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    updateUser,
    isAuthenticated: !!token, // Only check token, not user
    isLoading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
