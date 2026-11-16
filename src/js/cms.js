import { createValidator } from './schema.js';

export const CONTENT_FILES = ['content/site.json', 'content/catalog.json'];
export const SCHEMA_FILES = { 'content/site.json': 'content/schema/site.schema.json', 'content/catalog.json': 'content/schema/catalog.schema.json' };
export const MEDIA_BUDGET = 60_000;
export const MAX_IMAGE_EDGE = 1600;

const MEDIA_FILE = /^content\/media\/[a-z0-9][a-z0-9._-]*\.(webp|jpg)$/;
const isWebp = (b) => String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP';
const isJpeg = (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

export const canonical = (data) => `${JSON.stringify(data, null, 2)}\n`;

export function mediaSources(node, found = new Set()) {
  if (typeof node?.src === 'string' && node.src.startsWith('/media/')) found.add(`content${node.src}`);
  if (node && typeof node === 'object') Object.values(node).forEach((v) => mediaSources(v, found));
  return found;
}

function checkUpload(path, bytes) {
  if (!MEDIA_FILE.test(path)) return [`${path}: only content/media/<name>.webp or .jpg`];
  if (bytes.length > MEDIA_BUDGET) return [`${path}: ${bytes.length} B > ${MEDIA_BUDGET} B`];
  if (!(path.endsWith('.webp') ? isWebp(bytes) : isJpeg(bytes))) return [`${path}: not a ${path.split('.').pop()} file`];
  return [];
}

function checkChange(path, text, schemas) {
  if (!CONTENT_FILES.includes(path)) return [`${path}: not an editable file`];
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return [`${path}: invalid JSON`];
  }
  if (text !== canonical(data)) return [`${path}: not canonical JSON`];
  return createValidator(schemas[path])(data).map((e) => `${path}${e}`);
}

export function checkSave({ changes = {}, uploads = {}, deletions = [] }, schemas) {
  return [
    ...Object.entries(changes).flatMap(([path, text]) => checkChange(path, text, schemas)),
    ...Object.entries(uploads).flatMap(([path, bytes]) => checkUpload(path, bytes)),
    ...deletions.filter((path) => !MEDIA_FILE.test(path)).map((path) => `${path}: only media can be deleted`),
  ];
}

export const toBase64 = (bytes) => btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
export const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
