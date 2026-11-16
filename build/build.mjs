import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import { createI18n, LOCALE_STORAGE_KEY } from '../src/js/i18n.js';
import { createCatalog } from '../src/js/catalog.js';
import { layout } from '../src/layout.js';
import home from '../src/pages/home.js';
import shop from '../src/pages/shop.js';
import about from '../src/pages/about.js';
import cart from '../src/pages/cart.js';
import contact from '../src/pages/contact.js';
import notFound from '../src/pages/not-found.js';
import product from '../src/pages/product.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const DIST = process.env.DIST || join(ROOT, 'dist');
const BASE = (process.env.BASE_PATH || '').replace(/\/+$/, '');
const PAGES = [home, shop, about, cart, contact, product];
const PRERENDER_ONLY_PRODUCT_FIELDS = ['gallery', 'materials', 'care'];
const PRELOADED_FONTS = ['/fonts/jost.woff2', '/fonts/ibm-plex-sans.woff2'];
const IMMUTABLE_PATHS = ['/js/*', '/components/*', '/data/*', '/fonts/*', '/media/*'];
const posix = (p) => p.split(sep).join('/');
const hash = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 10);
const hashed = (url, h) => url.replace(/(\.[a-z0-9]+)$/i, `.${h}$1`);

const walk = async (dir) => (await readdir(dir, { recursive: true, withFileTypes: true })).filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));

const readJson = async (p) => JSON.parse(await readFile(join(ROOT, p), 'utf8'));

const site = await readJson('content/site.json');
const ORIGIN = (process.env.SITE_ORIGIN || site.origin).replace(/\/+$/, '');
const atBase = (path) => `${BASE}${path}`;
const withoutBase = (url) => url.slice(BASE.length);
const catalogData = await readJson('content/catalog.json');
const LOCALES = Object.keys(site.locales);

const hashedUrlOf = new Map();
const browserSourceOf = new Map();
const pageUrls = [];
const report = [];

function validateLocales(node, path) {
  if (Array.isArray(node)) return node.forEach((v, i) => validateLocales(v, `${path}[${i}]`));
  if (!node || typeof node !== 'object') return;
  const keys = Object.keys(node);
  const isTranslatable = keys.some((k) => LOCALES.includes(k));
  if (isTranslatable && !keys.every((k) => LOCALES.includes(k) || k.startsWith('$'))) return keys.forEach((k) => validateLocales(node[k], `${path}.${k}`));
  if (isTranslatable) {
    const missing = LOCALES.filter((l) => !(l in node));
    if (missing.length) throw new Error(`content: ${path} is missing locale(s) ${missing.join(', ')}`);
  }
  keys.forEach((k) => validateLocales(node[k], `${path}.${k}`));
}

function validateContent() {
  validateLocales(site.ui, 'site.ui');
  validateLocales(site.meta, 'site.meta');
  validateLocales(catalogData.products, 'catalog.products');
  validateLocales(catalogData.collections, 'catalog.collections');
  for (const page of PAGES) for (const l of LOCALES) if (site.routes[page.route]?.[l] == null) throw new Error(`content: route ${page.route} has no ${l} slug`);
  const ids = new Set(catalogData.products.map((p) => p.id));
  const refs = [...site.home.hero.products, ...site.home.collection.products, ...catalogData.collections.flatMap((c) => c.items.map((i) => i.product))];
  for (const r of refs) if (!ids.has(r)) throw new Error(`content: unknown product "${r}"`);
}

async function writeHashed(publicUrl, body) {
  const out = hashed(publicUrl, hash(body));
  await mkdir(dirname(join(DIST, out)), { recursive: true });
  await writeFile(join(DIST, out), body);
  hashedUrlOf.set(publicUrl, atBase(out));
  return out;
}

const emit = async (file, publicUrl) => writeHashed(publicUrl, await readFile(file));

async function hashStaticAssets() {
  for (const f of await walk(join(SRC, 'fonts'))) await emit(f, `/fonts/${posix(relative(join(SRC, 'fonts'), f))}`);
  for (const f of await walk(join(ROOT, 'content/media'))) await emit(f, `/media/${posix(relative(join(ROOT, 'content/media'), f))}`);
}

function withHashedMedia(node) {
  if (typeof node === 'string') return hashedUrlOf.get(node) || node;
  if (Array.isArray(node)) return node.map(withHashedMedia);
  if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, withHashedMedia(v)]));
  return node;
}

function localize(node, l) {
  if (Array.isArray(node)) return node.map((v) => localize(v, l));
  if (node && typeof node === 'object') {
    if (LOCALES.every((x) => x in node)) return node[l];
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, localize(v, l)]));
  }
  return node;
}

const withoutPrerenderOnlyFields = (p) => Object.fromEntries(Object.entries(p).filter(([k]) => !PRERENDER_ONLY_PRODUCT_FIELDS.includes(k)));

const emitModule = (publicUrl, value) => writeHashed(publicUrl, `export default ${JSON.stringify(value)};\n`);

async function emitDataModules() {
  await emitModule('/data/catalog.js', { ...catalogContent, products: catalogContent.products.map(withoutPrerenderOnlyFields) });
  for (const l of LOCALES) await emitModule(`/data/site.${l}.js`, { basePath: BASE, locales: content.locales, routes: content.routes, ui: localize(content.ui, l) });
}

const importsOf = (url) => [...(browserSourceOf.get(url) || '').matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)].map((m) => new URL(m[1], `http://x${url}`).pathname);

function importClosure(urls) {
  const seen = new Set();
  const visit = (u) => {
    if (seen.has(u) || !browserSourceOf.has(u)) return;
    seen.add(u);
    importsOf(u).forEach(visit);
  };
  urls.forEach(visit);
  return [...seen];
}

const isComponentEntry = (u) => /^\/components\/([a-z0-9-]+)\/\1\.js$/.test(u);

async function hashBrowserJs() {
  const sources = [...(await walk(join(SRC, 'js'))), ...(await walk(join(SRC, 'components')))].filter((f) => f.endsWith('.js'));
  for (const f of sources) browserSourceOf.set(`/${posix(relative(SRC, f))}`, await readFile(f, 'utf8'));
  const entries = ['/js/app.js', ...[...browserSourceOf.keys()].filter(isComponentEntry)];
  for (const u of importClosure(entries)) await emit(join(SRC, u), u);
}

const minifyCss = (css) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .replace(/url\((\/(?:fonts|media)\/[^)]+)\)/g, (m, u) => `url(${hashedUrlOf.get(u) || u})`)
    .trim();
const minifyHtml = (html) => html.replace(/>\s*\n\s*</g, '><').replace(/\n\s*/g, ' ');

const cssCache = new Map();
async function blockCss(block) {
  if (!cssCache.has(block)) {
    const file = block === 'base' ? join(SRC, 'css/base.css') : join(SRC, 'components', block, `${block}.css`);
    cssCache.set(block, existsSync(file) ? minifyCss(await readFile(file, 'utf8')) : '');
  }
  return cssCache.get(block);
}

const blocksIn = (html, page) => [...new Set([...html.matchAll(/data-component="([a-z0-9-]+)"/g)].map((m) => m[1]).concat(page.blocks || []))].sort();

async function inlineStyles(blocks) {
  const styles = [];
  for (const b of ['base', ...blocks]) {
    const css = await blockCss(b);
    if (css) styles.push(`<style data-block="${b}">${css}</style>`);
  }
  return styles;
}

const upgradedElementScripts = (html, blocks) => blocks.filter((b) => html.includes(`<fw-${b} `)).map((b) => `/components/${b}/${b}.js`).filter((u) => browserSourceOf.has(u));
const usesPageData = (scripts) => importClosure(scripts).some((u) => /\bpage\(\)/.test(browserSourceOf.get(u)) && !u.endsWith('/element.js'));
const idleDataModules = (scripts, locale) => (usesPageData(scripts) ? ['/data/catalog.js', `/data/site.${locale}.js`] : []);
const fontPreloads = () => PRELOADED_FONTS.map((f) => `<link rel="preload" href="${hashedUrlOf.get(f)}" as="font" type="font/woff2" crossorigin>`).join('');

async function headFor(html, page, locale) {
  const blocks = blocksIn(html, page);
  const scripts = upgradedElementScripts(html, blocks);
  return [
    ...(await inlineStyles(blocks)),
    `<script type="importmap">${importMap}</script>`,
    ...importClosure(['/js/app.js', ...scripts]).map((u) => `<link rel="modulepreload" href="${hashedUrlOf.get(u)}">`),
    ...idleDataModules(scripts, locale).map((u) => `<link rel="prefetch" href="${hashedUrlOf.get(u)}">`),
    `<script type="module" src="${hashedUrlOf.get('/js/app.js')}"></script>`,
  ].join('');
}

async function renderPage(page, locale, outFile, { path, item = '', alternates = true } = {}) {
  const i18n = createI18n(content, locale);
  const ctx = { site: content, catalog, i18n, locale, route: page.route, item, current: page.current ?? page.route };
  const shell = layout(ctx, page);
  const html = minifyHtml(
    shell
      .replace('<!--head-->', await headFor(shell, page, locale))
      .replace('<!--fonts-->', fontPreloads())
      .replace(/ data-path="[^"]*"/, ` data-path="${path}"`)
      .replace(/<link rel="alternate"[^>]*>/g, alternates ? '$&' : ''),
  );
  await mkdir(dirname(join(DIST, outFile)), { recursive: true });
  await writeFile(join(DIST, outFile), html);
  report.push([outFile, html.length, gzipSync(html).length]);
}

async function renderAllPages() {
  for (const locale of LOCALES) {
    const i18n = createI18n(content, locale);
    for (const page of PAGES) {
      const items = page.products ? page.products({ catalog }).map((p) => p.id) : [''];
      for (const item of items) {
        const url = i18n.url(page.route, locale, item);
        pageUrls.push(url);
        await renderPage(page, locale, `${withoutBase(url)}index.html`, { path: url, item });
      }
    }
    await renderPage(notFound, locale, `/${locale}/404.html`, { path: atBase(`/${locale}/404`), alternates: false });
  }
  await cp(join(DIST, `${site.defaultLocale}/404.html`), join(DIST, '404.html'));
}

async function writeRootRedirect() {
  const pattern = LOCALES.join('|');
  await writeFile(
    join(DIST, 'index.html'),
    `<!doctype html><html lang="${site.locales[site.defaultLocale].lang}"><head><meta charset="utf-8"><title>${site.name}</title><meta name="viewport" content="width=device-width,initial-scale=1">` +
      LOCALES.map((l) => `<link rel="alternate" hreflang="${site.locales[l].lang}" href="${ORIGIN}${atBase(`/${l}/`)}">`).join('') +
      `<script>var l;try{l=localStorage.getItem(${JSON.stringify(LOCALE_STORAGE_KEY)})}catch(e){}if(!/^(${pattern})$/.test(l||''))l='${site.defaultLocale}';location.replace(${JSON.stringify(atBase('/'))}+l+'/')</script>` +
      `<noscript><meta http-equiv="refresh" content="0;url=${atBase(`/${site.defaultLocale}/`)}"></noscript></head><body></body></html>`,
  );
}

async function writeServiceWorker() {
  const source = await readFile(join(SRC, 'sw.js'), 'utf8');
  const precache = [...pageUrls, ...hashedUrlOf.values()];
  const swVersion = hash(JSON.stringify(precache) + source);
  await writeFile(join(DIST, 'sw.js'), source.replace("'__VERSION__'", JSON.stringify(swVersion)).replace("'__PRECACHE__'", JSON.stringify(precache)));
  return swVersion;
}

async function writeHeaders() {
  const immutable = '  Cache-Control: public, max-age=31536000, immutable';
  await writeFile(
    join(DIST, '_headers'),
    [
      '/*',
      '  X-Content-Type-Options: nosniff',
      '  Referrer-Policy: strict-origin-when-cross-origin',
      ...IMMUTABLE_PATHS.flatMap((p) => [p, immutable]),
      '/sw.js',
      '  Cache-Control: no-cache',
      '',
    ].join('\n'),
  );
}

function printReport() {
  const pad = (s, n) => String(s).padStart(n);
  console.log('page'.padEnd(34), pad('bytes', 8), pad('gzip', 7));
  for (const [f, b, g] of report) console.log(f.padEnd(34), pad(b, 8), pad(g, 7));
  console.log(`\n${pageUrls.length} pages, ${hashedUrlOf.size} hashed assets, sw ${version}`);
}

validateContent();
await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });
await hashStaticAssets();
const content = { ...withHashedMedia(site), origin: ORIGIN, basePath: BASE };
const catalogContent = withHashedMedia(catalogData);
await emitDataModules();
await hashBrowserJs();
const importMap = JSON.stringify({ imports: Object.fromEntries([...hashedUrlOf].filter(([u]) => u.endsWith('.js')).map(([u, url]) => [atBase(u), url])) });
const catalog = createCatalog(catalogContent);
await renderAllPages();
await writeRootRedirect();
const version = await writeServiceWorker();
await writeHeaders();
printReport();
