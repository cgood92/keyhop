import fs from 'node:fs';
import type { IncomingMessage } from 'node:http';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

function sanitizeId(raw: string | undefined): string {
  const cleaned = (raw ?? 'unknown').replace(/[^a-zA-Z0-9_.-]+/g, '_');
  return cleaned || 'unknown';
}

function readRequestBuffer(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function debugTelemetryPlugin(logDir: string | undefined): Plugin | null {
  if (!logDir) return null;
  fs.mkdirSync(logDir, { recursive: true });

  return {
    name: 'keyhop-debug-telemetry',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url ?? '';
        if (!rawUrl.startsWith('/__debug/')) {
          return next();
        }

        const parsedUrl = new URL(rawUrl, 'https://localhost');
        const pathname = parsedUrl.pathname;

        const sendJson = (status: number, payload: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(payload));
        };

        try {
          if (req.method === 'GET' && pathname === '/__debug/ping') {
            return sendJson(200, { ok: true, logDir });
          }

          if (req.method === 'POST' && pathname === '/__debug/session') {
            const body = await readRequestBuffer(req);
            const data = JSON.parse(body.toString('utf8')) as Record<string, unknown>;
            const sessionId = sanitizeId(
              typeof data.sessionId === 'string' ? data.sessionId : undefined
            );
            const sessionDir = path.join(logDir, sessionId);
            fs.mkdirSync(sessionDir, { recursive: true });
            const metaPath = path.join(sessionDir, 'meta.json');
            let existing: Record<string, unknown> = {};
            if (fs.existsSync(metaPath)) {
              existing = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as Record<
                string,
                unknown
              >;
            }
            const merged = { ...existing, ...data, updatedAtIso: new Date().toISOString() };
            fs.writeFileSync(metaPath, JSON.stringify(merged, null, 2));
            return sendJson(200, { ok: true, sessionId });
          }

          if (req.method === 'POST' && pathname === '/__debug/events') {
            const sessionId = sanitizeId(parsedUrl.searchParams.get('sessionId') ?? undefined);
            const sessionDir = path.join(logDir, sessionId);
            fs.mkdirSync(sessionDir, { recursive: true });
            const body = await readRequestBuffer(req);
            fs.appendFileSync(path.join(sessionDir, 'events.ndjson'), body);
            return sendJson(200, { ok: true, bytes: body.byteLength });
          }

          if (req.method === 'POST' && pathname === '/__debug/audio-raw') {
            const sessionId = sanitizeId(parsedUrl.searchParams.get('sessionId') ?? undefined);
            const sampleRate = Number(parsedUrl.searchParams.get('sampleRate') ?? '48000');
            const sessionDir = path.join(logDir, sessionId);
            fs.mkdirSync(sessionDir, { recursive: true });
            const fmtPath = path.join(sessionDir, 'audio_format.json');
            if (!fs.existsSync(fmtPath)) {
              fs.writeFileSync(
                fmtPath,
                JSON.stringify({ sampleRate, channels: 1, encoding: 'int16_le' }, null, 2)
              );
            }
            const body = await readRequestBuffer(req);
            fs.appendFileSync(path.join(sessionDir, 'raw_mic.pcm'), body);
            return sendJson(200, { ok: true, bytes: body.byteLength });
          }

          if (req.method === 'POST' && pathname === '/__debug/snapshot') {
            const body = await readRequestBuffer(req);
            const data = JSON.parse(body.toString('utf8')) as Record<string, unknown>;
            const sessionId = sanitizeId(
              typeof data.sessionId === 'string' ? data.sessionId : undefined
            );
            const reason = sanitizeId(
              typeof data.reason === 'string' ? data.reason : 'snap'
            );
            const snapDir = path.join(logDir, sessionId, 'snapshots');
            fs.mkdirSync(snapDir, { recursive: true });
            const fileName = `${Date.now()}_${reason}.json`;
            fs.writeFileSync(path.join(snapDir, fileName), body);
            return sendJson(200, { ok: true, fileName });
          }

          return sendJson(404, { error: 'Unknown debug endpoint' });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Debug endpoint error';
          return sendJson(500, { error: msg });
        }
      });
    },
  };
}

function resolveHttpsConfig(): { cert: Buffer; key: Buffer } | undefined {
  const certPath = process.env.VITE_DEBUG_CERT;
  const keyPath = process.env.VITE_DEBUG_KEY;
  if (certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    return {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    };
  }
  return undefined;
}

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
const httpsConfig = resolveHttpsConfig();
const debugPlugin = debugTelemetryPlugin(process.env.VITE_DEBUG_LOG_DIR);

export default defineConfig({
  base,
  server: {
    host: process.env.VITE_DEBUG_MODE === '1' ? true : undefined,
    https: httpsConfig,
  },
  plugins: [
    ...(debugPlugin ? [debugPlugin] : []),
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
