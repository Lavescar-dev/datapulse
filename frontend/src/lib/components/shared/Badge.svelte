<script lang="ts">
	import { cn } from '$lib/utils/cn';

	let { variant = 'default', children }: {
		variant?: 'success' | 'warning' | 'danger' | 'info' | 'default';
		children: any;
	} = $props();

	const variantClasses: Record<string, string> = {
		success: 'bg-success/20 text-success',
		warning: 'bg-warning/20 text-warning',
		danger: 'bg-danger/20 text-danger',
		info: 'bg-info/20 text-info',
		default: 'bg-surface-hover text-text-muted'
	};
</script>

<span class={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', variantClasses[variant])}>
	{@render children()}
</span>
