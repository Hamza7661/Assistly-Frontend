import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import {
  FACEBOOK_APP_ID,
  FACEBOOK_API_VERSION,
  FACEBOOK_SDK_SRC,
  FACEBOOK_LOGIN_SCOPE,
} from '@/constants/facebook';

const FB_LOG = '[FacebookOAuth]';

type FbState =
  | 'idle'
  | 'sdk_loading'
  | 'ready'
  | 'auth_start'
  | 'auth_success'
  | 'fetching_pages'
  | 'success'
  | 'error';

type FbErrorType =
  | 'SDK_NOT_READY'
  | 'LOGIN_CANCELLED'
  | 'PERMISSION_DENIED'
  | 'NO_PAGES'
  | 'API_ERROR'
  | 'UNKNOWN';

export function useFacebookOAuth() {
  const [state, setState] = useState<FbState>('idle');
  const [error, setError] = useState<FbErrorType | null>(null);

  const [pages, setPages] = useState<any[]>([]);
  const [token, setToken] = useState('');

  const sdkInitializedRef = useRef(false);

  /**
   * SDK INIT
   */
  useEffect(() => {
    setState('sdk_loading');

    const init = () => {
      if (sdkInitializedRef.current) return;

      const FB = (window as any).FB;
      if (!FB) return;

      FB.init({
        appId: FACEBOOK_APP_ID,
        cookie: false,
        xfbml: false,
        version: FACEBOOK_API_VERSION,
      });

      sdkInitializedRef.current = true;
      setState('ready');

      console.log(`${FB_LOG} SDK ready`);
    };

    if ((window as any).FB) {
      init();
      return;
    }

    (window as any).fbAsyncInit = init;

    const script = document.createElement('script');
    script.src = FACEBOOK_SDK_SRC;
    script.async = true;
    document.body.appendChild(script);
  }, []);

  /**
   * ERROR CLASSIFIER
   */
  const classifyError = (res: any): FbErrorType => {
    if (!res) return 'UNKNOWN';

    if (res.status === 'not_authorized') return 'PERMISSION_DENIED';
    if (res.status === 'unknown') return 'LOGIN_CANCELLED';

    if (res.error) return 'API_ERROR';

    return 'UNKNOWN';
  };

  /**
   * Fallback: fetch pages via Meta Business Manager API.
   * Used when /me/accounts returns empty, which happens after reauthorize because
   * Facebook reclassifies the page grant as a Business Integration asset.
   */
  const fetchPagesFromBusinessAPI = (FB: any, accessToken: string) => {
    console.log(`${FB_LOG} /me/accounts empty — trying Business API fallback`);

    FB.api(
      '/me/businesses',
      { access_token: accessToken, fields: 'id,name,owned_pages{id,name,access_token}' },
      (bizRes: any) => {
        if (bizRes?.error) {
          console.warn(`${FB_LOG} Business API error`, bizRes.error);
          setState('error');
          setError('NO_PAGES');
          toast.error('No pages found. Make sure you are a Page admin.');
          return;
        }

        const pages = (bizRes?.data || []).flatMap(
          (biz: any) => biz.owned_pages?.data || []
        );

        console.log(`${FB_LOG} Business API pages`, pages);

        if (pages.length === 0) {
          setState('error');
          setError('NO_PAGES');
          toast.error('No pages found. Make sure you are a Page admin.');
          return;
        }

        setPages(pages);
        setToken(accessToken);
        setState('success');
      }
    );
  };

  /**
   * RETRY LOGIC
   */
  const fetchPagesWithRetry = (
    FB: any,
    accessToken: string,
    attempt = 0
  ) => {
    setState('fetching_pages');

    FB.api(
      '/me/accounts',
      {
        access_token: accessToken,
        fields: 'id,name,access_token,tasks',
      },
      (res: any) => {
        console.log(`${FB_LOG} Pages attempt ${attempt + 1}`, res);

        if (res.error) {
          setState('error');
          setError('API_ERROR');
          toast.error(res.error.message);
          return;
        }

        const data = res.data || [];

        // Retry if empty (brief propagation delay on Facebook's side)
        if (data.length === 0 && attempt < 3) {
          console.warn(`${FB_LOG} Empty pages, retrying...`);

          setTimeout(() => {
            fetchPagesWithRetry(FB, accessToken, attempt + 1);
          }, 1000 * (attempt + 1));

          return;
        }

        if (data.length === 0) {
          // After all retries, fall back to Business Manager API.
          // On reconnect (reauthorize), Facebook reclassifies page grants as
          // Business Integration assets which don't appear in /me/accounts.
          fetchPagesFromBusinessAPI(FB, accessToken);
          return;
        }

        setPages(data);
        setToken(accessToken);
        setState('success');
      }
    );
  };

  /**
   * CLEAN LOGIN (avoids stale sessions)
   */
  const performLogin = (FB: any) => {
    setState('auth_start');

    const triggerLogin = () => {
      FB.login(
        (response: any) => {
          console.log(`${FB_LOG} Login response`, response);

          if (
            response.status !== 'connected' ||
            !response.authResponse
          ) {
            const err = classifyError(response);
            setError(err);
            setState('error');

            if (err !== 'LOGIN_CANCELLED') {
              toast.error('Facebook login failed');
            }

            return;
          }

          const accessToken = response.authResponse.accessToken;

          console.log(`${FB_LOG} Auth success`);
          setState('auth_success');

          // slight delay to avoid race condition
          setTimeout(() => {
            fetchPagesWithRetry(FB, accessToken);
          }, 500);
        },
        {
          scope: FACEBOOK_LOGIN_SCOPE,
          auth_type: 'reauthorize',
          return_scopes: true,
        }
      );
    };

    // Clear stale session first
    FB.getLoginStatus((res: any) => {
      if (res.status === 'connected') {
        console.log(`${FB_LOG} Logging out stale session`);
        FB.logout(() => triggerLogin());
      } else {
        triggerLogin();
      }
    });
  };

  /**
   * PUBLIC API
   */
  const connect = () => {
    const FB = (window as any).FB;

    if (!FB || !sdkInitializedRef.current) {
      setError('SDK_NOT_READY');
      toast.error('Facebook SDK not ready');
      return;
    }

    setPages([]);
    setToken('');
    setError(null);

    performLogin(FB);
  };

  const reset = () => {
    setState('idle');
    setPages([]);
    setToken('');
    setError(null);
  };

  return {
    state,
    error,
    pages,
    token,
    connect,
    reset,
  };
}