import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

// The artifact workflow supplies PORT at runtime. Static builds load this
// config without a listening service, so use Vite's conventional port there.
const rawPort = process.env.PORT ?? '5173';

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Jaguar is the root-path artifact; keep standalone production builds usable.
const basePath = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    {
      name: 'single-query-client-context',
      apply: 'build',
      generateBundle() {
        // pnpm can install identical versions under different React peer sets.
        // A second context makes generated hooks unable to see the app provider.
        const contexts = [...this.getModuleIds()].filter((id) =>
          /\/@tanstack\/react-query\/build\/[^/]+\/QueryClientProvider\.js$/.test(id),
        );
        if (contexts.length !== 1) {
          this.error(`Expected one React Query context, found ${contexts.length}. Check resolve.dedupe.`);
        }
      },
    },
    tailwindcss({ optimize: false }),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    hmr: {
      path: '/vite-hmr',
    },
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
