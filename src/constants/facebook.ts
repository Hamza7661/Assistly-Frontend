// Centralised Facebook-related frontend constants.
// Prefer reading from NEXT_PUBLIC_* env vars so they can be configured per environment,
// with sensible defaults for local development.

export const FACEBOOK_APP_ID =
  process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '';

export const FACEBOOK_API_VERSION =
  process.env.NEXT_PUBLIC_FACEBOOK_API_VERSION || 'v22.0';

export const FACEBOOK_SDK_SRC =
  process.env.NEXT_PUBLIC_FACEBOOK_SDK_SRC ||
  'https://connect.facebook.net/en_US/sdk.js';

// Comma-separated list of OAuth permissions requested during FB.login.
export const FACEBOOK_LOGIN_SCOPE =
  process.env.NEXT_PUBLIC_FACEBOOK_LOGIN_SCOPE ||
  'pages_show_list,pages_messaging,pages_read_engagement';

// Poll interval (ms) while waiting for the FB SDK global to be available.
export const FACEBOOK_POLL_INTERVAL_MS = Number(
  process.env.NEXT_PUBLIC_FACEBOOK_POLL_INTERVAL_MS || '300'
);

