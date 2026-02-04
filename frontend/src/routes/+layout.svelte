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
