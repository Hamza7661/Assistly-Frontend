/**
 * Shared types for Facebook OAuth integration
 */

export interface FbPage {
  id: string;
  name: string;
  access_token: string;
}

/**
 * Facebook API error response
 */
export interface FacebookError {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

/**
 * Facebook authentication response (from FB.login())
 */
export interface FacebookAuthResponse {
  accessToken: string;
  expiresIn: number;
  signedRequest: string;
  userID: string;
  graphDomain?: string;
}

/**
 * Facebook login response (from FB.login() callback)
 */
export interface FacebookLoginResponse {
  status: 'connected' | 'not_authorized' | 'unknown';
  authResponse?: FacebookAuthResponse;
}

/**
 * Facebook API response for pages list
 */
export interface FacebookPagesApiResponse {
  data?: FbPage[];
  error?: FacebookError;
}

/**
 * Facebook SDK initialization options
 */
export interface FacebookSDKInitOptions {
  appId: string;
  cookie: boolean;
  xfbml: boolean;
  version: string;
}

/**
 * Facebook SDK API call options
 */
export interface FacebookApiOptions {
  access_token?: string;
  fields: string;
}

/**
 * Facebook SDK interface
 */
export interface FacebookSDK {
  init: (options: FacebookSDKInitOptions) => void;
  login: (
    callback: (response: FacebookLoginResponse) => void,
    options?: { scope: string }
  ) => void;
  api: (
    path: string,
    options: FacebookApiOptions,
    callback: (response: FacebookPagesApiResponse) => void
  ) => void;
}

/**
 * Extended Window interface with Facebook SDK
 */
export interface WindowWithFB extends Window {
  FB?: FacebookSDK;
  fbAsyncInit?: () => void;
}

export interface UseFacebookOAuthReturn {
  // SDK state
  fbSdkReady: boolean;
  
  // OAuth flow state
  fbConnecting: boolean;
  fbPages: FbPage[];
  fbShortLivedToken: string;
  fbSelectedPageId: string;
  fbSelectedPageName: string;
  
  // Actions
  handleFacebookConnect: () => void;
  resetFacebookSelection: () => void;
  setFbSelectedPageId: (pageId: string) => void;
  setFbSelectedPageName: (pageName: string) => void;
}
