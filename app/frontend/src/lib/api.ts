const DEFAULT_LOCAL_API_ORIGIN = 'http://127.0.0.1:8131';
const PUBLIC_API_ORIGIN = import.meta.env.PUBLIC_DATAPULSE_API_BASE_URL || '';

export class ApiError extends Error {
	status: number;
	code?: string;
	payload?: unknown;

	constructor(message: string, status: number, code?: string, payload?: unknown) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.code = code;
		this.payload = payload;
	}
}

function normalizeApiPath(path: string) {
	return path.startsWith('/') ? path : `/${path}`;
}

function getServerApiOrigin() {
	return process.env.DATAPULSE_API_BASE_URL || process.env.API_BASE_URL || DEFAULT_LOCAL_API_ORIGIN;
}

export function apiUrl(path: string) {
	const normalizedPath = normalizeApiPath(path);

	if (typeof window === 'undefined') {
		return new URL(normalizedPath, getServerApiOrigin()).toString();
	}

	if (PUBLIC_API_ORIGIN) {
		return new URL(normalizedPath, PUBLIC_API_ORIGIN).toString();
	}

	return normalizedPath;
}

async function parseResponseBody(response: Response) {
	const text = await response.text();
	if (!text.trim()) return null;

	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

let startingDemoSessionPromise: Promise<boolean> | null = null;

export async function ensureDemoSession() {
	if (typeof window === 'undefined') return false;
	if (startingDemoSessionPromise) return startingDemoSessionPromise;

	startingDemoSessionPromise = (async () => {
		const response = await fetch(apiUrl('/api/session/start'), {
			method: 'POST',
			credentials: 'include',
		});

		if (!response.ok) {
			const payload = await parseResponseBody(response);
			throw new ApiError('Demo oturumu baslatilamadi', response.status, (payload as any)?.code, payload);
		}

		return true;
	})()
		.finally(() => {
			startingDemoSessionPromise = null;
		});

	return startingDemoSessionPromise;
}

type ApiFetchOptions = RequestInit & {
	requireSession?: boolean;
	retryOnAuth?: boolean;
};

export async function apiFetch(path: string, options: ApiFetchOptions = {}) {
	const { requireSession = false, retryOnAuth = requireSession, headers, credentials, ...rest } = options;

	const doFetch = () =>
		fetch(apiUrl(path), {
			credentials: credentials ?? 'include',
			headers,
			...rest,
		});

	let response = await doFetch();

	if (response.status === 401 && retryOnAuth && typeof window !== 'undefined') {
		try {
			await ensureDemoSession();
			response = await doFetch();
		} catch {
			// fall through to typed error below
		}
	}

	if (!response.ok) {
		const payload = await parseResponseBody(response);
		const message =
			typeof payload === 'object' && payload !== null
				? ((payload as any).message || (payload as any).error || `API istegi basarisiz (${response.status})`)
				: `API istegi basarisiz (${response.status})`;
		const code = typeof payload === 'object' && payload !== null ? (payload as any).code : undefined;
		throw new ApiError(message, response.status, code, payload);
	}

	return response;
}

export async function apiJson<T>(path: string, options: ApiFetchOptions = {}) {
	const response = await apiFetch(path, options);
	return (await response.json()) as T;
}

export function isSessionError(error: unknown) {
	return error instanceof ApiError && (error.code === 'SESSION_REQUIRED' || error.code === 'SESSION_EXPIRED');
}
