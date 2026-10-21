import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { defineConfig } from 'vite';

/*
 * The Ampere web app (frontend/, React + Vite) is served under /app/ next to this landing page.
 *   dev      the app's Vite server runs as middleware inside this one (one process, one port).
 *   build    the app is built into dist/app once the landing page has been written.
 *   preview  /app/* page URLs fall back to the app's index.html (vercel.json does the same).
 */

const ROOT = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(ROOT, 'frontend');
const APP_BASE = '/app/';

function run(command) {
  const r = spawnSync(command, { cwd: APP_DIR, stdio: 'inherit', shell: true });
  if (r.status !== 0) throw new Error(`[app] "${command}" failed in frontend/`);
}

// Build tools are devDependencies; NODE_ENV=production (set during `vite build`) would skip them.
function ensureAppDeps() {
  if (existsSync(resolve(APP_DIR, 'node_modules'))) return;
  console.log('[app] Installing frontend dependencies…');
  run('npm ci --include=dev --no-audit --no-fund');
}

function freePort() {
  return new Promise((done, fail) => {
    const srv = createServer();
    srv.on('error', fail);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => done(port));
    });
  });
}

// App routes (not files or hashed assets) get the app shell, so deep links and reloads work.
function isAppPage(url = '') {
  const path = url.split('?')[0];
  return path === '/app' || (path.startsWith(APP_BASE) && !path.startsWith(`${APP_BASE}assets/`) && !path.includes('.'));
}

function ampereApp() {
  let command = 'serve';
  let outDir = 'dist';

  return {
    name: 'ampere-app',

    configResolved(config) {
      command = config.command;
      outDir = resolve(config.root, config.build.outDir);
    },

    // The app's own Vite dev server runs in middleware mode inside this one: a single process and port.
    async configureServer(server) {
      ensureAppDeps();
      const { createServer: createAppServer } = await import(pathToFileURL(resolve(APP_DIR, 'node_modules/vite/dist/node/index.js')).href);
      const app = await createAppServer({
        root: APP_DIR,
        base: APP_BASE,
        appType: 'spa',
        clearScreen: false,
        server: { middlewareMode: true, hmr: { port: await freePort() } },
      });
      server.httpServer?.once('close', () => app.close());

      server.middlewares.use((req, res, next) => {
        if (req.url !== '/app') return next();
        res.writeHead(302, { Location: APP_BASE }).end();
      });
      // Scoped to /app/: the app's SPA fallback would otherwise answer the landing page's URLs too.
      server.middlewares.use((req, res, next) => (req.url.startsWith(APP_BASE) ? app.middlewares(req, res, next) : next()));

      const printUrls = server.printUrls.bind(server);
      server.printUrls = () => {
        printUrls();
        const local = server.resolvedUrls?.local[0];
        if (local) server.config.logger.info(`  [32m➜[0m  [1mApp[0m:     [36m${new URL(APP_BASE, local)}[0m`);
      };
    },

    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (isAppPage(req.url)) req.url = `${APP_BASE}index.html`;
        next();
      });
    },

    closeBundle: {
      sequential: true,
      handler() {
        if (command !== 'build') return;
        ensureAppDeps();
        const out = relative(APP_DIR, resolve(outDir, APP_BASE.slice(1))).replaceAll('\\', '/');
        run(`npm run build -- --base ${APP_BASE} --outDir "${out}" --emptyOutDir`);
      },
    },
  };
}

export default defineConfig({
  // Only the landing page is scanned for dependencies; frontend/ has its own Vite project.
  optimizeDeps: { entries: ['index.html'] },
  plugins: [ampereApp()],
});
