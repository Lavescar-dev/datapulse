<script lang="ts">
	import { fetchApi } from '$lib/utils/api';
	import type { WeatherData } from '$lib/types';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import { Search, Thermometer, Droplets, Wind } from 'lucide-svelte';

	let weather = $state<WeatherData | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let city = $state('istanbul');
	let searchInput = $state('istanbul');

	async function loadWeather() {
		loading = true;
		error = null;
		try {
			weather = await fetchApi<WeatherData>(`/api/weather/${city}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load weather';
		} finally {
			loading = false;
		}
	}

	function handleSearch() {
		const trimmed = searchInput.trim().toLowerCase();
		if (trimmed && trimmed !== city) {
			city = trimmed;
			loadWeather();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleSearch();
	}

	$effect(() => {
		loadWeather();
	});
</script>

<svelte:head>
	<title>Weather | DataPulse</title>
</svelte:head>

<div class="space-y-6">
	<!-- City selector -->
	<div class="flex gap-2">
		<div class="relative flex-1 max-w-sm">
			<Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
			<input
				type="text"
				bind:value={searchInput}
				onkeydown={handleKeydown}
				placeholder="Search city..."
				class="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-4 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
			/>
		</div>
		<button
			onclick={handleSearch}
			class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
		>
			Search
		</button>
	</div>

	{#if loading}
		<div class="flex h-64 items-center justify-center">
			<LoadingSpinner />
		</div>
	{:else if error}
		<div class="rounded-xl border border-danger/30 bg-danger/10 p-6 text-center text-danger">
			<p class="font-medium">Failed to load weather</p>
			<p class="mt-1 text-sm opacity-80">{error}</p>
		</div>
	{:else if weather}
		<!-- Current weather -->
		<div class="rounded-xl border border-border bg-surface p-6">
			<h2 class="mb-4 text-xl font-bold capitalize">{weather.city}</h2>
			<div class="flex flex-wrap items-center gap-8">
				<div>
					<div class="text-5xl font-bold">{weather.current.temp}&deg;C</div>
					<div class="mt-1 text-sm text-text-muted capitalize">{weather.current.condition}</div>
				</div>
				<div class="space-y-2 text-sm">
					<div class="flex items-center gap-2 text-text-muted">
						<Thermometer size={16} />
						<span>Feels like {weather.current.feels_like}&deg;C</span>
					</div>
					<div class="flex items-center gap-2 text-text-muted">
						<Droplets size={16} />
						<span>Humidity {weather.current.humidity}%</span>
					</div>
					<div class="flex items-center gap-2 text-text-muted">
						<Wind size={16} />
						<span>Wind {weather.current.wind_speed} km/h</span>
					</div>
				</div>
			</div>
		</div>

		<!-- 5-day forecast -->
		{#if weather.forecast?.length}
			<div>
				<h3 class="mb-3 text-lg font-semibold">5-Day Forecast</h3>
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
					{#each weather.forecast as day}
						<div class="rounded-xl border border-border bg-surface p-4 text-center">
							<div class="mb-2 text-sm font-medium text-text-muted">{day.date}</div>
							<div class="mb-1 text-2xl">{day.icon}</div>
							<div class="mb-1 text-sm capitalize text-text-muted">{day.condition}</div>
							<div class="flex items-center justify-center gap-2">
								<span class="font-semibold">{day.temp_high}&deg;</span>
								<span class="text-text-muted">{day.temp_low}&deg;</span>
							</div>
							<div class="mt-1.5 text-xs text-text-muted">
								<Droplets size={12} class="inline" /> {day.precipitation}%
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
