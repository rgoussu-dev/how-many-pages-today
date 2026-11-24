import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** GitHub Pages serves the repository at /<repo>/. Override with BASE_PATH for other hosts. */
const base = process.env.BASE_PATH ?? '/how-many-pages-today/';

export default defineConfig({
  base,
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true },
  plugins: [
    VitePWA({
      // Our own service worker: precaching via Workbox, plus the reminder logic.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false, // main.ts registers it, after the domain is wired
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        rollupFormat: 'iife',
      },
      includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'How Many Pages Today',
        short_name: 'Pages Today',
        description: 'A daily reading challenge: one card, one picture, a number of pages. Works offline.',
        lang: 'en',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#e9d7b4',
        theme_color: '#4a2d18',
        categories: ['books', 'education', 'lifestyle'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
