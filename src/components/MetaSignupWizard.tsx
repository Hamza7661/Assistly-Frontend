'use client';

import { useState } from 'react';
import { useAppService } from '@/services';
import { Loader2, CheckCircle2, Phone, ExternalLink, Building2 } from 'lucide-react';
import { toast } from 'react-toastify';

const META_BUSINESS_SUITE_URL = 'https://business.facebook.com';

interface MetaSignupWizardProps {
  appId: string;
  /** Already assigned phone number (e.g. from Get Number) */
  assignedNumber: string;
  /** Optional WABA ID if already set on app */
  initialWabaId?: string | null;
  onSuccess?: () => void;
  onSkip?: () => void;
}

/**
 * Wizard for Meta WhatsApp Business setup after a number is assigned.
 * Connect business/WABA (select or create) for WhatsApp sender setup.
 */
export default function MetaSignupWizard({
  appId,
  assignedNumber,
  initialWabaId = null,
  onSuccess,
  onSkip
}: MetaSignupWizardProps) {
  const [step, setStep] = useState<'connect' | 'done'>(initialWabaId ? 'done' : 'connect');
  const [wabaId, setWabaId] = useState(initialWabaId || '');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(!!initialWabaId);

  const handleSaveWaba = async () => {
    setLoading(true);
    try {
      const appService = await useAppService();
      await appService.updateApp(appId, {
        wabaId: wabaId.trim() || undefined
      });
      setSaved(true);
      setStep('done');
      if (wabaId.trim()) {
        toast.success('WhatsApp Business Account linked');
      }
      onSuccess?.();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to save';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done' && saved) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-center gap-2 text-green-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">WhatsApp sender setup complete</p>
            <p className="text-sm flex items-center gap-1 mt-1">
              <Phone className="h-4 w-4" />
              {assignedNumber}
            </p>
            {wabaId && (
              <p className="text-xs mt-1 text-green-700 flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                WABA linked
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
      <div className="flex items-center gap-2 text-gray-700">
        <Phone className="h-5 w-5 text-green-600" />
        <span className="font-medium">Number assigned: {assignedNumber}</span>
      </div>

      <h4 className="font-medium text-gray-900">Connect to Meta WhatsApp Business</h4>
      <p className="text-sm text-gray-600">
        Link your WhatsApp Business Account (WABA) so this number can send and receive messages. If you already have a
        business and WABA, enter your WABA ID below. Otherwise create one in Meta Business Suite.
      </p>

      <div className="space-y-2">
        <label htmlFor="wabaId" className="block text-sm font-medium text-gray-700">
          WhatsApp Business Account ID (WABA) <span className="text-gray-400 font-normal">optional</span>
        </label>
        <input
          id="wabaId"
          type="text"
          placeholder="e.g. 123456789012345"
          value={wabaId}
          onChange={(e) => setWabaId(e.target.value)}
          className="input-field w-full max-w-md"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={META_BUSINESS_SUITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          Create or manage WABA in Meta Business Suite
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <p className="text-xs text-gray-500">
        You can also complete sender registration in your messaging provider console and link your WABA there.
      </p>

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <button
          type="button"
          onClick={handleSaveWaba}
          disabled={loading}
          className="btn-primary flex items-center gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Continue
        </button>
        {onSkip && (
          <button type="button" onClick={onSkip} className="btn-secondary">
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
