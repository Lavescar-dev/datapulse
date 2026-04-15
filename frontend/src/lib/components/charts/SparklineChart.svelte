<script lang="ts">
	let { data, color = '#3b82f6', width = 100, height = 30 }: {
		data: number[];
		color?: string;
		width?: number;
		height?: number;
	} = $props();

	let canvas: HTMLCanvasElement;

	$effect(() => {
		if (!canvas || !data || data.length < 2) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		canvas.width = width * dpr;
		canvas.height = height * dpr;
		ctx.scale(dpr, dpr);
		ctx.clearRect(0, 0, width, height);

		const min = Math.min(...data);
		const max = Math.max(...data);
		const range = max - min || 1;
		const padding = 2;
		const drawWidth = width - padding * 2;
		const drawHeight = height - padding * 2;
		const step = drawWidth / (data.length - 1);

		ctx.beginPath();
		ctx.strokeStyle = color;
		ctx.lineWidth = 1.5;
		ctx.lineJoin = 'round';
		ctx.lineCap = 'round';

		for (let i = 0; i < data.length; i++) {
			const x = padding + i * step;
			const y = padding + drawHeight - ((data[i] - min) / range) * drawHeight;
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.stroke();
	});
</script>

<canvas
	bind:this={canvas}
	style="width: {width}px; height: {height}px;"
	class="block"
></canvas>
