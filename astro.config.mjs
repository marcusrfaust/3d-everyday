import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

// 3d-Everyday — SSR readonly sobre o D1 do 3d-lib. Porta 4322 (3d-lib usa 4321).
// Produção: adapter node standalone (node ./dist/server/entry.mjs).
// security.checkOrigin desativado porque o Astro 5.18 só oferece boolean (sem
// allowlist) e o check nativo dá 403 atrás do túnel cf (Host interno ≠ Origin).
// A proteção CSRF vive em src/middleware.ts (allowlist explícita).
export default defineConfig({output: 'server', site: 'https://3de.focol.ai', security: {checkOrigin: false}, adapter: node({mode: 'standalone'}), vite: {plugins: [tailwindcss()],server: {allowedHosts: ['3de.focol.ai', '.trycloudflare.com', 'localhost', '127.0.0.1']}}});
