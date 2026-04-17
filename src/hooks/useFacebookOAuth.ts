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
          console.log(`${FB_LOG} SDK initialized successfully`);
          setFbSdkReady(true);
        }
      } catch (err) {
        console.error(`${FB_LOG} SDK initialization failed`, err);
      }
    };

    // If SDK is already loaded, initialize immediately
    if (windowWithFB.FB) {
      console.log(`${FB_LOG} SDK already present on window, initializing immediately`);
      initSdk();
      return;
    }

    console.log(`${FB_LOG} SDK not yet loaded, setting up fbAsyncInit callback`);

    // Set up async initialization callback
    windowWithFB.fbAsyncInit = initSdk;

    // Inject SDK script if not already present
    if (!document.getElementById('facebook-jssdk')) {
      console.log(`${FB_LOG} Injecting SDK script from: ${FACEBOOK_SDK_SRC}`);
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = FACEBOOK_SDK_SRC;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    } else {
      console.log(`${FB_LOG} SDK script tag already exists in DOM, skipping inject`);
    }

    // Poll until FB global becomes available (handles async load timing)
    console.log(`${FB_LOG} Starting poll for window.FB (interval: ${FACEBOOK_POLL_INTERVAL_MS}ms)`);
    fbPollRef.current = setInterval(() => {
      const windowWithFB = window as WindowWithFB;
      if (windowWithFB.FB) {
        console.log(`${FB_LOG} window.FB detected via poll, clearing interval`);
        clearInterval(fbPollRef.current!);
        setFbSdkReady(true);
      }
    }, FACEBOOK_POLL_INTERVAL_MS);

    return () => {
      if (fbPollRef.current) {
        console.log(`${FB_LOG} Cleaning up poll interval`);
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

    console.log(`${FB_LOG} handleFacebookConnect called`, {
      sdkAvailable: !!fbSdk,
      fbSdkReady,
    });

    if (!fbSdk) {
      console.error(`${FB_LOG} FB SDK not available on window`);
      toast.error('Facebook SDK is still loading. Please try again in a moment.');
      return;
    }

    setFbConnecting(true);
    setFbPages([]);
    setFbShortLivedToken('');
    setFbSelectedPageId('');
    setFbSelectedPageName('');

    const doLogin = () => {
      console.log(`${FB_LOG} Calling FB.login with scope: "${FACEBOOK_LOGIN_SCOPE}", auth_type: "rerequest"`);

      fbSdk.login(
        (response: FacebookLoginResponse) => {
        console.log(`${FB_LOG} FB.login callback received`, {
          status: response.status,
          hasAuthResponse: !!response.authResponse,
          userId: response.authResponse?.userID ?? null,
          expiresIn: response.authResponse?.expiresIn ?? null,
          // Token intentionally truncated for security
          accessTokenPreview: response.authResponse?.accessToken
            ? `${response.authResponse.accessToken.slice(0, 10)}...`
            : null,
        });

        if (!response.authResponse) {
          console.warn(`${FB_LOG} Login cancelled or denied by user (no authResponse)`);
          setFbConnecting(false);
          return;
        }

        const token = response.authResponse.accessToken;

        console.log(`${FB_LOG} Login successful, calling /me/accounts to fetch pages`);

        fbSdk.api(
          '/me/accounts',
          { fields: 'id,name,access_token' },
          (pagesRes: FacebookPagesApiResponse) => {
            console.log(`${FB_LOG} /me/accounts response received`, {
              hasError: !!pagesRes.error,
              errorCode: pagesRes.error?.code ?? null,
              errorMessage: pagesRes.error?.message ?? null,
              errorType: pagesRes.error?.type ?? null,
              pageCount: pagesRes.data?.length ?? 0,
              pages: pagesRes.data?.map((p) => ({
                id: p.id,
                name: p.name,
                hasPageToken: !!p.access_token,
              })) ?? [],
            });

            setFbConnecting(false);

            if (pagesRes.error || !pagesRes.data) {
              const errMsg =
                pagesRes.error?.message ||
                'Could not fetch your Facebook pages. Please ensure you granted the required permissions.';
              console.error(`${FB_LOG} /me/accounts error`, {
                code: pagesRes.error?.code,
                message: errMsg,
                type: pagesRes.error?.type,
                errorSubcode: pagesRes.error?.error_subcode,
                fbtrace_id: pagesRes.error?.fbtrace_id,
              });
              toast.error(errMsg);
              return;
            }

            const pages: FbPage[] = pagesRes.data;

            if (pages.length === 0) {
              console.warn(
                `${FB_LOG} /me/accounts returned 0 pages. Possible reasons:` +
                '\n  1. User previously revoked this page — try reconnecting via Facebook Settings > Apps' +
                '\n  2. Page is managed via Business Manager (not direct ownership)' +
                '\n  3. Page is unpublished or restricted by Meta' +
                '\n  4. Required permissions were not granted during login'
              );
              toast.error('No Facebook pages found. Make sure you admin at least one page.');
              return;
            }

            console.log(`${FB_LOG} ${pages.length} page(s) returned, setting state`);
            setFbShortLivedToken(token);
            setFbPages(pages);

            // Auto-select when there is only one page
            if (pages.length === 1) {
              console.log(`${FB_LOG} Auto-selecting single page: ${pages[0].name} (${pages[0].id})`);
              setFbSelectedPageId(pages[0].id);
              setFbSelectedPageName(pages[0].name);
            } else {
              console.log(`${FB_LOG} Multiple pages found, waiting for user to select one`);
            }

            // Clear the SDK session immediately after capturing the token.
            // This prevents the cached session from being restored on next FB.init()
            // which causes the "overriding access token" warning and stale /me/accounts results.
            console.log(`${FB_LOG} Clearing SDK session to prevent stale token on next connect`);
            fbSdk.logout(() => {
              console.log(`${FB_LOG} SDK session cleared successfully`);
            });
          }
        );
      },
        { scope: FACEBOOK_LOGIN_SCOPE, auth_type: 'rerequest' }
      );
    };

    // Always logout first to clear any cached session/token so FB.login
    // always shows a fresh dialog and /me/accounts returns current pages
    console.log(`${FB_LOG} Checking login status before connect`);
    fbSdk.getLoginStatus((statusRes) => {
      console.log(`${FB_LOG} Current login status: ${statusRes.status}`);
      if (statusRes.status === 'connected') {
        console.log(`${FB_LOG} Active session detected — logging out to clear cached token`);
        fbSdk.logout(() => {
          console.log(`${FB_LOG} Logout complete, proceeding with fresh login`);
          doLogin();
        });
      } else {
        console.log(`${FB_LOG} No active session, proceeding directly to login`);
        doLogin();
      }
    });
  };

  /**
   * Resets the Facebook OAuth selection state
   */
  const resetFacebookSelection = () => {
    console.log(`${FB_LOG} Resetting Facebook selection state`);
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
