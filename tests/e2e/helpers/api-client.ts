import { DETECTIVE_ALPHA, createSessionToken, type TestUserPersona } from './auth';

export interface ApiClientOptions {
    baseURL?: string;
    defaultUser?: TestUserPersona | null;
}

export interface ApiRequestOptions {
    user?: TestUserPersona | null;
    headers?: Record<string, string>;
    params?: Record<string, string | number | boolean>;
}

export interface ApiResponse<T = unknown> {
    status: number;
    statusText: string;
    headers: Headers;
    data: T;
    text: string;
    ok: boolean;
}

export class ApiClient {
    private baseURL: string;
    private defaultUser: TestUserPersona | null;

    constructor(options: ApiClientOptions = {}) {
        this.baseURL = (options.baseURL || process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
        this.defaultUser = options.defaultUser !== undefined ? options.defaultUser : DETECTIVE_ALPHA;
    }

    /**
     * Builds the complete URL with search query parameters.
     */
    private buildUrl(path: string, params?: Record<string, string | number | boolean>): string {
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        const url = new URL(`${this.baseURL}${cleanPath}`);

        if (params) {
            for (const [key, value] of Object.entries(params)) {
                if (value !== undefined && value !== null) {
                    url.searchParams.append(key, String(value));
                }
            }
        }

        return url.toString();
    }

    /**
     * Resolves headers and injects genuine NextAuth v5 session cookie if user is provided.
     */
    private async resolveHeaders(
        options: ApiRequestOptions = {},
        hasBody: boolean = false
    ): Promise<Headers> {
        const headers = new Headers(options.headers || {});

        if (hasBody && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }

        // Determine user identity for this request
        const user = options.user !== undefined ? options.user : this.defaultUser;

        if (user) {
            const token = await createSessionToken(user);
            headers.set('Cookie', `authjs.session-token=${token}`);
        }

        // ZERO x-test-bypass headers allowed
        headers.delete('x-test-bypass');

        return headers;
    }

    private async executeRequest<T = unknown>(
        url: string,
        init: RequestInit
    ): Promise<ApiResponse<T>> {
        const res = await fetch(url, init);
        const text = await res.text();
        let data: unknown = text;

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            try {
                data = JSON.parse(text);
            } catch {
                data = text;
            }
        }

        return {
            status: res.status,
            statusText: res.statusText,
            headers: res.headers,
            data: data as T,
            text,
            ok: res.ok,
        };
    }

    async get<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
        const url = this.buildUrl(path, options.params);
        const headers = await this.resolveHeaders(options, false);

        return this.executeRequest<T>(url, {
            method: 'GET',
            headers,
        });
    }

    async post<T = unknown>(path: string, body?: unknown, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
        const url = this.buildUrl(path, options.params);
        const headers = await this.resolveHeaders(options, body !== undefined);

        return this.executeRequest<T>(url, {
            method: 'POST',
            headers,
            body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
        });
    }

    async put<T = unknown>(path: string, body?: unknown, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
        const url = this.buildUrl(path, options.params);
        const headers = await this.resolveHeaders(options, body !== undefined);

        return this.executeRequest<T>(url, {
            method: 'PUT',
            headers,
            body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
        });
    }

    async patch<T = unknown>(path: string, body?: unknown, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
        const url = this.buildUrl(path, options.params);
        const headers = await this.resolveHeaders(options, body !== undefined);

        return this.executeRequest<T>(url, {
            method: 'PATCH',
            headers,
            body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
        });
    }

    async delete<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
        const url = this.buildUrl(path, options.params);
        const headers = await this.resolveHeaders(options, false);

        return this.executeRequest<T>(url, {
            method: 'DELETE',
            headers,
        });
    }
}

/**
 * Creates an instance of ApiClient with default settings.
 */
export function createApiClient(baseURL?: string, defaultUser?: TestUserPersona | null): ApiClient {
    return new ApiClient({ baseURL, defaultUser });
}

/**
 * Standard security assertions for API responses.
 */
export const SecurityAssertions = {
    /**
     * Asserts that sensitive tokens (verificationToken, resetToken) are never returned in response data.
     */
    assertNoTokens(data: unknown): void {
        const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
        if (/["']?(verificationToken|resetToken)["']?\s*:/i.test(jsonStr)) {
            throw new Error(`Security Violation: Response leaked sensitive authentication token: ${jsonStr}`);
        }
    },

    /**
     * Asserts that password hash is never returned in response data.
     */
    assertNoPasswordHash(data: unknown): void {
        const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
        if (/["']?(passwordHash|password_hash)["']?\s*:/i.test(jsonStr)) {
            throw new Error(`Security Violation: Response leaked password hash: ${jsonStr}`);
        }
    },
};
