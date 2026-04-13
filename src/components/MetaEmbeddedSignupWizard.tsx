'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useAppService } from '@/services';
import { Loader2, CheckCircle2, Phone, AlertCircle, MessageSquare, Copy, RefreshCw } from 'lucide-react';
import { toast } from 'react-toastify';

// Config (env) takes priority; fallback to defaults for App ID and Embedded Signup Config ID
const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID || '1687448629298833';
const META_CONFIG_ID = process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID || '26346162045071371';
// Partner Solution ID: use env when set, otherwise fall back to the known ID
const META_PARTNER_SOLUTION_ID = process.env.NEXT_PUBLIC_META_PARTNER_SOLUTION_ID || '1232763912378887';
/** Can show/preview Embedded Signup (App ID + Config ID); full registration needs Partner Solution ID (Tech Provider) */
const canShowSignup = !!(META_APP_ID && META_CONFIG_ID);
const isMetaFullyConfigured = !!(META_APP_ID && META_CONFIG_ID && META_PARTNER_SOLUTION_ID);
const OTP_POLL_START_DELAY_MS = 15000;
const OTP_POLL_FAST_INTERVAL_MS = 4000;
const OTP_POLL_SLOW_INTERVAL_MS = 15000;

export type MetaSignupStatus = 'idle' | 'loading_sdk' | 'ready' | 'opening' | 'completed' | 'error';

interface MetaEmbeddedSignupWizardProps {
  /** Assistly app id (used when registering the sender after Meta signup) */
  appId: string;
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

export default function MetaEmbeddedSignupWizard({
  appId,
  phoneNumber,
  onSuccess,
  onError,
  onSkip,
}: MetaEmbeddedSignupWizardProps) {
  const [status, setStatus] = useState<MetaSignupStatus>(canShowSignup ? 'loading_sdk' : 'idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const listenerRef = useRef<((event: MessageEvent) => void) | null>(null);
  const isHttps = useIsHttps();
  const [otpCode, setOtpCode] = useState<string | null>(null);
  const [otpBody, setOtpBody] = useState<string | null>(null);
  const [otpPolling, setOtpPolling] = useState(false);
  const otpIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const otpStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
            const response = await appService.registerSenderAfterMeta({
              appId,
              phoneNumber,
              wabaId: waba_id,
            });
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
    [appId, phoneNumber, onSuccess, onError]
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
    setOtpCode(null);
    setOtpBody(null);
    setErrorMessage(null);

    // Parse E.164 phone number into country code + local number for Meta's setup.phone.
    // e.g. +447863773712 → code: "44", number: "7863773712"
    let phoneSetup: Record<string, string> | undefined;
    if (phoneNumber && phoneNumber.startsWith('+')) {
      const digits = phoneNumber.slice(1); // strip leading +
      // Common country code lengths: 1 (US/CA), 2 (GB=44, FR=33…), 3 (less common)
      // Use a simple heuristic: try 2-digit code first, then 1-digit
      const cc2 = digits.slice(0, 2);
      const cc1 = digits.slice(0, 1);
      // GB (44), FR (33), DE (49), AU (61), NZ (64), etc. start with non-1 two-digit codes
      const twoDigitCodes = ['44','33','49','61','64','31','32','34','39','41','43','45','46','47','48','52','55','81','82','86','91'];
      if (twoDigitCodes.includes(cc2)) {
        phoneSetup = { code: cc2, number: digits.slice(2) };
      } else {
        phoneSetup = { code: cc1, number: digits.slice(1) };
      }
    }

    // Use a fixed fallback so only one URI needs to be in Valid OAuth Redirect URIs (avoids per-page URLs)
    const fallbackRedirect =
      typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
    const setup: Record<string, unknown> = {};
    if (META_PARTNER_SOLUTION_ID) setup.solutionID = META_PARTNER_SOLUTION_ID;
    // Pre-populate the purchased number so Meta locks it in and sends OTP there
    if (phoneSetup) setup.phone = phoneSetup;
    const options: Record<string, unknown> = {
      config_id: META_CONFIG_ID,
      auth_type: 'rerequest',
      response_type: 'code',
      override_default_response_type: true,
      ...(fallbackRedirect && { fallback_redirect_uri: fallbackRedirect }),
      extras: {
        sessionInfoVersion: 3,
        featureType: 'whatsapp_embedded_signup',
        ...(Object.keys(setup).length > 0 && { setup }),
      },
    };
    FB.login(() => {}, options);
  }, [phoneNumber]);

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

  // Poll Twilio for incoming SMS (OTP from Meta) while the signup popup is open
  const pollForOtp = useCallback(async () => {
    if (!appId) return;
    try {
      const appService = await useAppService();
      const res = await appService.getLatestSms(appId);
      if (res.status === 'success') {
        const withOtp = (res.data?.messages || []).find((m) => m.otp);
        if (withOtp) {
          setOtpCode(withOtp.otp);
          setOtpBody(withOtp.body);
        }
      }
    } catch { /* non-fatal */ }
  }, [appId]);

  useEffect(() => {
    if (status === 'opening') {
      setOtpPolling(true);
      otpStartTimerRef.current = setTimeout(() => {
        pollForOtp();
        otpIntervalRef.current = setInterval(pollForOtp, OTP_POLL_FAST_INTERVAL_MS);
      }, OTP_POLL_START_DELAY_MS);
    } else {
      setOtpPolling(false);
      if (otpStartTimerRef.current) {
        clearTimeout(otpStartTimerRef.current);
        otpStartTimerRef.current = null;
      }
      if (otpIntervalRef.current) {
        clearInterval(otpIntervalRef.current);
        otpIntervalRef.current = null;
      }
    }
    return () => {
      if (otpStartTimerRef.current) {
        clearTimeout(otpStartTimerRef.current);
        otpStartTimerRef.current = null;
      }
      if (otpIntervalRef.current) {
        clearInterval(otpIntervalRef.current);
        otpIntervalRef.current = null;
      }
    };
  }, [status, pollForOtp]);

  // After first OTP is detected, keep polling but at a slower cadence so resend codes are still picked up.
  useEffect(() => {
    if (status !== 'opening' || !otpCode) return;
    if (otpIntervalRef.current) {
      clearInterval(otpIntervalRef.current);
    }
    otpIntervalRef.current = setInterval(pollForOtp, OTP_POLL_SLOW_INTERVAL_MS);
    return () => {
      if (otpIntervalRef.current) {
        clearInterval(otpIntervalRef.current);
        otpIntervalRef.current = null;
      }
    };
  }, [status, otpCode, pollForOtp]);


  if (status === 'completed') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-center gap-2 text-green-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Meta signup complete</p>
            <p className="text-sm">WhatsApp sender is registered.</p>
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
          <div className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <p className="font-semibold">Use HTTPS to sign in with Facebook</p>
            <p className="text-amber-800">
              Meta only allows Facebook Login on secure pages. Open this site with an{' '}
              <code className="bg-amber-100 px-1 rounded text-xs">https://</code> URL (your deployed
              environment, or a local HTTPS tunnel), then use <strong>Continue with Facebook</strong>.
            </p>
            <p className="text-amber-800">
              <a
                href="https://developers.facebook.com/blog/post/2018/06/08/enforce-https-facebook-login/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                Why Meta requires HTTPS
              </a>
            </p>
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
        </div>

        {/* OTP panel: shown while the Meta popup is open */}
        {status === 'opening' && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-blue-800">
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">
                {otpCode ? 'Verification code received' : 'Waiting for SMS verification code…'}
              </span>
              {otpPolling && !otpCode && <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />}
            </div>
            {otpCode ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-3xl font-bold tracking-[0.3em] text-blue-900 bg-white border border-blue-200 rounded-lg px-4 py-2 select-all">
                    {otpCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(otpCode); toast.success('Code copied!'); }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </button>
                </div>
                {otpBody && (
                  <p className="text-xs text-blue-600 italic">"{otpBody}"</p>
                )}
                <p className="text-xs text-blue-700">Enter this code in the Meta popup to verify your number.</p>
              </div>
            ) : (
              <p className="text-xs text-blue-600">
                Meta will send a 6-digit code to <span className="font-mono font-medium">{phoneNumber}</span>.
                It will appear here automatically — enter it in the popup above.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
