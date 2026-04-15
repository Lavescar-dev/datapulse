import { createSignal, Show } from 'solid-js';
import { apiUrl } from '../../lib/api';
import { createLocaleSignal } from '../../lib/locale';

interface AddEndpointProps {
	onEndpointAdded?: () => void;
}

export default function AddEndpoint(props: AddEndpointProps) {
	const locale = createLocaleSignal();
	const t = (tr: string, en: string) => (locale() === 'en' ? en : tr);
	const [name, setName] = createSignal('');
	const [url, setUrl] = createSignal('');
	const [method, setMethod] = createSignal<'GET' | 'POST' | 'HEAD'>('GET');
	const [checkInterval, setCheckInterval] = createSignal(5);
	const [loading, setLoading] = createSignal(false);
	const [message, setMessage] = createSignal<{ type: 'success' | 'error'; text: string } | null>(null);

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		setMessage(null);

		if (!name().trim() || !url().trim()) {
			setMessage({ type: 'error', text: t('İsim ve URL alanları zorunludur', 'Name and URL are required') });
			return;
		}

		try {
			new URL(url());
		} catch {
			setMessage({ type: 'error', text: t('Geçerli bir URL giriniz', 'Please enter a valid URL') });
			return;
		}

		setLoading(true);

		try {
			const response = await fetch(apiUrl('/api/monitor/endpoints'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({
					name: name().trim(),
					url: url().trim(),
					method: method(),
					checkInterval: checkInterval(),
				}),
			});

			const data = await response.json();

			if (response.ok) {
				setMessage({ type: 'success', text: t('Endpoint başarıyla eklendi!', 'Endpoint added successfully!') });
				setName('');
				setUrl('');
				setMethod('GET');
				setCheckInterval(5);
				props.onEndpointAdded?.();
			} else {
				setMessage({ type: 'error', text: data.message || t('Endpoint eklenirken hata oluştu', 'An error occurred while adding the endpoint') });
			}
		} catch (error) {
			console.error('Error adding endpoint:', error);
			setMessage({ type: 'error', text: t('Bir hata oluştu. Lütfen tekrar deneyin.', 'An error occurred. Please try again.') });
		} finally {
			setLoading(false);
		}
	};

	return (
		<div class="dp-monitor-admin-panel">
			<div class="dp-monitor-admin-title">{t('ROOT_INJECTOR // YENİ ENDPOINT EKLE', 'ROOT_INJECTOR // ADD NEW ENDPOINT')}</div>

			<form onSubmit={handleSubmit} class="dp-monitor-admin-form">
				<div class="dp-monitor-admin-grid">
					<input type="text" value={name()} onInput={(e) => setName(e.currentTarget.value)} placeholder={t('NODE ADI', 'NODE NAME')} />
					<input type="url" value={url()} onInput={(e) => setUrl(e.currentTarget.value)} placeholder="https://api.example.com/health" />
					<select value={method()} onChange={(e) => setMethod(e.currentTarget.value as 'GET' | 'POST' | 'HEAD')}>
						<option value="GET">GET</option>
						<option value="POST">POST</option>
						<option value="HEAD">HEAD</option>
					</select>
					<input type="number" min="1" max="60" value={checkInterval()} onInput={(e) => setCheckInterval(parseInt(e.currentTarget.value) || 5)} placeholder="5" />
				</div>

				<button type="submit" disabled={loading()} class="dp-monitor-admin-submit">
					{loading() ? t('ENJEKTE EDİLİYOR...', 'INJECTING...') : t('ENDPOINT ENJEKTE ET', 'INJECT ENDPOINT')}
				</button>

				<Show when={message()}>
					<div class={`dp-monitor-inline-alert ${message()!.type === 'success' ? 'is-success' : 'is-danger'}`}>
						{message()!.text}
					</div>
				</Show>
			</form>
		</div>
	);
}
