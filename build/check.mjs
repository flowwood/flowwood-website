import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = process.env.DIST || join(ROOT, 'dist');
const BASE = (process.env.BASE_PATH || '').replace(/\/+$/, '');
const fileOf = (url) => join(DIST, url.startsWith(`${BASE}/`) ? url.slice(BASE.length) : url);
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LOCALE_LINK = new RegExp(`\\shref="(${escapeRegExp(BASE)}/[a-z]{2}/[^"#]*)`, 'g');
const audit = new Function(`return (\n${await readFile(join(ROOT, 'build/dom-audit.js'), 'utf8')}\n)`)();
const site = JSON.parse(await readFile(join(ROOT, 'content/site.json'), 'utf8'));
const LOCALES = Object.keys(site.locales);

const GZIP_BUDGET = { html: 24_000, firstPartyJs: 30_000, font: 45_000, image: 60_000 };

const walk = async (dir) => (await readdir(dir, { recursive: true, withFileTypes: true })).filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));

const problems = [];
const files = await walk(DIST);
const pages = files.filter((f) => f.endsWith('.html') && f !== join(DIST, 'index.html'));

for (const file of pages) {
  const rel = file.slice(DIST.length);
  const html = await readFile(file, 'utf8');
  const fail = (m) => problems.push(`${rel}: ${m}`);
  const body = html.slice(html.indexOf('<body'), html.lastIndexOf('</body>'));
  const elements = [...body.matchAll(/<([a-z][a-z0-9-]*)(\s[^>]*)?>/g)].map(([, tag, attrs = '']) => {
    const a = (n) => attrs.match(new RegExp(`\\s${n}="([^"]*)"`))?.[1];
    return { tag, id: a('id'), component: a('data-component'), cls: a('class') || '' };
  });
  audit(elements).forEach(fail);

  const locale = html.match(/<html[^>]*data-locale="([a-z]+)"/)?.[1];
  if (!LOCALES.includes(locale)) fail('missing data-locale');
  if (!/<title>[^<]+<\/title>/.test(html)) fail('missing <title>');
  if (!/<meta name="description" content="[^"]+"/.test(html)) fail('missing meta description');
  const h1 = (body.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) fail(`expected exactly one <h1>, found ${h1}`);
  if (!rel.endsWith('404.html')) {
    const alternates = (html.match(/<link rel="alternate" hreflang=/g) || []).length;
    if (alternates !== LOCALES.length + 1) fail(`expected ${LOCALES.length + 1} hreflang alternates, found ${alternates}`);
    if (!/<link rel="canonical"/.test(html)) fail('missing canonical');
  }
  for (const m of body.matchAll(/<img\s[^>]*>/g)) if (!/\swidth="\d+"/.test(m[0]) || !/\sheight="\d+"/.test(m[0]) || !/\salt="/.test(m[0])) fail(`img without width/height/alt: ${m[0].slice(0, 120)}`);
  const gz = gzipSync(html).length;
  if (gz > GZIP_BUDGET.html) fail(`HTML ${gz} B gzip > budget ${GZIP_BUDGET.html}`);
  const preloaded = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)"/g)].map((m) => m[1]);
  let js = 0;
  for (const u of preloaded) js += gzipSync(await readFile(fileOf(u))).length;
  if (js > GZIP_BUDGET.firstPartyJs) fail(`preloaded JS ${js} B gzip > budget ${GZIP_BUDGET.firstPartyJs}`);
  for (const m of html.matchAll(/\s(?:src|href)="(\/[^"#?]*)"/g)) {
    const u = m[1];
    if (u.endsWith('/') || u.startsWith('/#')) continue;
    try {
      await stat(fileOf(u));
    } catch {
      fail(`broken reference ${u}`);
    }
  }
  for (const m of body.matchAll(LOCALE_LINK)) {
    try {
      await stat(join(fileOf(m[1]), 'index.html'));
    } catch {
      fail(`broken link ${m[1]}`);
    }
  }
}

for (const f of files) {
  const gz = gzipSync(await readFile(f)).length;
  if (f.includes('/fonts/') && gz > GZIP_BUDGET.font) problems.push(`${f.slice(DIST.length)}: font ${gz} B > ${GZIP_BUDGET.font}`);
  if (f.includes('/media/') && gz > GZIP_BUDGET.image) problems.push(`${f.slice(DIST.length)}: image ${gz} B > ${GZIP_BUDGET.image}`);
}

const commentPattern = (file) => (file.endsWith('.css') ? /\/\*/ : /(^|\s)\/[/*]/);
for (const dir of ['src', 'build', 'functions']) {
  for (const file of (await walk(join(ROOT, dir))).filter((f) => /\.(m?js|css)$/.test(f))) {
    const pattern = commentPattern(file);
    (await readFile(file, 'utf8')).split('\n').forEach((line, i) => pattern.test(line) && problems.push(`${file.slice(ROOT.length + 1)}:${i + 1}: comment`));
  }
}

if (problems.length) {
  console.error(`✗ ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ ${pages.length} pages clean (naming, metadata, budget, no comments)`);
