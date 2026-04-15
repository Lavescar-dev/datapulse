const SECOND_IN_MS = 1000;
const MIN_REASONABLE_TIMESTAMP_MS = Date.UTC(2000, 0, 1);
const MAX_REASONABLE_FUTURE_SKEW_MS = 10 * 60 * SECOND_IN_MS;

export const normalizeTimestampMs = (value: unknown): number | null => {
	if (value instanceof Date) {
		const dateMs = value.getTime();
		return Number.isFinite(dateMs) ? dateMs : null;
	}

	let numericValue: number | null = null;

	if (typeof value === 'number') {
		numericValue = value;
	} else if (typeof value === 'string') {
		const trimmedValue = value.trim();
		if (!trimmedValue) return null;

		const parsedNumber = Number(trimmedValue);
		numericValue = Number.isFinite(parsedNumber) ? parsedNumber : Date.parse(trimmedValue);
	} else {
		return null;
	}

	if (!Number.isFinite(numericValue)) return null;

	const normalizedValue = Math.abs(numericValue) < 1e11 ? numericValue * SECOND_IN_MS : numericValue;
	const timestampMs = Math.trunc(normalizedValue);

	if (timestampMs < MIN_REASONABLE_TIMESTAMP_MS) return null;

	return timestampMs;
};

export const parseTimestamp = (value: unknown): Date | null => {
	const timestampMs = normalizeTimestampMs(value);
	if (timestampMs === null) return null;

	const date = new Date(timestampMs);
	return Number.isNaN(date.getTime()) ? null : date;
};

export const isReasonableFutureDate = (date: Date, now = Date.now()) => {
	return date.getTime() - now <= MAX_REASONABLE_FUTURE_SKEW_MS;
};
