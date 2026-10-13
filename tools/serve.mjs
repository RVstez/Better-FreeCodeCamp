#!/usr/bin/env node
// Local static server for Better-FreeCodeCamp.
// Usage: node tools/serve.mjs [port]      (default port: 8080)
// Env:   PORT=8081 HOST=0.0.0.0 node tools/serve.mjs

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSw } from './build-sw.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');

// Serve ./public if it exists, otherwise the project root (flat layout).
const publicDir = path.join(projectRoot, 'public');
const root = fs.existsSync(path.join(publicDir, 'index.html')) ? publicDir : projectRoot;

const port = Number(process.argv[2] || process.env.PORT || 8080);
const host = process.env.HOST || '127.0.0.1';

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`Invalid port: ${process.argv[2] || process.env.PORT}`);
  process.exit(1);
}
if (!fs.existsSync(path.join(root, 'index.html'))) {
  console.error(`index.html not found in ${root}.`);
  console.error('Run this from a full copy of the project (the folder containing public/ and tools/).');
  process.exit(1);
}

// Regenerate sw.js so the offline cache matches the files on disk.
try {
  const { changed, version, count } = buildSw(root);
  console.log(`sw.js ${changed ? 'regenerated' : 'up to date'} (version ${version}, ${count} files)`);
} catch (err) {
  console.warn(`Could not regenerate sw.js: ${err.message}`);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

// Map a request URL to a file inside `root`, or null if unsafe/missing.
function resolveFile(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;

  const candidate = path.normalize(path.join(root, decoded));
  // Block path traversal.
  if (candidate !== root && !candidate.startsWith(root + path.sep)) return null;

  let target = candidate;
  try {
    if (fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
    return fs.statSync(target).isFile() ? target : null;
  } catch {
    return null;
  }
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
  }

  const { pathname } = new URL(req.url, 'http://localhost');
  let file = resolveFile(pathname);

  // Extensionless unknown paths fall back to the app shell.
  if (!file && !path.extname(pathname)) file = resolveFile('/');
  if (!file) return send(res, 404, 'Not found');

  const ext = path.extname(file).toLowerCase();
  const name = path.basename(file);
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
  };

  // Always revalidate the shell and the service worker so updates are picked up.
  if (name === 'sw.js') {
    headers['Cache-Control'] = 'no-cache';
    headers['Service-Worker-Allowed'] = '/';
  } else if (ext === '.html') {
    headers['Cache-Control'] = 'no-cache';
  }

  fs.stat(file, (err, stat) => {
    if (err) return send(res, 404, 'Not found');
    headers['Content-Length'] = stat.size;
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    const stream = fs.createReadStream(file);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Try: node tools/serve.mjs ${port + 1}`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`Better-FreeCodeCamp serving ${path.relative(process.cwd(), root) || '.'}`);
  console.log(`Open http://localhost:${port}`);
});
