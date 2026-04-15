const HTML_URL_ENTITIES: Record<string, string> = {
	'&amp;': '&',
	'&quot;': '"',
	'&#39;': "'",
	'&lt;': '<',
	'&gt;': '>',
};

const HTML_URL_ENTITY_PATTERN = /&(amp|quot|#39|lt|gt);/gi;

export function normalizeHtmlUrl(url?: string | null) {
	const value = url?.trim();
	if (!value) return '';

	return value.replace(HTML_URL_ENTITY_PATTERN, (entity) => HTML_URL_ENTITIES[entity.toLowerCase()] ?? entity);
}

const GITHUB_AVATAR_HOST = 'avatars.githubusercontent.com';
const PREFERRED_GITHUB_AVATAR_SIZE = '240';

export function getPreferredThumbnailUrl(url?: string | null) {
	const normalizedUrl = normalizeHtmlUrl(url);
	if (!normalizedUrl) return '';

	let parsedUrl: URL;

	try {
		parsedUrl = new URL(normalizedUrl);
	} catch {
		return normalizedUrl;
	}

	const hostname = parsedUrl.hostname.toLowerCase();

	if (hostname === GITHUB_AVATAR_HOST) {
		const currentSize = Number(parsedUrl.searchParams.get('s'));
		if (!Number.isFinite(currentSize) || currentSize < Number(PREFERRED_GITHUB_AVATAR_SIZE)) {
			parsedUrl.searchParams.set('s', PREFERRED_GITHUB_AVATAR_SIZE);
		}
		return parsedUrl.toString();
	}

	return normalizedUrl;
}
