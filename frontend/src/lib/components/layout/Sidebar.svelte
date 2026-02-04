<script lang="ts">
	import { page } from '$app/state';
	import {
		LayoutDashboard,
		Bot,
		ShoppingCart,
		Users,
		Newspaper,
		Bitcoin,
		CloudSun
	} from 'lucide-svelte';

	const navItems = [
		{ href: '/', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/scrapers', label: 'Scrapers', icon: Bot },
		{ href: '/ecommerce', label: 'E-commerce', icon: ShoppingCart },
		{ href: '/social', label: 'Social', icon: Users },
		{ href: '/news', label: 'News', icon: Newspaper },
		{ href: '/crypto', label: 'Crypto', icon: Bitcoin },
		{ href: '/weather', label: 'Weather', icon: CloudSun }
	];

	const currentPath = $derived(page.url.pathname);
</script>

<aside class="fixed left-0 top-0 z-30 flex h-screen w-[220px] flex-col border-r border-border bg-surface">
	<div class="flex h-14 items-center gap-2 border-b border-border px-5">
		<div class="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
			<span class="text-sm font-bold text-white">D</span>
		</div>
		<span class="text-lg font-bold">DataPulse</span>
	</div>

	<nav class="flex-1 space-y-0.5 px-3 py-4">
		{#each navItems as item}
			{@const isActive = currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href))}
			<a
				href={item.href}
				class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors {isActive
					? 'bg-primary/10 text-primary font-medium'
					: 'text-text-muted hover:bg-surface-hover hover:text-text'}"
			>
				<item.icon size={18} />
				{item.label}
			</a>
		{/each}
	</nav>

	<div class="border-t border-border p-4 text-xs text-text-muted">
		<p>DataPulse v0.1.0</p>
		<p class="mt-0.5 text-[10px] opacity-60">Demo - Mock Data</p>
	</div>
</aside>
