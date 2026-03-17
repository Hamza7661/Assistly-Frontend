'use client';

import { useState } from 'react';
import { useAppService } from '@/services';
import { Loader2, CheckCircle2, Phone } from 'lucide-react';
import { toast } from 'react-toastify';

const COUNTRY_OPTIONS = [
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' },
  { code: 'AU', label: 'Australia' },
  { code: 'IN', label: 'India' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'ES', label: 'Spain' },
  { code: 'IT', label: 'Italy' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'BR', label: 'Brazil' },
  { code: 'MX', label: 'Mexico' },
];

interface WhatsAppNumberWizardProps {
  appId: string;
  mode: 'assign' | 'verify';
  /** For assign: optional initial country. For verify: optional message. */
  onSuccess?: (data: { phoneNumber?: string; status?: string }) => void;
  onError?: (message: string) => void;
  /** When assign/verify is skipped or not needed */
  onSkip?: () => void;
}

export default function WhatsAppNumberWizard({ appId, mode, onSuccess, onError, onSkip }: WhatsAppNumberWizardProps) {
  const [countryCode, setCountryCode] = useState('US');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [assignedNumber, setAssignedNumber] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleAssign = async () => {
    setLoading(true);
    try {
      const appService = await useAppService();
      const response = await appService.assignNumber(appId, countryCode);
      if (response.status === 'success' && response.data?.app) {
        const app = response.data.app;
        setAssignedNumber(app.whatsappNumber || app.twilioPhoneNumber || null);
        setStatus(app.whatsappNumberStatus || null);
        toast.success('Number assigned successfully');
        onSuccess?.({ phoneNumber: app.whatsappNumber || app.twilioPhoneNumber, status: app.whatsappNumberStatus });
      } else {
        const msg = (response as any).message || 'Failed to assign number';
        onError?.(msg);
        toast.error(msg);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to assign number';
      onError?.(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    const code = verificationCode.trim();
    if (!code) {
      toast.error('Enter the verification code');
      return;
    }
    setLoading(true);
    try {
      const appService = await useAppService();
      const response = await appService.verifyWhatsApp(appId, code);
      if (response.status === 'success' && response.data?.app) {
        const app = response.data.app;
        setStatus(app.whatsappNumberStatus || null);
        toast.success(app.whatsappNumberStatus === 'registered' ? 'WhatsApp number verified' : 'Verification submitted');
        onSuccess?.({ status: app.whatsappNumberStatus });
      } else {
        const msg = (response as any).message || 'Verification failed';
        onError?.(msg);
        toast.error(msg);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Verification failed';
      onError?.(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'assign') {
    if (assignedNumber) {
      return (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Number assigned</p>
              <p className="text-sm flex items-center gap-1 mt-1">
                <Phone className="h-4 w-4" />
                {assignedNumber}
              </p>
              {status && (
                <p className="text-xs mt-1 text-green-700">
                  Status: {status === 'registered' ? 'Registered' : status === 'pending' ? 'Pending verification' : status}
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
        <h4 className="font-medium text-gray-900">Assign number</h4>
        <p className="text-sm text-gray-600">Select your country to assign the first available SMS+voice number.</p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            className="input-field w-auto min-w-[140px]"
          >
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAssign}
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Assign number
          </button>
          {onSkip && (
            <button type="button" onClick={onSkip} className="btn-secondary">
              Skip
            </button>
          )}
        </div>
      </div>
    );
  }

  // mode === 'verify'
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
      <h4 className="font-medium text-gray-900">Verify your number</h4>
      <p className="text-sm text-gray-600">
        A verification code was sent to your number. Enter it below.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Verification code"
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value)}
          className="input-field w-40"
          maxLength={10}
        />
        <button
          type="button"
          onClick={handleVerify}
          disabled={loading}
          className="btn-primary flex items-center gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Verify
        </button>
        {onSkip && (
          <button type="button" onClick={onSkip} className="btn-secondary">
            Skip
            </button>
        )}
      </div>
      {status === 'registered' && (
        <div className="flex items-center gap-2 text-green-700 text-sm">
          <CheckCircle2 className="h-4 w-4" />
          WhatsApp number verified.
        </div>
      )}
    </div>
  );
}
