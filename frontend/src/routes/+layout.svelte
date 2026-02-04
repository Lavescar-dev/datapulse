<script lang="ts">
	import '../app.css';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import Header from '$lib/components/layout/Header.svelte';

	let { children } = $props();
</script>

<div class="flex min-h-screen">
	<Sidebar />

	<div class="ml-[220px] flex-1">
		<Header />
		<main class="p-6">
			{@render children()}
		</main>
	</div>
</div>

<!-- DEMO Watermark -->
<div class="pointer-events-none fixed bottom-4 right-4 z-50 rounded-lg bg-danger/10 px-3 py-1.5 text-xs font-medium text-danger/70 backdrop-blur-sm">
	DEMO - Mock Data
</div>
