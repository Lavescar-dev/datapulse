<script lang="ts">
	let { columns, rows, onRowClick }: {
		columns: { key: string; label: string; align?: 'left' | 'right' | 'center' }[];
		rows: Record<string, any>[];
		onRowClick?: (row: Record<string, any>) => void;
	} = $props();
</script>

<div class="overflow-x-auto rounded-lg border border-border">
	<table class="w-full text-sm">
		<thead>
			<tr class="border-b border-border bg-surface">
				{#each columns as col}
					<th
						class="px-4 py-3 font-medium text-text-muted"
						class:text-left={col.align !== 'right' && col.align !== 'center'}
						class:text-right={col.align === 'right'}
						class:text-center={col.align === 'center'}
					>
						{col.label}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as row}
				<tr
					class="border-b border-border/50 transition-colors hover:bg-surface-hover"
					class:cursor-pointer={!!onRowClick}
					onclick={() => onRowClick?.(row)}
				>
					{#each columns as col}
						<td
							class="px-4 py-3"
							class:text-left={col.align !== 'right' && col.align !== 'center'}
							class:text-right={col.align === 'right'}
							class:text-center={col.align === 'center'}
						>
							{row[col.key] ?? ''}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
