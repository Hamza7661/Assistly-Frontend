'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthService, useTemplateService } from '@/services';
import { User } from '@/models/User';
import { Mail, Lock, User as UserIcon, Eye, EyeOff, CheckCircle } from 'lucide-react';
import Logo from '@/components/Logo';
import styles from './styles.module.css';

export default function SigninPage() {
  return (
    <Suspense fallback={null}>
      <SigninContent />
    </Suspense>
  );
}

function SigninContent() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showVerificationNotice, setShowVerificationNotice] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [resendCountdown, setResendCountdown] = useState(30);
  const [isResending, setIsResending] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const searchParams = useSearchParams();

  // Check if user came from verification flow
  useEffect(() => {
    const email = searchParams.get('verificationEmail');
    if (email) {
      setVerificationEmail(email);
      setShowVerificationNotice(true);
      setResendCountdown(30);
    }
  }, [searchParams]);

  // Check if user is already authenticated and redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);



  // Handle countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (resendCountdown > 0 && showVerificationNotice) {
      timer = setTimeout(() => {
        setResendCountdown(prev => prev - 1);
      }, 1000);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [resendCountdown, showVerificationNotice]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const sendVerificationEmail = async (email: string) => {
    try {
      const authService = await useAuthService();
      const templateService = await useTemplateService();
      
      // Load and process email template (frontend fills static placeholders, backend handles verification token)
      const rawTemplate = await templateService.loadTemplate('emailVerification');
      const htmlTemplate = templateService.processTemplate(rawTemplate, {
        USER_EMAIL: email,
        BASE_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000'
      });
      const response = await authService.sendVerificationEmail(email, htmlTemplate);
      
      if (response.status === 'success') {
        setError('');
      } else {
        setError('Failed to send verification email. Please try again.');
      }
    } catch (error: any) {
      setError('Failed to send verification email. Please try again.');
    }
  };

  const handleResendVerification = async () => {
    if (resendCountdown > 0 || isResending) return;
    
    setIsResending(true);
    try {
      await sendVerificationEmail(verificationEmail);
      setResendCountdown(30);
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.email.trim() || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);

    try {
      const authService = await useAuthService();
      const response = await authService.signin({
        email: formData.email,
        password: formData.password
      });

      if (response.status === 'success') {
        // Create user object from response
        const user = new User(response.data.user);
        const token = response.data.tokens?.accessToken || response.data.token;
        
        if (token) {
          // Check if email is verified FIRST, before authenticating
          if (user.needsEmailVerification()) {
            setVerificationEmail(user.email);
            setShowVerificationNotice(true);
            setResendCountdown(30);
            // Automatically send verification email
            sendVerificationEmail(user.email);
            return; // Don't authenticate or redirect - user needs to verify email first
          }
          
          // Only authenticate if email is verified
          await login(token);
          
          // Always redirect to dashboard after login
          router.push('/dashboard');
        } else {
          setError('Authentication token not received');
        }
      } else {
        setError(response.message || 'Signin failed');
      }
    } catch (err: any) {
      // The HttpService now preserves API error messages in err.message
      // and provides response data in err.response.data
      if (err.response?.status === 404) {
        setError('Account not found. Please sign up first.');
      } else if (err.response?.status === 401) {
        // Use the API error message if available, otherwise fallback
        setError(err.message || 'Invalid email or password. Please try again.');
      } else {
        // Use the API error message if available, otherwise fallback
        setError(err.message || 'An error occurred during signin');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.formContainer}>
        <div className={styles.header}>
          <div className={styles.logoContainer}>
            <Logo width={140} height={42} />
          </div>
          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.subtitle}>Sign in to your Assistly account</p>
        </div>

        {showVerificationNotice && (
          <div className={styles.verificationNotice}>
            <div className={styles.verificationHeader}>
              <CheckCircle className={styles.verificationIcon} />
              <div className={styles.verificationText}>
                <h3>Email Verification Required</h3>
                <p>Your email <strong>{verificationEmail}</strong> needs to be verified before you can access your account. We've sent a verification email. Please check your inbox and click the verification link.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendCountdown > 0 || isResending}
              className={styles.resendButton}
            >
              {isResending ? (
                'Sending...'
              ) : resendCountdown > 0 ? (
                `Resend in ${resendCountdown}s`
              ) : (
                'Resend Verification Email'
              )}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.errorMessage}>
              {error}
              {error.includes('Account not found') && (
                <div className={styles.signupPrompt}>
                  <a href="/signup" className={styles.signupLink}>
                    Create an account here
                  </a>
                </div>
              )}
            </div>
          )}

          <div className={styles.formFields}>
            <div className={styles.fieldGroup}>
              <label htmlFor="email" className={styles.fieldLabel}>
                Email Address
              </label>
              <div className={styles.inputWrapper}>
                <Mail className={styles.inputIcon} />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={styles.inputFieldWithIcon}
                  placeholder="Enter your email address"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                />
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="password" className={styles.fieldLabel}>
                Password
              </label>
              <div className={styles.inputWrapper}>
                <Lock className={styles.inputIcon} />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className={styles.inputFieldWithPassword}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={styles.passwordToggle}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`${styles.submitButton} ${isLoading ? styles.submitButtonDisabled : ''}`}
          >
            {isLoading ? (
              <>
                <div className={styles.loadingSpinner}></div>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className={styles.footer}>
          <p className={styles.footerText}>
            Don't have an account?{' '}
            <a href="/signup" className={styles.footerLink}>
              Sign up
            </a>
          </p>
          <p className={styles.helpText}>
            Copyright © 2025 Assistly. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
