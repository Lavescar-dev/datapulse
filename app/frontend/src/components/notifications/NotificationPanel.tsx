import { For, Show } from 'solid-js';
import type { Notification } from '../../../../shared/types/notification';
import { createLocaleSignal } from '../../lib/locale';

interface NotificationPanelProps {
	notifications: Notification[];
	loading: boolean;
	unreadCount: number;
	onMarkAsRead: (id: string) => void;
	onMarkAllAsRead: () => void;
	onArchive: (id: string) => void;
	onClose: () => void;
}

export default function NotificationPanel(props: NotificationPanelProps) {
	const locale = createLocaleSignal();
	const t = (tr: string, en: string) => (locale() === 'en' ? en : tr);

	const getSeverityColor = (severity: string) => {
		switch (severity) {
			case 'error':
				return 'bg-red-500/20 text-red-400';
			case 'warning':
				return 'bg-yellow-500/20 text-yellow-400';
			case 'success':
				return 'bg-green-500/20 text-green-400';
			default:
				return 'bg-blue-500/20 text-blue-400';
		}
	};

	const getSourceIcon = (source: string) => {
		switch (source) {
			case 'price':
				return '💰';
			case 'monitor':
				return '📡';
			case 'social':
				return '💬';
			case 'news':
				return '📰';
			default:
				return '🔔';
		}
	};

	const getSourceLabel = (source: string) => {
		switch (source) {
			case 'price':
				return t('Fiyat', 'Price');
			case 'monitor':
				return t('API', 'API');
			case 'social':
				return t('Sosyal', 'Social');
			case 'news':
				return t('Haber', 'News');
			default:
				return t('Sistem', 'System');
		}
	};

	const getSeverityLabel = (severity: string) => {
		switch (severity) {
			case 'error':
				return t('Hata', 'Error');
			case 'warning':
				return t('Uyarı', 'Warning');
			case 'success':
				return t('Başarılı', 'Success');
			default:
				return t('Bilgi', 'Info');
		}
	};

	const formatTime = (dateString: string) => {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return t('Az önce', 'Just now');
		if (diffMins < 60) return locale() === 'en' ? `${diffMins} min ago` : `${diffMins} dk önce`;
		if (diffHours < 24) return locale() === 'en' ? `${diffHours} hour${diffHours === 1 ? '' : 's'} ago` : `${diffHours} saat önce`;
		if (diffDays < 7) return locale() === 'en' ? `${diffDays} day${diffDays === 1 ? '' : 's'} ago` : `${diffDays} gün önce`;

		return date.toLocaleDateString(locale() === 'en' ? 'en-US' : 'tr-TR', {
			day: 'numeric',
			month: 'short',
		});
	};

	return (
		<div class="absolute right-0 mt-2 w-80 sm:w-96 bg-gray-900 border border-gray-800 rounded-lg shadow-xl z-50">
			{/* Header */}
			<div class="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
				<h3 class="font-semibold text-gray-200 flex items-center gap-2">
					<span>{t('Bildirimler', 'Notifications')}</span>
					<Show when={props.unreadCount > 0}>
						<span class="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
							{props.unreadCount} {t('yeni', 'new')}
						</span>
					</Show>
				</h3>
				<Show when={props.unreadCount > 0}>
					<button
						onClick={props.onMarkAllAsRead}
						class="text-xs text-blue-400 hover:text-blue-300 transition-colors"
					>
						{t('Tümünü okundu işaretle', 'Mark all as read')}
					</button>
				</Show>
			</div>

			{/* Notifications List */}
			<div class="max-h-96 overflow-y-auto">
				<Show when={props.loading}>
					<div class="px-4 py-8 text-center text-gray-500">
						<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
						<p class="text-sm">{t('Yükleniyor...', 'Loading...')}</p>
					</div>
				</Show>

				<Show when={!props.loading}>
					<Show
						when={props.notifications.length > 0}
						fallback={
							<div class="px-4 py-8 text-center text-gray-500">
								<div class="text-4xl mb-2">🔔</div>
								<p class="text-sm">{t('Bildirim yok', 'No notifications')}</p>
								<p class="text-xs text-gray-600 mt-1">
									{t('Fiyat alarmları ve API durumları burada görünecek', 'Price alerts and API status will appear here')}
								</p>
							</div>
						}
					>
						<For each={props.notifications}>
							{(notification) => (
								<div
									class={`px-4 py-3 border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors ${
										notification.status === 'unread' ? 'bg-gray-800/30' : ''
									}`}
								>
									{/* Header Row */}
									<div class="flex items-center gap-2 mb-1">
										<span class="text-lg">{getSourceIcon(notification.source)}</span>
										<span
											class={`text-xs font-semibold px-2 py-0.5 rounded ${getSeverityColor(notification.severity)}`}
										>
											{getSeverityLabel(notification.severity)}
										</span>
										<span class="text-xs text-gray-500">{getSourceLabel(notification.source)}</span>
										<Show when={notification.status === 'unread'}>
											<span class="w-2 h-2 bg-blue-500 rounded-full ml-auto"></span>
										</Show>
									</div>

									{/* Title */}
									<h4 class="font-semibold text-gray-200 text-sm mb-1">{notification.title}</h4>

									{/* Message */}
									<p class="text-sm text-gray-400 mb-2 line-clamp-2">{notification.message}</p>

									{/* Metadata (Price specific) */}
									<Show when={notification.source === 'price' && notification.metadata?.currentPrice}>
										<div class="text-xs text-gray-500 mb-2">
											{notification.metadata?.productName && (
												<span class="text-gray-400">{notification.metadata.productName} - </span>
											)}
											<span
												class={
													notification.metadata?.priceChange && notification.metadata.priceChange < 0
														? 'text-green-400'
														: 'text-red-400'
												}
											>
												{notification.metadata?.currentPrice} {notification.metadata?.currency || 'TL'}
											</span>
										</div>
									</Show>

									{/* Metadata (Monitor specific) */}
									<Show when={notification.source === 'monitor' && notification.metadata?.responseTime}>
										<div class="text-xs text-gray-500 mb-2">
											<span>{t('Yanıt süresi:', 'Response time:')} </span>
											<span class="text-gray-400">{notification.metadata?.responseTime}ms</span>
										</div>
									</Show>

									{/* Footer */}
									<div class="flex justify-between items-center">
										<span class="text-xs text-gray-500">{formatTime(notification.createdAt)}</span>
										<div class="flex gap-2">
											<Show when={notification.actionUrl}>
												<a
												href={notification.actionUrl}
												class="text-xs text-blue-400 hover:text-blue-300 transition-colors"
												onClick={props.onClose}
											>
													{t('Görüntüle', 'View')}
											</a>
											</Show>
											<Show when={notification.status === 'unread'}>
												<button
													onClick={() => props.onMarkAsRead(notification.id)}
													class="text-xs text-gray-400 hover:text-gray-300 transition-colors"
												>
													{t('Okundu', 'Mark read')}
												</button>
											</Show>
											<button
												onClick={() => props.onArchive(notification.id)}
												class="text-xs text-gray-400 hover:text-gray-300 transition-colors"
											>
												{t('Arşivle', 'Archive')}
											</button>
										</div>
									</div>
								</div>
							)}
						</For>
					</Show>
				</Show>
			</div>

			{/* Footer */}
			<Show when={props.notifications.length > 0}>
				<div class="px-4 py-3 border-t border-gray-800 text-center bg-gray-900/50">
					<a
						href="/notifications"
						class="text-sm text-blue-400 hover:text-blue-300 transition-colors"
						onClick={props.onClose}
					>
						{t('Tüm bildirimleri gör', 'View all notifications')}
					</a>
				</div>
			</Show>
		</div>
	);
}
