'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useAppService } from '@/services';
import { Loader2, CheckCircle2, Phone, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';

// Config (env) takes priority; fallback to defaults for App ID and Embedded Signup Config ID
const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID || '1687448629298833';
const META_CONFIG_ID = process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID || '2393474544425955';
// Partner Solution ID: use env when set, otherwise fall back to the known ID
const META_PARTNER_SOLUTION_ID = process.env.NEXT_PUBLIC_META_PARTNER_SOLUTION_ID || '1232763912378887';
/** Can show/preview Embedded Signup (App ID + Config ID); full registration needs Partner Solution ID (Tech Provider) */
const canShowSignup = !!(META_APP_ID && META_CONFIG_ID);
const isMetaFullyConfigured = !!(META_APP_ID && META_CONFIG_ID && META_PARTNER_SOLUTION_ID);

export type MetaSignupStatus = 'idle' | 'loading_sdk' | 'ready' | 'opening' | 'completed' | 'error';

interface MetaEmbeddedSignupWizardProps {
  /** Provisioned phone number (E.164) */
  phoneNumber: string;
  onSuccess: (data: { senderSid: string; wabaId: string }) => void;
  onError?: (message: string) => void;
  /** When user skips Meta signup (e.g. testing); app can still be created with number only */
  onSkip?: () => void;
}

/**
 * In-app wizard that launches Meta's Embedded Signup (popup): Business Portfolio, WABA.
 * After user completes, we register the WhatsApp sender using phoneNumber + wabaId.
 */
/** Meta requires HTTPS for FB.login; see https://developers.facebook.com/blog/post/2018/06/08/enforce-https-facebook-login/ */
function useIsHttps() {
  const [isHttps, setIsHttps] = useState(true);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsHttps(window.location.protocol === 'https:');
    }
  }, []);
  return isHttps;
}

export default function MetaEmbeddedSignupWizard({ phoneNumber, onSuccess, onError, onSkip }: MetaEmbeddedSignupWizardProps) {
  const [status, setStatus] = useState<MetaSignupStatus>(canShowSignup ? 'loading_sdk' : 'idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const listenerRef = useRef<((event: MessageEvent) => void) | null>(null);
  const isHttps = useIsHttps();

  const handleEmbeddedSignupMessage = useCallback(
    async (event: MessageEvent) => {
      if (!event.origin?.endsWith('facebook.com')) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type !== 'WA_EMBEDDED_SIGNUP') return;

        if (data.event === 'FINISH' || data.event === 'FINISH_ONLY_WABA') {
          const { waba_id } = data.data || {};
          if (!waba_id) {
            setErrorMessage('Meta did not return a WABA ID.');
            setStatus('error');
            return;
          }
          setStatus('opening'); // show loading while we register sender
          try {
            const appService = await useAppService();
            const response = await appService.registerSenderAfterMeta(phoneNumber, waba_id);
            if (response.status === 'success' && response.data?.senderSid) {
              setStatus('completed');
              toast.success('WhatsApp sender registered');
              onSuccess({ senderSid: response.data.senderSid, wabaId: waba_id });
            } else {
              const msg = (response as any).message || 'Failed to register sender';
              setErrorMessage(msg);
              setStatus('error');
              onError?.(msg);
              toast.error(msg);
            }
          } catch (err: any) {
            const msg = err.response?.data?.message || err.message || 'Failed to register sender';
            setErrorMessage(msg);
            setStatus('error');
            onError?.(msg);
            toast.error(msg);
          }
        } else if (data.event === 'CANCEL') {
          setStatus('ready');
          toast.info('Signup was cancelled');
        } else if (data.event === 'ERROR') {
          const msg = (data.data?.error_message as string) || 'Meta signup error';
          setErrorMessage(msg);
          setStatus('error');
          onError?.(msg);
          toast.error(msg);
        }
      } catch {
        // ignore non-JSON or other messages
      }
    },
    [phoneNumber, onSuccess, onError]
  );

  useEffect(() => {
    listenerRef.current = handleEmbeddedSignupMessage;
    window.addEventListener('message', handleEmbeddedSignupMessage);
    return () => {
      window.removeEventListener('message', handleEmbeddedSignupMessage);
      listenerRef.current = null;
    };
  }, [handleEmbeddedSignupMessage]);

  const launchEmbeddedSignup = useCallback(() => {
    if (typeof window !== 'undefined' && window.location.protocol !== 'https:') {
      toast.error('Meta signup requires HTTPS. Open this app via https:// to use Continue with Facebook.');
      setErrorMessage('Facebook Login is only allowed on HTTPS pages. Use an https:// URL or set up local HTTPS for development.');
      setStatus('error');
      return;
    }
    const FB = (window as any).FB;
    if (!FB) {
      setErrorMessage('Facebook SDK not loaded yet.');
      setStatus('error');
      return;
    }
    if (!META_CONFIG_ID) {
      setErrorMessage('Meta Embedded Signup Config ID is missing.');
      setStatus('error');
      return;
    }
    setStatus('opening');
    setErrorMessage(null);
    // Use a fixed fallback so only one URI needs to be in Valid OAuth Redirect URIs (avoids per-page URLs)
    const fallbackRedirect =
      typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
    const options: Record<string, unknown> = {
      config_id: META_CONFIG_ID,
      auth_type: 'rerequest',
      response_type: 'code',
      override_default_response_type: true,
      ...(fallbackRedirect && { fallback_redirect_uri: fallbackRedirect }),
      extras: {
        sessionInfoVersion: 3,
        featureType: 'only_waba_sharing',
      },
    };
    if (META_PARTNER_SOLUTION_ID) {
      (options.extras as Record<string, unknown>).setup = { solutionID: META_PARTNER_SOLUTION_ID };
    }
    FB.login(
      () => {},
      options
    );
  }, []);

  useEffect(() => {
    if (!META_APP_ID) return;
    (window as any).fbAsyncInit = function () {
      const FB = (window as any).FB;
      if (!FB) return;
      FB.init({
        appId: META_APP_ID,
        autoLogAppEvents: true,
        xfbml: true,
        version: 'v21.0',
      });
      setStatus('ready');
    };
    if ((window as any).FB) {
      setStatus('ready');
    }
  }, []);

  const handleFbScriptLoad = useCallback(() => {
    if ((window as any).FB && (window as any).fbAsyncInit) {
      (window as any).fbAsyncInit();
    } else {
      setStatus('ready');
    }
  }, []);


  if (status === 'completed') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-center gap-2 text-green-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Meta signup complete</p>
            <p className="text-sm">WhatsApp sender is registered. You can create your app.</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error' && errorMessage) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-2 text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Error</p>
            <p className="text-sm">{errorMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://connect.facebook.net/en_US/sdk.js"
        strategy="afterInteractive"
        onLoad={handleFbScriptLoad}
      />
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
        <div className="flex items-center gap-2 text-gray-700">
          <Phone className="h-5 w-5 text-green-600" />
          <span className="font-medium">Number: {phoneNumber}</span>
        </div>
        <p className="text-sm text-gray-600">
          Connect your WhatsApp Business Account (WABA) by signing in with Facebook. You’ll select or create a
          Business profile and WABA in the popup. This number will then be registered as a WhatsApp sender.
        </p>
        {!isHttps && (
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <strong>HTTPS required.</strong> Meta does not allow Facebook Login on HTTP pages.{' '}
            <a href="https://developers.facebook.com/blog/post/2018/06/08/enforce-https-facebook-login/" target="_blank" rel="noopener noreferrer" className="underline">Learn more</a>.
            Use this app over <code className="bg-amber-100 px-1 rounded">https://</code> (e.g. in production or via a local HTTPS tunnel) to use &quot;Continue with Facebook&quot;. You can still click &quot;Skip for now&quot; to create the app.
          </div>
        )}
        {canShowSignup && !isMetaFullyConfigured && (
          <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded">
            <strong>Preview mode.</strong> Tech Provider (Partner Solution ID) is not set yet. You can open the signup flow below to see the Meta Embedded Signup steps. Full registration and linking to the provider will work after Tech Provider approval and adding <code className="text-xs">NEXT_PUBLIC_META_PARTNER_SOLUTION_ID</code>.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={launchEmbeddedSignup}
            disabled={status !== 'ready' || !canShowSignup || !isHttps}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1877F2] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#166FE5] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'loading_sdk' || status === 'opening' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {status === 'idle' || status === 'loading_sdk' ? 'Loading...' : status === 'opening' ? 'Complete signup in the popup...' : 'Continue with Facebook'}
          </button>
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Skip for now (test)
            </button>
          )}
        </div>
      </div>
    </>
  );
}
