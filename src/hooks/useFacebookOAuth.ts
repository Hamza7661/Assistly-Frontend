import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import {
  FACEBOOK_APP_ID,
  FACEBOOK_API_VERSION,
  FACEBOOK_SDK_SRC,
  FACEBOOK_LOGIN_SCOPE,
  FACEBOOK_POLL_INTERVAL_MS,
} from '@/constants/facebook';
import type {
  FbPage,
  UseFacebookOAuthReturn,
  FacebookSDK,
  FacebookLoginResponse,
  FacebookPagesApiResponse,
  WindowWithFB,
} from '@/types/facebook';

/**
 * Custom hook for Facebook SDK loading and OAuth flow
 * Handles SDK initialization, login, and page fetching
 */
export function useFacebookOAuth(): UseFacebookOAuthReturn {
  const [fbSdkReady, setFbSdkReady] = useState(false);
  const [fbConnecting, setFbConnecting] = useState(false);
  const [fbPages, setFbPages] = useState<FbPage[]>([]);
  const [fbShortLivedToken, setFbShortLivedToken] = useState('');
  const [fbSelectedPageId, setFbSelectedPageId] = useState('');
  const [fbSelectedPageName, setFbSelectedPageName] = useState('');
  const fbPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load Facebook SDK
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const windowWithFB = window as WindowWithFB;

    const initSdk = () => {
      try {
        const fbSdk = windowWithFB.FB;
        if (fbSdk) {
          fbSdk.init({
            appId: FACEBOOK_APP_ID,
            cookie: true,
            xfbml: false,
            version: FACEBOOK_API_VERSION,
          });
          setFbSdkReady(true);
        }
      } catch (_) {
        // SDK initialization failed, will retry via polling
      }
    };

    // If SDK is already loaded, initialize immediately
    if (windowWithFB.FB) {
      initSdk();
      return;
    }

    // Set up async initialization callback
    windowWithFB.fbAsyncInit = initSdk;

    // Inject SDK script if not already present
    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = FACEBOOK_SDK_SRC;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    // Poll until FB global becomes available (handles async load timing)
    fbPollRef.current = setInterval(() => {
      const windowWithFB = window as WindowWithFB;
      if (windowWithFB.FB) {
        clearInterval(fbPollRef.current!);
        setFbSdkReady(true);
      }
    }, FACEBOOK_POLL_INTERVAL_MS);

    return () => {
      if (fbPollRef.current) {
        clearInterval(fbPollRef.current);
      }
    };
  }, []);

  /**
   * Initiates Facebook Login flow and fetches user's pages
   */
  const handleFacebookConnect = () => {
    const windowWithFB = window as WindowWithFB;
    const fbSdk: FacebookSDK | undefined = windowWithFB.FB;

    if (!fbSdk) {
      toast.error('Facebook SDK is still loading. Please try again in a moment.');
      return;
    }

    setFbConnecting(true);
    setFbPages([]);
    setFbShortLivedToken('');
    setFbSelectedPageId('');
    setFbSelectedPageName('');

    fbSdk.login(
      (response: FacebookLoginResponse) => {
        if (!response.authResponse) {
          // User cancelled or denied
          setFbConnecting(false);
          return;
        }

        const token = response.authResponse.accessToken;

        fbSdk.api(
          '/me/accounts',
          { fields: 'id,name,access_token' },
          (pagesRes: FacebookPagesApiResponse) => {
            setFbConnecting(false);

            if (pagesRes.error || !pagesRes.data) {
              toast.error(
                pagesRes.error?.message ||
                  'Could not fetch your Facebook pages. Please ensure you granted the required permissions.'
              );
              return;
            }

            const pages: FbPage[] = pagesRes.data;
            if (pages.length === 0) {
              toast.error('No Facebook pages found. Make sure you admin at least one page.');
              return;
            }

            setFbShortLivedToken(token);
            setFbPages(pages);

            // Auto-select when there is only one page
            if (pages.length === 1) {
              setFbSelectedPageId(pages[0].id);
              setFbSelectedPageName(pages[0].name);
            }
          }
        );
      },
      { scope: FACEBOOK_LOGIN_SCOPE }
    );
  };

  /**
   * Resets the Facebook OAuth selection state
   */
  const resetFacebookSelection = () => {
    setFbShortLivedToken('');
    setFbPages([]);
    setFbSelectedPageId('');
    setFbSelectedPageName('');
  };

  return {
    fbSdkReady,
    fbConnecting,
    fbPages,
    fbShortLivedToken,
    fbSelectedPageId,
    fbSelectedPageName,
    handleFacebookConnect,
    resetFacebookSelection,
    setFbSelectedPageId,
    setFbSelectedPageName,
  };
}
