<script lang="ts">
	let { size = 'md' }: { size?: 'sm' | 'md' | 'lg' } = $props();

	const sizeClasses: Record<string, string> = {
		sm: 'h-4 w-4',
		md: 'h-8 w-8',
		lg: 'h-12 w-12'
	};
</script>

<div class="flex items-center justify-center">
	<div class={`${sizeClasses[size]} animate-spin rounded-full border-2 border-primary/30 border-t-primary`}></div>
</div>
