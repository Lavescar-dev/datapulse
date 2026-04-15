import { createSignal, createResource, Show, onMount, onCleanup } from 'solid-js';
import NotificationPanel from './NotificationPanel';
import type { Notification } from '../../../../shared/types/notification';
import { apiUrl } from '../../lib/api';
import { createLocaleSignal } from '../../lib/locale';

export default function NotificationBell() {
	const locale = createLocaleSignal();
	const t = (tr: string, en: string) => (locale() === 'en' ? en : tr);
	const [showDropdown, setShowDropdown] = createSignal(false);
	const [refreshTrigger, setRefreshTrigger] = createSignal(0);

	// Fetch unread notification count
	const [countData, { refetch: refetchCount }] = createResource(
		() => refreshTrigger(),
		async () => {
			try {
				const response = await fetch(apiUrl('/api/notifications/count'), {
					credentials: 'include',
				});

				if (!response.ok) return { unreadCount: 0 };

				const data = await response.json();
				return { unreadCount: data.unreadCount || 0 };
			} catch (error) {
				console.error('Error fetching notification count:', error);
				return { unreadCount: 0 };
			}
		}
	);

	// Fetch notifications when dropdown is open
	const [notificationsData, { refetch: refetchNotifications }] = createResource(
		() => ({ trigger: refreshTrigger(), open: showDropdown() }),
		async ({ open }) => {
			if (!open) return { notifications: [] };

			try {
				const response = await fetch(apiUrl('/api/notifications?limit=10'), {
					credentials: 'include',
				});

				if (!response.ok) return { notifications: [] };

				const data = await response.json();
				return { notifications: data.notifications || [] };
			} catch (error) {
				console.error('Error fetching notifications:', error);
				return { notifications: [] };
			}
		}
	);

	const handleMarkAsRead = async (id: string) => {
		try {
			const response = await fetch(apiUrl(`/api/notifications/${id}/read`), {
				method: 'PUT',
				credentials: 'include',
			});

			if (response.ok) {
				setRefreshTrigger((prev) => prev + 1);
			}
		} catch (error) {
			console.error('Error marking notification as read:', error);
		}
	};

	const handleMarkAllAsRead = async () => {
		try {
			const response = await fetch(apiUrl('/api/notifications/read-all'), {
				method: 'PUT',
				credentials: 'include',
			});

			if (response.ok) {
				setRefreshTrigger((prev) => prev + 1);
			}
		} catch (error) {
			console.error('Error marking all as read:', error);
		}
	};

	const handleArchive = async (id: string) => {
		try {
			const response = await fetch(apiUrl(`/api/notifications/${id}/archive`), {
				method: 'PUT',
				credentials: 'include',
			});

			if (response.ok) {
				setRefreshTrigger((prev) => prev + 1);
			}
		} catch (error) {
			console.error('Error archiving notification:', error);
		}
	};

	// Close dropdown when clicking outside
	const handleClickOutside = (event: MouseEvent) => {
		const target = event.target as HTMLElement;
		if (!target.closest('#notification-bell-container')) {
			setShowDropdown(false);
		}
	};

	onMount(() => {
		document.addEventListener('click', handleClickOutside);

		// Poll for new notifications every 30 seconds
		const pollInterval = setInterval(() => {
			setRefreshTrigger((prev) => prev + 1);
		}, 30000);

		onCleanup(() => {
			document.removeEventListener('click', handleClickOutside);
			clearInterval(pollInterval);
		});
	});

	const unreadCount = () => countData()?.unreadCount || 0;

	return (
		<div id="notification-bell-container" class="relative">
			{/* Bell Icon Button */}
			<button
				onClick={() => setShowDropdown(!showDropdown())}
				class="relative p-2 text-gray-400 hover:text-gray-100 transition-colors rounded-lg hover:bg-gray-800"
				aria-label={t('Bildirimler', 'Notifications')}
			>
				{/* Bell Icon */}
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
					></path>
				</svg>

				{/* Badge with count */}
				<Show when={unreadCount() > 0}>
					<span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
						{unreadCount() > 99 ? '99+' : unreadCount()}
					</span>
				</Show>
			</button>

			{/* Dropdown Panel */}
			<Show when={showDropdown()}>
				<NotificationPanel
					notifications={notificationsData()?.notifications || []}
					loading={notificationsData.loading}
					unreadCount={unreadCount()}
					onMarkAsRead={handleMarkAsRead}
					onMarkAllAsRead={handleMarkAllAsRead}
					onArchive={handleArchive}
					onClose={() => setShowDropdown(false)}
				/>
			</Show>
		</div>
	);
}
