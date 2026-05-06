import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://inspiresaplingai.github.io',
  integrations: [tailwind()],
});
