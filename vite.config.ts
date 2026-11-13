import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

function resolveBasePath(): string {
  if (process.env.VITE_BASE_PATH) {
    return process.env.VITE_BASE_PATH;
  }
  // Automatically configure GitHub Pages subpath when built inside GitHub Actions
  if (process.env.GITHUB_ACTIONS && process.env.GITHUB_REPOSITORY) {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
    // User/organization root sites (<owner>.github.io) deploy at '/'
    if (repo && repo.toLowerCase() === `${owner.toLowerCase()}.github.io`) {
      return '/';
    }
    if (repo) {
      return `/${repo}/`;
    }
  }
  return '/';
}

const base = resolveBasePath();

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-icon.svg'],
      manifest: {
        name: 'KeyHop — Piano Sight-Reading',
        short_name: 'KeyHop',
        description:
          'Free, open-source piano sight-reading game with real-time microphone & MIDI recognition.',
        theme_color: '#1e1b4b',
        background_color: '#1e1b4b',
        display: 'fullscreen',
        orientation: 'any',
        start_url: base,
        scope: base,
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
});
