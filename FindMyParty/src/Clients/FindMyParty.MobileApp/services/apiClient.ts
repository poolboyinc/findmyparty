import { ApiConstants } from '../constants/api';
import { createApi } from './api';
import { fetchWithTimeout, session } from './authService';

/**
 * The app's API client: adds the access token, renews the session when the server refuses it,
 * and throws an `ApiError` that says what went wrong (`offline`, `signed_out`, `conflict`, ...).
 * New code should call the server through this, not through `fetch`.
 */
export const api = createApi({
  baseUrl: ApiConstants.GatewayBaseUrl,
  fetch: fetchWithTimeout,
  getAccessToken: session.getAccessToken,
  refresh: session.refresh,
});

export { ApiError, type ApiErrorKind } from './api';
