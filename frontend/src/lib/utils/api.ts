const BASE = '';

export async function fetchApi<T>(endpoint: string): Promise<T> {
	const res = await fetch(`${BASE}${endpoint}`);
	if (!res.ok) throw new Error(`API error: ${res.status}`);
	return res.json();
}

export function streamApi(
	endpoint: string,
	onMessage: (data: string) => void,
	onError?: (error: Event) => void
): () => void {
	const eventSource = new EventSource(`${BASE}${endpoint}`);

	eventSource.onmessage = (event) => {
		onMessage(event.data);
	};

	eventSource.onerror = (event) => {
		if (onError) onError(event);
		eventSource.close();
	};

	return () => {
		eventSource.close();
	};
}
