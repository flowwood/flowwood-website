import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import { createI18n, LOCALE_STORAGE_KEY } from '../src/js/i18n.js';
import { createCatalog } from '../src/js/catalog.js';
import { createValidator } from '../src/js/schema.js';
import { MAX_IMAGE_EDGE } from '../src/js/cms.js';
import { layout } from '../src/layout.js';
import { readProducts } from './products.mjs';
import home from '../src/pages/home.js';
import shop from '../src/pages/shop.js';
import about from '../src/pages/about.js';
import cart from '../src/pages/cart.js';
import contact from '../src/pages/contact.js';
import checkout from '../src/pages/checkout.js';
import notFound from '../src/pages/not-found.js';
import product from '../src/pages/product.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const DIST = process.env.DIST || join(ROOT, 'dist');
const BASE = (process.env.BASE_PATH || '').replace(/\/+$/, '');
const PAGES = [home, shop, about, cart, contact, checkout, product];
const PRERENDER_ONLY_PRODUCT_FIELDS = ['gallery', 'materials', 'care', 'availability', 'related'];
const MEDIA = join(ROOT, 'content/media');
const PRELOADED_FONTS = ['/fonts/jost.woff2', '/fonts/ibm-plex-sans.woff2'];
const IMMUTABLE_PATHS = ['/js/*', '/components/*', '/data/*', '/fonts/*', '/media/*'];
const posix = (p) => p.split(sep).join('/');
const hash = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 10);
const hashed = (url, h) => url.replace(/(\.[a-z0-9]+)$/i, `.${h}$1`);

const walk = async (dir) => (await readdir(dir, { recursive: true, withFileTypes: true })).filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));

const readJson = async (p) => JSON.parse(await readFile(join(ROOT, p), 'utf8'));

const CLOUDFLARE_ENV = join(ROOT, '.cloudflare.env');
if (existsSync(CLOUDFLARE_ENV)) process.loadEnvFile(CLOUDFLARE_ENV);

const STOCK_DATABASE = 'flowwood';

async function d1(path, init = {}) {
  const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account } = process.env;
  if (!token || !account) throw new Error('stock: set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (or .cloudflare.env) to read stock from D1');
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const body = await response.json();
  if (!body.success) throw new Error(`stock: D1 ${response.status} ${body.errors.map((e) => e.message).join('; ')}`);
  return body.result;
}

const hasStockCredentials = () => Boolean(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID);
const NO_STOCK = new Map();

async function readStock() {
  if (!hasStockCredentials() && !process.env.CI) {
    console.warn('stock: no Cloudflare credentials, building with every product made to order (local only, CI fails)');
    return NO_STOCK;
  }
  const database = (await d1(`?name=${STOCK_DATABASE}`)).find((db) => db.name === STOCK_DATABASE);
  if (!database) throw new Error(`stock: no D1 database named "${STOCK_DATABASE}"`);
  const [{ results }] = await d1(`/${database.uuid}/query`, { method: 'POST', body: JSON.stringify({ sql: 'SELECT product, quantity FROM stock' }) });
  return new Map(results.map((r) => [r.product, r.quantity]));
}

function withStock(catalog, stock) {
  const ids = new Set(catalog.products.map((p) => p.id));
  const unknown = [...stock.keys()].filter((id) => !ids.has(id));
  if (unknown.length) throw new Error(`stock: row(s) for unknown product(s) ${unknown.join(', ')}`);
  return { ...catalog, products: catalog.products.map((p) => ({ ...p, stock: stock.get(p.id) ?? null })) };
}

const site = await readJson('content/site.json');
const ORIGIN = (process.env.SITE_ORIGIN || site.origin).replace(/\/+$/, '');
const atBase = (path) => `${BASE}${path}`;
const withoutBase = (url) => url.slice(BASE.length);
const catalogSource = await readJson('content/catalog.json');
const LOCALES = Object.keys(site.locales);

async function mediaImage(file, position) {
  const src = `/media/${file}`;
  return { src, ...(await imageSize(src)), ...(position && { position }) };
}

async function resolveImage({ file, position, thumbnail }) {
  const image = await mediaImage(file, position);
  return thumbnail ? { ...image, thumbnail: await mediaImage(thumbnail, position) } : image;
}

async function withResolvedImages(catalog) {
  const resolveProduct = async (p) => ({
    ...p,
    image: await resolveImage(p.image),
    ...(p.altImage && { altImage: await resolveImage(p.altImage) }),
    ...(p.gallery && { gallery: await Promise.all(p.gallery.map(resolveImage)) }),
  });
  return { ...catalog, products: await Promise.all(catalog.products.map(resolveProduct)) };
}

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

async function validateSchemas() {
  for (const [name, data] of [['site', site], ['catalog', catalogSource]]) {
    const errors = createValidator(await readJson(`content/schema/${name}.schema.json`))(data);
    if (errors.length) throw new Error(`content: ${name}.json\n  ${errors.join('\n  ')}`);
  }
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

async function writeHashed(publicUrl, body, urls = hashedUrlOf) {
  const out = hashed(publicUrl, hash(body));
  await mkdir(dirname(join(DIST, out)), { recursive: true });
  await writeFile(join(DIST, out), body);
  urls.set(publicUrl, atBase(out));
  return out;
}

const emit = async (file, publicUrl) => writeHashed(publicUrl, await readFile(file));

const isMediaImage = (node) => node && typeof node === 'object' && typeof node.src === 'string' && node.src.startsWith('/media/');

function mediaImages(node, found = []) {
  if (isMediaImage(node)) found.push(node);
  if (node && typeof node === 'object') Object.values(node).forEach((v) => mediaImages(v, found));
  return found;
}

function webpSize(buf) {
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
}

const isJpegFrame = (marker) => marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);

function jpegSize(buf) {
  for (let at = 2; at + 9 < buf.length; at += 2 + buf.readUInt16BE(at + 2)) {
    if (buf[at] !== 0xff) return;
    if (isJpegFrame(buf[at + 1])) return { height: buf.readUInt16BE(at + 5), width: buf.readUInt16BE(at + 7) };
  }
}

function svgSize(text) {
  const box = text.match(/<svg[^>]*\sviewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/);
  if (box) return { width: Math.round(+box[1]), height: Math.round(+box[2]) };
}

async function imageSize(src) {
  const buf = await readFile(join(ROOT, 'content', src));
  const size = src.endsWith('.webp') ? webpSize(buf) : src.endsWith('.jpg') ? jpegSize(buf) : svgSize(buf.toString('utf8'));
  if (!size) throw new Error(`content: ${src} is not a readable ${src.split('.').pop()} image`);
  if (!src.endsWith('.svg') && Math.max(size.width, size.height) > MAX_IMAGE_EDGE) throw new Error(`content: ${src} is ${size.width}×${size.height}, over ${MAX_IMAGE_EDGE}px`);
  return size;
}

async function measureMedia(images) {
  const sizes = new Map();
  for (const src of new Set(images.map((i) => i.src))) sizes.set(src, await imageSize(src));
  for (const image of images) Object.assign(image, sizes.get(image.src));
  return [...sizes.keys()];
}

const catalogData = await withResolvedImages({ ...catalogSource, products: await readProducts(ROOT) });

async function hashStaticAssets() {
  for (const f of await walk(join(SRC, 'fonts'))) await emit(f, `/fonts/${posix(relative(join(SRC, 'fonts'), f))}`);
  const used = await measureMedia(mediaImages([site, catalogData]));
  for (const src of used) await emit(join(ROOT, 'content', src), src);
  const unused = (await walk(MEDIA)).map((f) => `/media/${posix(relative(MEDIA, f))}`).filter((u) => !used.includes(u));
  if (unused.length) console.warn(`unused media (not shipped): ${unused.join(', ')}`);
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
  const sources = [...(await walk(join(SRC, 'js'))), ...(await walk(join(SRC, 'components'))), ...(await walk(join(SRC, 'admin')))].filter((f) => f.endsWith('.js'));
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
  const assets = [...hashedUrlOf.values()];
  const swVersion = hash(JSON.stringify([pageUrls, assets]) + source);
  await writeFile(
    join(DIST, 'sw.js'),
    source.replace("'__VERSION__'", JSON.stringify(swVersion)).replace("'__PAGES__'", JSON.stringify(pageUrls)).replace("'__ASSETS__'", JSON.stringify(assets)),
  );
  return swVersion;
}

async function writeHeaders(adminCsp) {
  const immutable = '  Cache-Control: public, max-age=31536000, immutable';
  const admin = adminCsp ? ['/admin/*', '  Cache-Control: no-store', '  X-Robots-Tag: noindex', `  Content-Security-Policy: ${adminCsp}`] : [];
  await writeFile(
    join(DIST, '_headers'),
    [
      '/*',
      '  X-Content-Type-Options: nosniff',
      '  Referrer-Policy: strict-origin-when-cross-origin',
      ...IMMUTABLE_PATHS.flatMap((p) => [p, immutable]),
      '/sw.js',
      '  Cache-Control: no-cache',
      ...admin,
      '',
    ].join('\n'),
  );
}

const cspHash = (text) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;

async function emitAdmin() {
  const adminUrlOf = new Map();
  for (const u of importClosure(['/admin/admin.js'])) if (!hashedUrlOf.has(u)) await writeHashed(u, await readFile(join(SRC, u)), adminUrlOf);
  const urls = new Map([...hashedUrlOf, ...adminUrlOf]);
  const map = JSON.stringify({ imports: Object.fromEntries([...urls].filter(([u]) => u.endsWith('.js')).map(([u, url]) => [atBase(u), url])) });
  const css = (await blockCss('base')) + minifyCss(await readFile(join(SRC, 'admin/admin.css'), 'utf8'));
  const head = `<style>${css}</style><script type="importmap">${map}</script><script type="module" src="${urls.get('/admin/admin.js')}"></script>`;
  const html = (await readFile(join(SRC, 'admin/index.html'), 'utf8')).replace('<!--head-->', head);
  await mkdir(join(DIST, 'admin'), { recursive: true });
  await writeFile(join(DIST, 'admin/index.html'), html);
  return `default-src 'self'; script-src 'self' ${cspHash(map)}; style-src 'self' ${cspHash(css)}; img-src 'self' blob: https:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`;
}

function printReport() {
  const pad = (s, n) => String(s).padStart(n);
  console.log('page'.padEnd(34), pad('bytes', 8), pad('gzip', 7));
  for (const [f, b, g] of report) console.log(f.padEnd(34), pad(b, 8), pad(g, 7));
  console.log(`\n${pageUrls.length} pages, ${hashedUrlOf.size} hashed assets, sw ${version}`);
}

await validateSchemas();
validateContent();
await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });
await hashStaticAssets();
const content = { ...withHashedMedia(site), origin: ORIGIN, basePath: BASE };
const catalogContent = withHashedMedia(withStock(catalogData, await readStock()));
await emitDataModules();
await hashBrowserJs();
const importMap = JSON.stringify({ imports: Object.fromEntries([...hashedUrlOf].filter(([u]) => u.endsWith('.js')).map(([u, url]) => [atBase(u), url])) });
const catalog = createCatalog(catalogContent);
await renderAllPages();
await writeRootRedirect();
const version = await writeServiceWorker();
const adminCsp = process.env.ADMIN ? await emitAdmin() : null;
await writeHeaders(adminCsp);
printReport();
