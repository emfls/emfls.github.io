import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://emfls.com',
  base: '/kor/stockwiki',
  output: 'static',
  integrations: [],
  build: {
    assets: '_assets',
  },
  vite: {
    build: {
      rollupOptions: {
        external: ['/kor/stockwiki/pagefind/pagefind-ui.js'],
      },
    },
  },
});
