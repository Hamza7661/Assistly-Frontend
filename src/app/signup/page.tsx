'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthService, useTemplateService } from '@/services';
import { User } from '@/models/User';
import { Mail, Lock, User as UserIcon, Phone, Briefcase, Eye, EyeOff, Building2 } from 'lucide-react';
import { INDUSTRIES_LIST } from '@/enums/Industry';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { Spinner, FullPageSpinner, Logo } from '@/components';

import styles from './styles.module.css';

export default function SignupPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    professionDescription: '',
    industry: 'dental', // Auto-select dental industry
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.firstName.trim()) {
      setError('First name is required');
      return false;
    }
    if (!formData.lastName.trim()) {
      setError('Last name is required');
      return false;
    }
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!formData.phoneNumber.trim()) {
      setError('Phone number is required');
      return false;
    }
    if (!formData.professionDescription.trim()) {
      setError('Profession description is required');
      return false;
    }
    if (!formData.industry) {
      setError('Industry is required');
      return false;
    }
    if (!formData.password) {
      setError('Password is required');
      return false;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const authService = await useAuthService();
              const response = await authService.signup({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          professionDescription: formData.professionDescription,
          industry: formData.industry,
          password: formData.password
        });

      if (response.status === 'success') {
        // Check if email verification is required
        if (response.data.requiresEmailVerification) {
          // Send verification email first
          setIsVerifying(true);
          try {
            // Load and process email template (frontend fills static placeholders, backend handles verification token)
            const templateService = await useTemplateService();
            const rawTemplate = await templateService.loadTemplate('emailVerification');
            const htmlTemplate = templateService.processTemplate(rawTemplate, {
              USER_EMAIL: formData.email,
              BASE_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000'
            });
            
            const verificationResponse = await authService.sendVerificationEmail(formData.email, htmlTemplate);
            if (verificationResponse.status === 'success') {
              // Redirect to signin page with verification notice
              router.push(`/signin?verificationEmail=${encodeURIComponent(formData.email)}`);
            } else {
              setError('Account created but failed to send verification email. Please try signing in to resend.');
            }
          } catch (error: any) {
            setError('Account created but failed to send verification email. Please try signing in to resend.');
          } finally {
            setIsVerifying(false);
          }
        } else {
          // Handle both token formats from the API
          const token = response.data.tokens?.accessToken || response.data.token;
          
          if (token) {
            await login(token);
            router.push('/packages'); // Redirect to packages selection
          } else {
            setError('Authentication token not received');
          }
        }
      } else {
        // Handle error response from backend
        setError(response.message || 'Signup failed');
      }
          } catch (err: any) {
        // The HttpService now preserves API error messages in err.message
        // and provides response data in err.response.data
        if (err.response?.data?.message) {
          // Extract error message from response data
          setError(err.response.data.message);
        } else if (err.message) {
          // Use the API error message if available
          setError(err.message);
        } else if (err.errors) {
          // Handle backend validation errors
          const firstError = Object.values(err.errors)[0] as any;
          setError(firstError.message || 'Validation failed');
        } else {
          setError('An error occurred during signup');
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
          <h1 className={styles.title}>Create your account</h1>
          <p className={styles.subtitle}>Join Assistly and get started with your virtual assistant journey</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.errorMessage}>{error}</div>}

          <div className={styles.formFields}>
            <div className={styles.fieldGrid}>
              <div className={styles.fieldGroup}>
                <label htmlFor="firstName" className={styles.fieldLabel}>
                  First Name
                </label>
                <div className={styles.inputWrapper}>
                  <UserIcon className={styles.inputIcon} />
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    autoComplete="given-name"
                    required
                    className={styles.inputFieldWithIcon}
                    placeholder="Enter your first name"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="lastName" className={styles.fieldLabel}>
                  Last Name
                </label>
                <div className={styles.inputWrapper}>
                  <UserIcon className={styles.inputIcon} />
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    autoComplete="family-name"
                    required
                    className={styles.inputFieldWithIcon}
                    placeholder="Enter your last name"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                  />
                </div>
              </div>
            </div>

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
              <label htmlFor="phoneNumber" className={styles.fieldLabel}>
                Phone Number
              </label>
              <PhoneInput
                international
                defaultCountry={(process.env.NEXT_PUBLIC_DEFAULT_COUNTRY as any) || "GB"}
                value={formData.phoneNumber}
                onChange={(value) => handleInputChange('phoneNumber', value || '')}
                placeholder="Enter phone number"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00bc7d] focus:border-transparent outline-none transition-all duration-200"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="industry" className={styles.fieldLabel}>
                Industry
              </label>
              <div className={styles.inputWrapper}>
                <Building2 className={styles.inputIcon} />
                <select
                  id="industry"
                  name="industry"
                  required
                  className={styles.inputFieldWithIcon}
                  value={formData.industry}
                  onChange={(e) => handleInputChange('industry', e.target.value)}
                  disabled
                >
                  <option value="dental">Dental</option>
                </select>
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="professionDescription" className={styles.fieldLabel}>
                Profession Description
              </label>
                              <div className={styles.inputWrapper}>
                  <Briefcase className={styles.textareaIcon} />
                  <textarea
                  id="professionDescription"
                  name="professionDescription"
                  rows={3}
                  autoComplete="organization-title"
                  required
                  className={styles.textareaField}
                  placeholder="Write about your profession here"
                  value={formData.professionDescription}
                  onChange={(e) => handleInputChange('professionDescription', e.target.value)}
                />
              </div>
            </div>

            <div className={styles.fieldGrid}>
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
                    autoComplete="new-password"
                    required
                    className={styles.inputFieldWithPassword}
                    placeholder="Enter password"
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
                <p className={styles.passwordHint}>
                  Must be at least 8 characters long
                </p>
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="confirmPassword" className={styles.fieldLabel}>
                  Confirm Password
                </label>
                <div className={styles.inputWrapper}>
                  <Lock className={styles.inputIcon} />
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    className={styles.inputFieldWithPassword}
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className={styles.passwordToggle}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || isVerifying}
            className={`${styles.submitButton} ${(isLoading || isVerifying) ? styles.submitButtonDisabled : ''}`}
          >
            {isLoading ? 'Creating account...' : isVerifying ? 'Sending verification email...' : 'Create Account'}
          </button>
        </form>

        <div className={styles.footer}>
          <p className={styles.footerText}>
            Already have an account?{' '}
            <a href="/signin" className={styles.footerLink}>
              Sign in
            </a>
          </p>
        </div>
      </div>

      {/* Full Page Spinner */}
      <FullPageSpinner 
        isVisible={isLoading || isVerifying}
        text={isLoading ? 'Creating your account...' : 'Sending verification email...'}
      />
    </div>
  );
}
