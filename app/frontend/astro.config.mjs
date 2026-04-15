// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import solidJs from '@astrojs/solid-js';

const apiProxyTarget = process.env.DATAPULSE_API_PROXY_TARGET || 'http://127.0.0.1:8131';

// https://astro.build/config
export default defineConfig({
  integrations: [solidJs()],
  server: {
    host: '127.0.0.1',
    port: 3031,
  },
  // @ts-ignore Astro accepts preview config here at runtime
  preview: {
    host: '127.0.0.1',
    port: 3031,
  },
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ['lightweight-charts'],
    },
		server: {
			proxy: {
				'^/api(?:/|$)': apiProxyTarget,
				'^/health$': apiProxyTarget,
			},
		},
		preview: {
			proxy: {
				'^/api(?:/|$)': apiProxyTarget,
				'^/health$': apiProxyTarget,
			},
		},
	},
});
