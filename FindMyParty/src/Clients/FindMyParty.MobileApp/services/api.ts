// The one way the app talks to the server. No React Native imports, so it is unit-tested in plain Node
// (services/__tests__/api.test.mjs). `apiClient.ts` wires it to the device.

/**
 * What went wrong, in terms a screen can act on:
 * - `offline`: no answer (no connection, timeout). Keep what is on screen, offer retry.
 * - `signed_out`: there is no session any more. Send the user to sign in.
 * - `conflict`: the request was fine but cannot happen now; `code` says why (`sold_out`, `not_bookable`, ...).
 * - `invalid`: the input was refused; `message` is the first reason.
 */
export type ApiErrorKind =
  | 'offline'
  | 'signed_out'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'invalid'
  | 'rate_limited'
  | 'server';

export class ApiError extends Error {
  kind: ApiErrorKind;
  /** HTTP status, when the server answered. */
  status?: number;
  /** The server's machine-readable reason, e.g. `sold_out`. */
  code?: string;

  constructor(kind: ApiErrorKind, message?: string, status?: number, code?: string) {
    super(message ?? kind);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.code = code;
  }
}

type ApiResponse = Pick<Response, 'ok' | 'status' | 'text'>;

export interface ApiDeps {
  baseUrl: string;
  fetch: (url: string, init: RequestInit) => Promise<ApiResponse>;
  /** A token that is safe to send now, or null when there is no session. */
  getAccessToken: () => Promise<string | null>;
  /** Renews the session after the server refused a token. */
  refresh: () => Promise<'ok' | 'rejected' | 'unreachable'>;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** A plain object is sent as JSON. A FormData is sent as it is (file uploads). */
  body?: unknown;
  headers?: Record<string, string>;
  /** Default true. Pass false for endpoints that work signed out. */
  auth?: boolean;
}

const KIND_BY_STATUS: Record<number, ApiErrorKind> = {
  400: 'invalid',
  401: 'signed_out',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  422: 'invalid',
  429: 'rate_limited',
};

function isFormData(body: unknown): body is FormData {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

/** Reads the server's problem body: `{ title, code, errors: { Field: [reason] } }`. */
function errorFrom(status: number, text: string): ApiError {
  const kind = KIND_BY_STATUS[status] ?? 'server';
  let message: string | undefined;
  let code: string | undefined;
  try {
    const body = JSON.parse(text) as { title?: unknown; code?: unknown; errors?: Record<string, unknown> } | string | null;
    if (typeof body === 'string') {
      message = body;
    } else if (body) {
      if (typeof body.code === 'string') code = body.code;
      const firstFieldError = body.errors && Object.values(body.errors).flat().find((v): v is string => typeof v === 'string');
      message = firstFieldError ?? (typeof body.title === 'string' ? body.title : undefined);
    }
  } catch {
    if (text && text.length < 300) message = text; // plain-text reasons from older endpoints
  }
  return new ApiError(kind, message, status, code);
}

export function createApi(deps: ApiDeps) {
  async function send(path: string, options: RequestOptions, token: string | null): Promise<ApiResponse> {
    const headers: Record<string, string> = { ...options.headers };
    if (token) headers.Authorization = `Bearer ${token}`;

    let body: BodyInit | undefined;
    if (isFormData(options.body)) {
      body = options.body; // the platform sets the multipart boundary
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }

    try {
      return await deps.fetch(`${deps.baseUrl}${path}`, { method: options.method ?? 'GET', headers, body });
    } catch {
      throw new ApiError('offline');
    }
  }

  return {
    /**
     * Returns the parsed body (undefined for an empty answer) or throws an `ApiError`.
     * If the server refuses the token, the session is renewed and the request sent once more.
     */
    async request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
      const needsAuth = options.auth !== false;
      let token = needsAuth ? await deps.getAccessToken() : null;
      if (needsAuth && !token) throw new ApiError('signed_out');

      let response = await send(path, options, token);
      if (response.status === 401 && needsAuth) {
        const renewed = await deps.refresh();
        if (renewed === 'unreachable') throw new ApiError('offline');
        token = renewed === 'ok' ? await deps.getAccessToken() : null;
        if (!token) throw new ApiError('signed_out', undefined, 401);
        response = await send(path, options, token);
      }

      const text = await response.text();
      if (!response.ok) throw errorFrom(response.status, text);
      return (text ? JSON.parse(text) : undefined) as T;
    },
  };
}

export type Api = ReturnType<typeof createApi>;
