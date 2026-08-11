import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
    site: 'https://inspiresaplingai.github.io',
    integrations: [tailwind()],
    // This app uses Supabase for auth — Astro sessions are not used.
    // Explicitly configure a memory session driver so the Cloudflare adapter
    // does NOT auto-enable a "SESSION" KV binding (which doesn't exist in
    // Pages and causes runtime "message channel closed" errors).
    session: {
        driver: 'memory',
    },
    adapter: cloudflare({
        imageService: 'passthrough',
    }),
});
