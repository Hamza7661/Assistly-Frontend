'use client';

import { useState, useEffect } from 'react';
import { useAuthService } from '@/services';
import { templateService } from '@/services/templateService';
import { Mail, CheckCircle, X, Loader2 } from 'lucide-react';
import styles from './EmailVerificationModal.module.css';

interface EmailVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  onVerificationSent: () => void;
}

export default function EmailVerificationModal({ 
  isOpen, 
  onClose, 
  userEmail, 
  onVerificationSent 
}: EmailVerificationModalProps) {
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');
  const [resendCountdown, setResendCountdown] = useState(30);

  // Send verification email automatically when modal opens
  useEffect(() => {
    if (isOpen && !isSent && !isSending) {
      handleSendVerification();
      setResendCountdown(30); // Reset countdown when modal opens
    }
  }, [isOpen]);

  // Handle countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (resendCountdown > 0 && isOpen) {
      timer = setTimeout(() => {
        setResendCountdown(prev => prev - 1);
      }, 1000);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [resendCountdown, isOpen]);

  const handleSendVerification = async () => {
    setIsSending(true);
    setError('');

    try {
      const authService = await useAuthService();
      
      // Generate a temporary verification token (this will be replaced by backend)
      const tempToken = 'temp-token-' + Date.now();
      
      // Get the email template from templates folder
      const htmlTemplate = await templateService.getEmailVerificationTemplate(userEmail, tempToken);
      
      const response = await authService.sendVerificationEmail(userEmail, htmlTemplate);
      
      if (response.status === 'success') {
        setIsSent(true);
        onVerificationSent();
        setResendCountdown(30); // Reset countdown after successful send
      } else {
        setError(response.message || 'Failed to send verification email. Please try again.');
      }
    } catch (error: any) {
      setError(error?.message || 'Failed to send verification email. Please try again.');
    } finally {
      setIsSending(false);
    }
  };



  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>
          <X className={styles.closeIcon} />
        </button>

        {!isSent ? (
          <div className={styles.content}>
            <div className={styles.iconContainer}>
              <Mail className={styles.mailIcon} />
            </div>
            
            <h2 className={styles.title}>Verify Your Email</h2>
            <p className={styles.message}>
              We're sending a verification email to <strong>{userEmail}</strong>. 
              Please check your inbox and click the verification link to complete your registration.
            </p>
            
            <div className={styles.actions}>
                              <button 
                  onClick={handleSendVerification}
                  disabled={isSending || resendCountdown > 0}
                  className={styles.sendButton}
                >
                  {isSending ? (
                    <>
                      <Loader2 className={styles.loadingIcon} />
                      Sending...
                    </>
                  ) : resendCountdown > 0 ? (
                    `Resend in ${resendCountdown}s`
                  ) : (
                    'Resend Verification Email'
                  )}
                </button>
            </div>
            
            {error && (
              <div className={styles.error}>
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className={styles.successContent}>
            <div className={styles.iconContainer}>
              <CheckCircle className={styles.successIcon} />
            </div>
            
            <h2 className={styles.title}>Verification Email Sent!</h2>
            <p className={styles.message}>
              We've sent a verification email to <strong>{userEmail}</strong>. 
              Please check your inbox and click the verification link to complete your registration.
            </p>
            
            <button onClick={onClose} className={styles.doneButton}>
              Got It!
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
