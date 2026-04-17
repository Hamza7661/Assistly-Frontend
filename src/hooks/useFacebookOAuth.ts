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

const FB_LOG = '[FacebookOAuth]';

export function useFacebookOAuth(): UseFacebookOAuthReturn {
  const [fbSdkReady, setFbSdkReady] = useState(false);
  const [fbConnecting, setFbConnecting] = useState(false);
  const [fbPages, setFbPages] = useState<FbPage[]>([]);
  const [fbShortLivedToken, setFbShortLivedToken] = useState('');
  const [fbSelectedPageId, setFbSelectedPageId] = useState('');
  const [fbSelectedPageName, setFbSelectedPageName] = useState('');
  const fbPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sdkInitializedRef = useRef(false); // ✅ prevent double init

  /**
   * Load Facebook SDK
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const windowWithFB = window as WindowWithFB;

    const initSdk = () => {
      if (sdkInitializedRef.current) return; // ✅ prevent double init

      try {
        const fbSdk = windowWithFB.FB;
        if (fbSdk) {
          console.log(`${FB_LOG} Initializing SDK`, {
            appId: FACEBOOK_APP_ID,
            version: FACEBOOK_API_VERSION,
          });

          fbSdk.init({
            appId: FACEBOOK_APP_ID,
            cookie: true,
            xfbml: false,
            version: FACEBOOK_API_VERSION,
          });

          sdkInitializedRef.current = true;
          setFbSdkReady(true);

          console.log(`${FB_LOG} SDK initialized successfully`);
        }
      } catch (err) {
        console.error(`${FB_LOG} SDK initialization failed`, err);
      }
    };

    if (windowWithFB.FB) {
      initSdk();
      return;
    }

    windowWithFB.fbAsyncInit = initSdk;

    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = FACEBOOK_SDK_SRC;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    fbPollRef.current = setInterval(() => {
      if (windowWithFB.FB) {
        clearInterval(fbPollRef.current!);
        initSdk(); // ✅ ensure init happens only once
      }
    }, FACEBOOK_POLL_INTERVAL_MS);

    return () => {
      if (fbPollRef.current) clearInterval(fbPollRef.current);
    };
  }, []);

  /**
   * Fetch pages (✅ explicit token usage)
   */
  const fetchPages = (token: string, fbSdk: FacebookSDK) => {
    console.log(`${FB_LOG} Fetching pages via /me/accounts`);

    fbSdk.api(
      '/me/accounts',
      {
        access_token: token, // ✅ CRITICAL FIX
        fields: 'id,name,access_token',
      },
      (pagesRes: FacebookPagesApiResponse) => {
        console.log(`${FB_LOG} /me/accounts response`, pagesRes);

        setFbConnecting(false);

        if (pagesRes.error || !pagesRes.data) {
          console.error(`${FB_LOG} Error fetching pages`, pagesRes.error);
          toast.error(
            pagesRes.error?.message ||
              'Failed to fetch Facebook pages. Check permissions.'
          );
          return;
        }

        const pages = pagesRes.data;

        if (pages.length === 0) {
          console.warn(`${FB_LOG} No pages found`);
          toast.error('No Facebook pages found. Ensure you are an admin.');
          return;
        }

        setFbShortLivedToken(token);
        setFbPages(pages);

        if (pages.length === 1) {
          setFbSelectedPageId(pages[0].id);
          setFbSelectedPageName(pages[0].name);
        }
      }
    );
  };

  /**
   * Connect Facebook
   */
  const handleFacebookConnect = () => {
    const windowWithFB = window as WindowWithFB;
    const fbSdk = windowWithFB.FB;

    if (!fbSdk) {
      toast.error('Facebook SDK not loaded yet.');
      return;
    }

    setFbConnecting(true);
    setFbPages([]);
    setFbShortLivedToken('');
    setFbSelectedPageId('');
    setFbSelectedPageName('');

    console.log(`${FB_LOG} Starting FB.login`);

    fbSdk.login(
      (response: FacebookLoginResponse) => {
        console.log(`${FB_LOG} Login response`, response);

        if (response.status !== 'connected' || !response.authResponse) {
          setFbConnecting(false);
          toast.error('Facebook login failed or cancelled.');
          return;
        }

        const token = response.authResponse.accessToken;

        console.log(`${FB_LOG} Login successful, token received`);

        // ✅ directly fetch pages (NO getLoginStatus, NO logout)
        fetchPages(token, fbSdk);
      },
      {
        scope: FACEBOOK_LOGIN_SCOPE,
        auth_type: 'rerequest',
      }
    );
  };

  /**
   * Reset state
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