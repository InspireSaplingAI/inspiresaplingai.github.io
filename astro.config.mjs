import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
    site: 'https://inspiresaplingai.github.io',
    integrations: [tailwind()],
    adapter: cloudflare({
        imageService: 'passthrough',
    }),
});
