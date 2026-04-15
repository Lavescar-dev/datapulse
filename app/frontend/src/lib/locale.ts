import { createSignal, onCleanup, onMount } from 'solid-js';
import type { DataPulseLocale } from './i18n';

const resolveLocale = (value?: string | null): DataPulseLocale => (value === 'en' ? 'en' : 'tr');

export function getCurrentLocale(): DataPulseLocale {
	if (typeof window === 'undefined') return 'tr';
	return resolveLocale(localStorage.getItem('dp-locale'));
}

export function createLocaleSignal() {
	const [locale, setLocale] = createSignal<DataPulseLocale>(getCurrentLocale());

	onMount(() => {
		const updateLocale = (event?: Event) => {
			const detailLocale = (event as CustomEvent<{ locale?: DataPulseLocale }> | undefined)?.detail?.locale;
			setLocale(resolveLocale(detailLocale ?? localStorage.getItem('dp-locale')));
		};

		window.addEventListener('datapulse:localechange', updateLocale as EventListener);
		window.addEventListener('storage', updateLocale);

		onCleanup(() => {
			window.removeEventListener('datapulse:localechange', updateLocale as EventListener);
			window.removeEventListener('storage', updateLocale);
		});
	});

	return locale;
}
