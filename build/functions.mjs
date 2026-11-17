import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FUNCTIONS = join(ROOT, 'functions');
const MIGRATIONS = join(ROOT, 'migrations');
const DEV_VARS = join(ROOT, '.dev.vars');
const DATABASE = join(ROOT, '.dev.db');
const PORT = Number(process.env.FUNCTIONS_PORT) || 8788;
const RESEND = 'https://api.resend.com/emails';
const RETURNS_ROWS = /^\s*SELECT\b|\bRETURNING\b/i;
const HOP_HEADERS = ['host', 'connection', 'x-forwarded-for'];

if (existsSync(DEV_VARS)) process.loadEnvFile(DEV_VARS);

const sqlite = new DatabaseSync(DATABASE);

class Statement {
  constructor(sql, values = []) {
    this.sql = sql;
    this.values = values;
  }

  bind(...values) {
    return new Statement(this.sql, values);
  }

  execute() {
    const statement = sqlite.prepare(this.sql);
    if (RETURNS_ROWS.test(this.sql)) return { results: statement.all(...this.values), meta: { changes: 0 } };
    const { changes } = statement.run(...this.values);
    return { results: [], meta: { changes: Number(changes) } };
  }

  async run() {
    return this.execute();
  }

  async all() {
    return this.execute();
  }

  async first() {
    return this.execute().results[0] ?? null;
  }
}

const DB = {
  prepare: (sql) => new Statement(sql),
  async batch(statements) {
    sqlite.exec('BEGIN');
    try {
      const results = statements.map((s) => s.execute());
      sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  },
};

async function migrate() {
  sqlite.exec("CREATE TABLE IF NOT EXISTS d1_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))");
  const applied = new Set(sqlite.prepare('SELECT name FROM d1_migrations').all().map((r) => r.name));
  const pending = (await readdir(MIGRATIONS)).filter((f) => f.endsWith('.sql') && !applied.has(f)).sort();
  for (const name of pending) {
    sqlite.exec(await readFile(join(MIGRATIONS, name), 'utf8'));
    sqlite.prepare('INSERT INTO d1_migrations (name) VALUES (?)').run(name);
    console.log(`functions: applied ${name}`);
  }
}

const fetchOnline = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  if (String(input) !== RESEND || process.env.RESEND_API_KEY) return fetchOnline(input, init);
  const { to, subject, text } = JSON.parse(init.body);
  console.log(`\n✉ to ${to}: ${subject}\n\n${text}\n`);
  return Response.json({ id: 'printed-locally' });
};

const isRouteFile = (file) => file.endsWith('.js') && !file.split('/').some((part) => part.startsWith('_'));
const dynamicSegments = (route) => route.segments.filter((s) => s.startsWith('[')).length;

async function loadRoutes() {
  const files = (await readdir(FUNCTIONS, { recursive: true })).filter(isRouteFile);
  const routes = await Promise.all(
    files.map(async (file) => ({
      segments: file.replace(/\.js$/, '').split('/').filter((s) => s !== 'index'),
      module: await import(pathToFileURL(join(FUNCTIONS, file)).href),
    })),
  );
  return routes.sort((a, z) => dynamicSegments(a) - dynamicSegments(z));
}

function paramsFor(segments, parts) {
  const params = {};
  for (const [i, segment] of segments.entries()) {
    const rest = segment.match(/^\[\[(\w+)\]\]$/);
    if (rest) return { ...params, [rest[1]]: parts.slice(i) };
    const one = segment.match(/^\[(\w+)\]$/);
    if (one && parts[i] !== undefined) params[one[1]] = parts[i];
    else if (segment !== parts[i]) return null;
  }
  return segments.length === parts.length ? params : null;
}

const methodHandler = (module, method) => module[`onRequest${method[0]}${method.slice(1).toLowerCase()}`] ?? module.onRequest;

function requestOf(req) {
  const headers = Object.fromEntries(Object.entries(req.headers).filter(([name]) => !HOP_HEADERS.includes(name)));
  headers['cf-connecting-ip'] = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : Readable.toWeb(req);
  return new Request(new URL(req.url, `http://${req.headers.host}`), { method: req.method, headers, body, duplex: 'half' });
}

let routes;
async function respond(req) {
  routes ??= loadRoutes().catch((error) => {
    routes = null;
    throw error;
  });
  const parts = new URL(req.url, 'http://x').pathname.split('/').filter(Boolean);
  const route = (await routes).map((r) => ({ ...r, params: paramsFor(r.segments, parts) })).find((r) => r.params);
  const handler = route && methodHandler(route.module, req.method);
  if (!handler) return new Response(null, { status: route ? 405 : 404 });
  return handler({ request: requestOf(req), env: { ...process.env, DB }, params: route.params });
}

await migrate();
createServer(async (req, res) => {
  const response = await respond(req).catch((error) => {
    console.error(error);
    return new Response(null, { status: 500 });
  });
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(PORT, () => console.log(`functions → http://localhost:${PORT}/api/ (D1: .dev.db, env: .dev.vars)`));
