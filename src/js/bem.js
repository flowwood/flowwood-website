const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const slug = (v) => String(v).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function bem(block, instance = '') {
  const inst = instance === '' ? '' : slug(instance);
  const idOf = (element, key) => {
    const suffix = [inst, key === undefined ? '' : slug(key)].filter(Boolean).join('-');
    return (element ? `${block}__${element}` : block) + (suffix ? `--${suffix}` : '');
  };
  const attrs = (element = '', { key, mods, cls } = {}) => {
    const base = element ? `${block}__${element}` : block;
    const classes = [base];
    for (const [m, on] of Object.entries(mods || {})) if (on) classes.push(`${base}--${slug(m)}`);
    if (cls) classes.push(cls);
    return `class="${classes.join(' ')}" id="${idOf(element, key)}" data-component="${block}"`;
  };
  attrs.id = idOf;
  return attrs;
}

const LOADING = {
  lcp: 'loading="eager" fetchpriority="high"',
  offscreen: 'loading="lazy" fetchpriority="low"',
  lazy: 'loading="lazy"',
};
const loadingFor = (priority) => (priority === true ? LOADING.lcp : priority === 'low' ? LOADING.offscreen : LOADING.lazy);

export function img(image, { attrs = '', alt = '', priority = false } = {}) {
  const load = loadingFor(priority);
  const pos = image.position ? ` style="--pos:${esc(image.position)}"` : '';
  return `<img ${attrs} src="${esc(image.src)}" width="${image.width}" height="${image.height}" alt="${esc(alt)}" ${load} decoding="async"${pos}>`;
}
