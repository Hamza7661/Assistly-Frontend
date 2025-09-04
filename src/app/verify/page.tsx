'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthService } from '@/services';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import styles from './styles.module.css';

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyContent />
    </Suspense>
  );
}

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [verificationStatus, setVerificationStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setVerificationStatus('error');
      setErrorMessage('Verification token is missing. Please check your email and try again.');
      return;
    }

    verifyEmail(token);
  }, [searchParams]);

  useEffect(() => {
    if (verificationStatus === 'success' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (verificationStatus === 'success' && countdown === 0) {
      router.push('/dashboard');
    }
  }, [verificationStatus, countdown, router]);

  const verifyEmail = async (token: string) => {
    try {
      const authService = await useAuthService();
      const response = await authService.verifyEmail(token);
      
      if (response.status === 'success') {
        setVerificationStatus('success');
        
        // If verification includes tokens, log the user in
        if (response.data.token) {
          login(response.data.token);
        }
      } else {
        setVerificationStatus('error');
        setErrorMessage(response.message || 'Verification failed. Please try again.');
      }
    } catch (error: any) {
      setVerificationStatus('error');
      setErrorMessage(error?.message || 'Verification failed. Please try again.');
    }
  };

  const renderContent = () => {
    switch (verificationStatus) {
      case 'verifying':
        return (
          <div className={styles.verifyingContent}>
            <Loader2 className={styles.loadingIcon} />
            <h2 className={styles.title}>Verifying Your Email</h2>
            <p className={styles.subtitle}>Please wait while we verify your email address...</p>
          </div>
        );
      
      case 'success':
        return (
          <div className={styles.successContent}>
            <CheckCircle className={styles.successIcon} />
            <h2 className={styles.title}>Email Verified Successfully!</h2>
            <p className={styles.subtitle}>
              Your email has been verified. You will be redirected to the dashboard in {countdown} seconds.
            </p>
            <button 
              onClick={() => router.push('/dashboard')} 
              className={styles.dashboardButton}
            >
              Go to App Now
            </button>
          </div>
        );
      
      case 'error':
        return (
          <div className={styles.errorContent}>
            <XCircle className={styles.errorIcon} />
            <h2 className={styles.title}>Verification Failed</h2>
            <p className={styles.subtitle}>{errorMessage}</p>
            <div className={styles.actionButtons}>
              <button 
                onClick={() => router.push('/signin')} 
                className={styles.signinButton}
              >
                Go to Sign In
              </button>
              <button 
                onClick={() => router.push('/signup')} 
                className={styles.signupButton}
              >
                Sign Up Again
              </button>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.verificationCard}>
        <div className={styles.logoSection}>
          <div className={styles.logoIcon}>
            <span className={styles.logoText}>A</span>
          </div>
          <h1 className={styles.brandName}>Assistly</h1>
        </div>
        
        {renderContent()}
      </div>
    </div>
  );
}
