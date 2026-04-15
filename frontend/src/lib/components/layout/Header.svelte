<script lang="ts">
	import { page } from '$app/state';
	import { Bell, Search } from 'lucide-svelte';

	const pageTitles: Record<string, string> = {
		'/': 'Dashboard',
		'/scrapers': 'Scrapers',
		'/ecommerce': 'E-commerce',
		'/social': 'Social Media',
		'/news': 'News Feed',
		'/crypto': 'Crypto Tracker',
		'/weather': 'Weather'
	};

	const title = $derived(pageTitles[page.url.pathname] ?? 'DataPulse');
</script>

<header class="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface/80 px-6 backdrop-blur-sm">
	<h1 class="text-lg font-semibold">{title}</h1>

	<div class="flex items-center gap-3">
		<div class="flex items-center gap-2 rounded-lg bg-background px-3 py-1.5 text-sm text-text-muted">
			<Search size={14} />
			<span>Search...</span>
		</div>
		<button class="relative rounded-lg p-2 text-text-muted transition-colors hover:bg-surface-hover hover:text-text">
			<Bell size={18} />
			<span class="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger"></span>
		</button>
	</div>
</header>
