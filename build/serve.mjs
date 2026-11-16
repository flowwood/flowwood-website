import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { watch } from 'node:fs';
import { readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTENT_FILES, SCHEMA_FILES, checkSave, fromBase64 } from '../src/js/cms.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 8080;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.png': 'image/png', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg' };

const build = () => new Promise((res) => spawn(process.execPath, [join(ROOT, 'build/build.mjs')], { stdio: 'inherit', env: { ...process.env, ADMIN: '1' } }).on('exit', res));
const LOCAL_HEAD = 'local';

const readText = (path) => readFile(join(ROOT, path), 'utf8');
const json = (res, status, body) => res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(body));
const bodyOf = async (req) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

async function loadContent(res) {
  const paths = [...CONTENT_FILES, ...Object.values(SCHEMA_FILES)];
  json(res, 200, { head: LOCAL_HEAD, files: Object.fromEntries(await Promise.all(paths.map(async (p) => [p, await readText(p)]))) });
}

async function saveContent(req, res) {
  const { changes = {}, uploads = {}, deletions = [] } = await bodyOf(req);
  const bytes = Object.fromEntries(Object.entries(uploads).map(([path, b64]) => [path, fromBase64(b64)]));
  const schemas = Object.fromEntries(await Promise.all(Object.entries(SCHEMA_FILES).map(async ([file, schema]) => [file, JSON.parse(await readText(schema))])));
  const errors = checkSave({ changes, uploads: bytes, deletions }, schemas);
  if (errors.length) return json(res, 422, { errors });
  for (const [path, b] of Object.entries(bytes)) await writeFile(join(ROOT, path), b);
  for (const [path, text] of Object.entries(changes)) await writeFile(join(ROOT, path), text);
  for (const path of deletions) await rm(join(ROOT, path), { force: true });
  json(res, 200, { head: LOCAL_HEAD, commit: null });
}

async function serveMedia(res, name) {
  if (!/^[a-z0-9][a-z0-9._-]*\.(webp|jpg|svg)$/.test(name)) return res.writeHead(404).end();
  try {
    res.writeHead(200, { 'content-type': TYPES[extname(name)], 'cache-control': 'no-store' }).end(await readFile(join(ROOT, 'content/media', name)));
  } catch {
    res.writeHead(404).end();
  }
}

async function cmsApi(req, res, path) {
  if (path === '/api/cms' && req.method === 'GET') return loadContent(res);
  if (path === '/api/cms' && req.method === 'POST') return saveContent(req, res);
  if (path === '/api/cms/status') return json(res, 200, { state: 'local' });
  if (path.startsWith('/api/cms/media/')) return serveMedia(res, path.slice('/api/cms/media/'.length));
  res.writeHead(404).end();
}
await build();

let timer;
for (const dir of ['src', 'content']) {
  watch(join(ROOT, dir), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(build, 80);
  });
}

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.startsWith('/api/cms')) return cmsApi(req, res, path).catch((e) => json(res, 500, { errors: [e.message] }));
  if (path.endsWith('/')) path += 'index.html';
  let file = join(DIST, path);
  let status = 200;
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    await stat(file);
  } catch {
    status = 404;
    const locale = path.split('/')[1];
    file = join(DIST, locale && locale.length === 2 ? `${locale}/404.html` : '404.html');
  }
  try {
    const body = await readFile(file);
    res.writeHead(status, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(PORT, () => console.log(`→ http://localhost:${PORT}/`));
