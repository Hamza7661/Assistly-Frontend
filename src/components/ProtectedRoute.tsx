'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthService } from '@/services';
import { User } from '@/models/User';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requirePackage?: boolean;
  redirectTo?: string;
}

export default function ProtectedRoute({ 
  children, 
  requirePackage = false, 
  redirectTo 
}: ProtectedRouteProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, updateUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      // Wait for auth to be determined
      if (authLoading) {
        return;
      }

      // Check if user is authenticated
      if (!isAuthenticated) {
        router.push('/signin');
        return;
      }

             // If we need user data (for package check or display), fetch it
       if (!user) {
         try {
           const authService = await useAuthService();
           const response = await authService.getCurrentUser();
           
           if (response.status === 'success') {
             const freshUser = new User(response.data.user);
             updateUser(freshUser);
             
             // Only check package requirement if this route requires it
             if (requirePackage && !freshUser.hasPackage()) {
               router.push(redirectTo || '/packages');
               return;
             }
           } else {
             // API call failed, redirect to signin
             router.push('/signin');
             return;
           }
         } catch (error) {
           console.error('Error fetching user data:', error);
           router.push('/signin');
           return;
         }
       }

      // All checks passed
      setIsLoading(false);
    };

    checkAccess();
     }, [isAuthenticated, authLoading, requirePackage, redirectTo, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
  );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
