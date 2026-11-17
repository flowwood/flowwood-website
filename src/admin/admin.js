import { esc } from '../js/bem.js';
import { CONTENT_FILES, MAX_IMAGE_EDGE, MEDIA_BUDGET, canonical, checkSave, mediaSources, toBase64 } from '../js/cms.js';

const API = new URL('../api/cms', location.href).href;
const SITE = 'content/site.json';
const CATALOG = 'content/catalog.json';
const LOCALES = ['nl', 'en'];
const STATUS_POLL_MS = 5000;

const SECTIONS = [
  { id: 'products', label: 'Producten', file: CATALOG, path: ['products'] },
  { id: 'collections', label: 'Collecties', file: CATALOG, path: ['collections'] },
  { id: 'delivery', label: 'Levering', file: CATALOG, path: ['delivery'] },
  { id: 'custom-size', label: 'Maatwerk', file: CATALOG, path: ['customSize'] },
  { id: 'home', label: 'Startpagina', file: SITE, path: ['home'] },
  { id: 'shop', label: 'Winkel', file: SITE, path: ['shop'] },
  { id: 'meta', label: 'Paginatitels', file: SITE, path: ['meta'] },
  { id: 'contact', label: 'Contact en bedrijfsgegevens', file: SITE, path: ['contact'] },
  { id: 'legal', label: 'Voorwaarden en privacy', file: SITE, path: ['legal'] },
  { id: 'ui', label: 'Teksten', file: SITE, path: ['ui'] },
];

const LABELS = {
  id: 'Id (in URL’s en verwijzingen)',
  name: 'Naam',
  tone: 'Toon van de foto (linksonder)',
  image: 'Foto',
  altImage: 'Tweede foto',
  summary: 'Korte omschrijving',
  description: 'Omschrijving',
  dimensions: 'Afmetingen',
  sizing: 'Maten',
  shape: 'Vorm',
  heights: 'Hoogtes (cm, komma’s ertussen)',
  width: 'Breedte (cm)',
  pricing: 'Prijs',
  base: 'Basisprijs (€)',
  perSizeStep: 'Meerprijs per maat (€)',
  fixed: 'Prijs (€)',
  finishes: 'Afwerkingen',
  color: 'Staalkleur',
  items: 'Producten',
  product: 'Product (id)',
  finish: 'Afwerking (id)',
  height: 'Hoogte (cm)',
  position: 'Uitsnede (bv. 50% 60%)',
  title: 'Titel',
  price: 'Prijs (€)',
  weeks: 'Levertijd (weken, van, tot)',
  countries: 'Landen',
  products: 'Producten (id’s, komma’s ertussen)',
};

const state = { head: null, schemas: {}, original: {}, docs: {}, uploads: {}, previews: {}, section: SECTIONS[0].id, open: new Set(), busy: false };

const $ = (s) => document.querySelector(s);
const humanize = (key) => String(key).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
const labelOf = (key) => LABELS[key] || humanize(key);
const isLocalized = (v) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === LOCALES.length && LOCALES.every((l) => l in v);
const isImage = (v) => v && typeof v === 'object' && !Array.isArray(v) && 'src' in v;
const isPrimitive = (v) => v === null || typeof v !== 'object';
const encodePath = (path) => esc(JSON.stringify(path));
const sectionOf = (id) => SECTIONS.find((s) => s.id === id);

function getAt(node, path) {
  return path.reduce((o, k) => o?.[k], node);
}

function setAt(node, path, value) {
  const parent = getAt(node, path.slice(0, -1));
  parent[path[path.length - 1]] = value;
}

function schemaAt(root, path) {
  const resolve = (s) => (s?.$ref ? resolve(s.$ref.slice(2).split('/').reduce((o, k) => o[k], root)) : s);
  return path.reduce((s, k) => {
    const r = resolve(s);
    if (!r) return undefined;
    if (typeof k === 'number') return r.items;
    return r.properties?.[k] ?? (typeof r.additionalProperties === 'object' ? r.additionalProperties : undefined);
  }, root);
}

function resolvedSchema(file, path) {
  const root = state.schemas[file];
  let s = schemaAt(root, path);
  while (s?.$ref) s = s.$ref.slice(2).split('/').reduce((o, k) => o[k], root);
  return s || {};
}

const dirtyFiles = () => CONTENT_FILES.filter((f) => canonical(state.docs[f]) !== state.original[f]);
const isDirty = () => dirtyFiles().length > 0;

function setStatus(text) {
  $('.admin__status').textContent = text;
}

function refreshSave() {
  $('.admin__save').disabled = state.busy || !isDirty();
}

async function api(path = '', init) {
  const response = await fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function load() {
  const { status, body } = await api();
  if (status !== 200) throw new Error(body.errors?.join(', ') || `HTTP ${status}`);
  state.head = body.head;
  for (const f of CONTENT_FILES) {
    state.original[f] = body.files[f];
    state.docs[f] = JSON.parse(body.files[f]);
  }
  for (const [file, schema] of Object.entries({ [SITE]: 'content/schema/site.schema.json', [CATALOG]: 'content/schema/catalog.schema.json' })) state.schemas[file] = JSON.parse(body.files[schema]);
}

function renderNav() {
  $('.admin__nav').innerHTML = SECTIONS.map(
    (s) => `<button class="admin__tab hit" type="button" data-section="${s.id}" aria-current="${s.id === state.section}">${esc(s.label)}</button>`,
  ).join('');
}

function field(label, control, hint) {
  return `<label class="admin__field"><span class="admin__label">${esc(label)}</span>${control}${hint ? `<span class="admin__hint">${esc(hint)}</span>` : ''}</label>`;
}

function textControl(value, path, schema) {
  const attrs = `class="admin__input" data-path="${encodePath(path)}"${schema.pattern ? ` pattern="${esc(schema.pattern)}"` : ''}`;
  if (schema.enum) return `<select ${attrs} data-kind="text">${schema.enum.map((o) => `<option${o === value ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  if (String(value).length > 70 || String(value).includes('\n')) return `<textarea ${attrs} data-kind="text" rows="${Math.min(8, Math.ceil(String(value).length / 70) + 1)}">${esc(value)}</textarea>`;
  return `<input ${attrs} data-kind="text" value="${esc(value)}">`;
}

function primitive(key, value, path, file) {
  const schema = resolvedSchema(file, path);
  if (typeof value === 'boolean') return field(labelOf(key), `<input type="checkbox" data-path="${encodePath(path)}" data-kind="boolean"${value ? ' checked' : ''}>`);
  if (typeof value === 'number') return field(labelOf(key), `<input class="admin__input" type="number" step="any" data-path="${encodePath(path)}" data-kind="number" value="${value}">`, schema.description);
  return field(labelOf(key), textControl(value ?? '', path, schema), schema.description);
}

function localized(key, value, path) {
  const isList = Array.isArray(value[LOCALES[0]]);
  const control = (l) => {
    const text = isList ? value[l].join('\n') : value[l];
    const kind = isList ? 'lines' : 'text';
    const rows = Math.min(8, Math.ceil(String(text).length / 50) + (isList ? value[l].length : 1));
    return `<textarea class="admin__input" data-path="${encodePath([...path, l])}" data-kind="${kind}" rows="${rows}" lang="${l}">${esc(text)}</textarea>`;
  };
  const hint = isList ? 'Eén stuk per regel.' : '';
  return `<div class="admin__field"><span class="admin__label">${esc(labelOf(key))}</span><div class="admin__pair">${LOCALES.map((l) => field(l.toUpperCase(), control(l))).join('')}</div>${hint ? `<span class="admin__hint">${hint}</span>` : ''}</div>`;
}

function previewOf(src) {
  if (state.previews[src]) return state.previews[src];
  if (src.startsWith('/media/')) return `${API}/media/${src.slice('/media/'.length)}`;
  return src;
}

function image(key, value, path) {
  const preview = value.src ? `<img class="admin__preview" src="${esc(previewOf(value.src))}" alt="">` : '<div class="admin__preview"></div>';
  const position = 'position' in value ? field(labelOf('position'), `<input class="admin__input" data-path="${encodePath([...path, 'position'])}" data-kind="text" value="${esc(value.position)}">`) : '';
  return `<fieldset class="admin__group"><legend class="admin__legend">${esc(labelOf(key))}</legend><div class="admin__image">${preview}<div class="admin__image-fields">
    ${field('Nieuwe foto', `<input type="file" accept="image/*" data-upload="${encodePath(path)}">`, 'Wordt automatisch verkleind en gecomprimeerd.')}
    <span class="admin__hint">${esc(value.src || 'Nog geen foto')}</span>
    ${position}
  </div></div></fieldset>`;
}

function primitiveList(key, value, path, file) {
  const schema = resolvedSchema(file, [...path, 0]);
  const kind = schema.type === 'integer' || schema.type === 'number' || typeof value[0] === 'number' ? 'numbers' : 'words';
  return field(labelOf(key), `<input class="admin__input" data-path="${encodePath(path)}" data-kind="${kind}" value="${esc(value.join(', '))}">`, schema.description);
}

function itemTitle(item, i) {
  const name = typeof item.name === 'string' ? item.name : isLocalized(item.name) ? item.name.nl : '';
  return [name, item.id].filter(Boolean).join(' · ') || `#${i + 1}`;
}

function objectList(key, value, path, file) {
  const id = JSON.stringify(path);
  const items = value
    .map((item, i) => {
      const itemPath = [...path, i];
      const open = state.open.has(JSON.stringify(itemPath)) ? ' open' : '';
      const move = (dir, disabled, label, glyph) => `<button class="admin__icon" type="button" data-move="${dir}" data-list="${esc(id)}" data-index="${i}" aria-label="${label}"${disabled ? ' disabled' : ''}>${glyph}</button>`;
      return `<details class="admin__item" data-item="${encodePath(itemPath)}"${open}><summary class="admin__summary"><span class="admin__summary-text">${esc(itemTitle(item, i))}</span>
        ${move(-1, i === 0, 'Omhoog', '↑')}${move(1, i === value.length - 1, 'Omlaag', '↓')}
        <button class="admin__icon" type="button" data-remove data-list="${esc(id)}" data-index="${i}" aria-label="Verwijderen">×</button></summary>
        <div class="admin__item-body">${fields(item, itemPath, file)}</div></details>`;
    })
    .join('');
  return `<fieldset class="admin__group"><legend class="admin__legend">${esc(labelOf(key))}</legend>${items}
    <button class="admin__add button button--outline button--small" type="button" data-add data-list="${esc(id)}">+ Toevoegen</button></fieldset>`;
}

function node(key, value, path, file) {
  if (isLocalized(value)) return localized(key, value, path);
  if (isImage(value)) return image(key, value, path);
  if (isPrimitive(value)) return primitive(key, value, path, file);
  if (Array.isArray(value)) return value.every(isPrimitive) ? primitiveList(key, value, path, file) : objectList(key, value, path, file);
  return `<fieldset class="admin__group"><legend class="admin__legend">${esc(labelOf(key))}</legend>${fields(value, path, file)}</fieldset>`;
}

function fields(obj, path, file) {
  return Object.entries(obj)
    .filter(([k]) => !k.startsWith('$'))
    .map(([k, v]) => node(k, v, [...path, k], file))
    .join('');
}

function renderErrors(errors) {
  return errors.length ? `<div class="admin__errors" role="alert"><strong>Nog niet opslaan:</strong><ul>${errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : '';
}

function renderMain(errors = []) {
  const s = sectionOf(state.section);
  const value = getAt(state.docs[s.file], s.path);
  $('.admin__main').innerHTML = renderErrors(errors) + node(s.label, value, s.path, s.file);
}

function render(errors) {
  renderNav();
  renderMain(errors);
  refreshSave();
}

function parseInput(el) {
  const kind = el.dataset.kind;
  if (kind === 'boolean') return el.checked;
  if (kind === 'number') return el.value === '' ? null : Number(el.value);
  if (kind === 'lines') return el.value.split('\n');
  if (kind === 'numbers') return el.value.split(',').map((s) => s.trim()).filter(Boolean).map(Number);
  if (kind === 'words') return el.value.split(',').map((s) => s.trim()).filter(Boolean);
  return el.value;
}

function onInput(e) {
  const el = e.target.closest('[data-path]');
  if (!el) return;
  const s = sectionOf(state.section);
  setAt(state.docs[s.file], JSON.parse(el.dataset.path), parseInput(el));
  el.ariaInvalid = String(!el.checkValidity());
  refreshSave();
}

function blank(value) {
  if (isLocalized(value)) return Object.fromEntries(LOCALES.map((l) => [l, Array.isArray(value[l]) ? [] : '']));
  if (isImage(value)) return { src: '', position: '50% 50%' };
  if (Array.isArray(value)) return value.every(isPrimitive) ? [] : value.slice(0, 1).map(blank);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, blank(v)]));
  return typeof value === 'number' ? 0 : typeof value === 'boolean' ? false : '';
}

function listAction(el) {
  const s = sectionOf(state.section);
  const path = JSON.parse(el.dataset.list);
  const list = getAt(state.docs[s.file], path);
  const i = Number(el.dataset.index);
  if (el.hasAttribute('data-add')) {
    list.push(blank(list[list.length - 1] ?? {}));
    state.open.add(JSON.stringify([...path, list.length - 1]));
  } else if (el.hasAttribute('data-remove')) {
    if (!confirm(`“${itemTitle(list[i], i)}” verwijderen?`)) return;
    list.splice(i, 1);
  } else {
    const j = i + Number(el.dataset.move);
    [list[i], list[j]] = [list[j], list[i]];
  }
  render();
}

function onClick(e) {
  const tab = e.target.closest('[data-section]');
  if (tab) {
    state.section = tab.dataset.section;
    return render();
  }
  const action = e.target.closest('[data-add], [data-remove], [data-move]');
  if (action) {
    e.preventDefault();
    return listAction(action);
  }
}

function onToggle(e) {
  const item = e.target.closest?.('[data-item]');
  if (!item || item !== e.target) return;
  const key = JSON.stringify(JSON.parse(item.dataset.item));
  if (item.open) state.open.add(key);
  else state.open.delete(key);
}

async function canEncodeWebp() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.8));
  return blob?.type === 'image/webp';
}

async function encodeAt(bitmap, scale, type) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.82, 0.72, 0.62]) {
    const blob = await new Promise((r) => canvas.toBlob(r, type, quality));
    if (blob.size <= MEDIA_BUDGET) return blob;
  }
}

async function compress(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const type = (await canEncodeWebp()) ? 'image/webp' : 'image/jpeg';
  for (let scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height)); scale > 0.05; scale *= 0.85) {
    const blob = await encodeAt(bitmap, scale, type);
    if (blob) return blob;
  }
  throw new Error('Deze foto kan niet klein genoeg gemaakt worden.');
}

const slugOf = (name) => name.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'foto';

async function mediaName(file, blob) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
  const hex = Array.from(digest.slice(0, 4), (b) => b.toString(16).padStart(2, '0')).join('');
  return `${slugOf(file.name)}-${hex}.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`;
}

async function onUpload(e) {
  const input = e.target.closest('[data-upload]');
  const file = input?.files?.[0];
  if (!file) return;
  setStatus('Foto verwerken…');
  try {
    const blob = await compress(file);
    const name = await mediaName(file, blob);
    const src = `/media/${name}`;
    state.uploads[`content${src}`] = new Uint8Array(await blob.arrayBuffer());
    state.previews[src] = URL.createObjectURL(blob);
    const s = sectionOf(state.section);
    const path = JSON.parse(input.dataset.upload);
    const current = getAt(state.docs[s.file], path);
    setAt(state.docs[s.file], path, { ...current, src, position: current.position || '50% 50%' });
    setStatus(`Foto klaar: ${Math.round(blob.size / 1000)} kB`);
    render();
  } catch (error) {
    setStatus(error.message || 'Deze foto kon niet gelezen worden. Bewaar hem als JPEG en probeer opnieuw.');
  }
}

function productRefErrors() {
  const site = state.docs[SITE];
  const catalog = state.docs[CATALOG];
  const ids = new Set(catalog.products.map((p) => p.id));
  const refs = [
    ...site.home.hero.products.map((r) => ['Startpagina › hero', r]),
    ...site.home.collection.products.map((r) => ['Startpagina › collectie', r]),
    ...catalog.collections.flatMap((c) => c.items.map((i) => [`Collectie ${c.id}`, i.product])),
  ];
  return refs.filter(([, r]) => !ids.has(r)).map(([where, r]) => `${where}: onbekend product “${r}”`);
}

function pendingSave() {
  const changes = Object.fromEntries(dirtyFiles().map((f) => [f, canonical(state.docs[f])]));
  const used = mediaSources(CONTENT_FILES.map((f) => state.docs[f]));
  const before = mediaSources(CONTENT_FILES.map((f) => JSON.parse(state.original[f])));
  const uploads = Object.fromEntries(Object.entries(state.uploads).filter(([path]) => used.has(path)));
  const deletions = [...before].filter((path) => !used.has(path));
  return { changes, uploads, deletions };
}

function summaryOf({ changes, uploads, deletions }) {
  return [...Object.keys(changes), ...Object.keys(uploads).map((p) => `+${p}`), ...deletions.map((p) => `-${p}`)].join(', ');
}

async function save() {
  const pending = pendingSave();
  const errors = [...checkSave(pending, state.schemas), ...productRefErrors()];
  if (errors.length) return render(errors);
  state.busy = true;
  refreshSave();
  setStatus('Opslaan…');
  const body = {
    head: state.head,
    message: `content: ${summaryOf(pending)}`,
    changes: pending.changes,
    uploads: Object.fromEntries(Object.entries(pending.uploads).map(([p, b]) => [p, toBase64(b)])),
    deletions: pending.deletions,
  };
  const { status, body: result } = await api('', { method: 'POST', body: JSON.stringify(body) }).catch(() => ({ status: 0, body: {} }));
  state.busy = false;
  if (status === 200) return saved(result);
  if (status === 409) return setStatus('Iemand anders heeft intussen opgeslagen. Herlaad de pagina; je wijzigingen gaan dan verloren.');
  if (status === 422) return render(result.errors || []);
  refreshSave();
  setStatus(`Opslaan mislukt (${status || 'geen verbinding'}). Probeer opnieuw.`);
}

function saved({ head, commit }) {
  state.head = head;
  for (const f of CONTENT_FILES) state.original[f] = canonical(state.docs[f]);
  state.uploads = {};
  render();
  watchDeploy(commit);
}

const DEPLOY_TEXT = {
  local: 'Opgeslagen. De lokale site wordt opnieuw gebouwd.',
  queued: 'Opgeslagen. De site wordt gebouwd…',
  building: 'Opgeslagen. De site wordt gebouwd…',
  deployed: 'Opgeslagen en online.',
  failed: 'Opgeslagen, maar de site kon niet gebouwd worden. De eigenaar is verwittigd.',
};

async function watchDeploy(commit) {
  const { body } = await api(`/status${commit ? `?commit=${commit}` : ''}`).catch(() => ({ body: {} }));
  setStatus(DEPLOY_TEXT[body.state] || 'Opgeslagen.');
  if (body.state === 'queued' || body.state === 'building') setTimeout(() => watchDeploy(commit), STATUS_POLL_MS);
}

async function start() {
  try {
    await load();
  } catch (error) {
    $('.admin__main').innerHTML = `<p>Kon de inhoud niet laden: ${esc(error.message)}</p>`;
    return;
  }
  render();
  document.addEventListener('input', onInput);
  document.addEventListener('change', (e) => (e.target.matches('[data-upload]') ? onUpload(e) : onInput(e)));
  document.addEventListener('click', onClick);
  document.addEventListener('toggle', onToggle, true);
  $('.admin__save').addEventListener('click', save);
  addEventListener('beforeunload', (e) => isDirty() && e.preventDefault());
}

start();
