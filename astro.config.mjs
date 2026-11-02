import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// 3d-Everyday — SSR readonly sobre o D1 do 3d-lib. Porta 4322 (3d-lib usa 4321).
export default defineConfig({output: 'server',vite: {plugins: [tailwindcss()],server: {allowedHosts: ['3de.focol.ai', '.trycloudflare.com', 'localhost', '127.0.0.1']}}});