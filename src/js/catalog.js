export function createCatalog(data) {
  const byId = new Map(data.products.map((p) => [p.id, p]));
  const cs = data.customSize;
  const clamp = (v, { min, max }) => Math.min(max, Math.max(min, Number.isFinite(+v) && v !== '' ? +v : min));
  const inRange = (raw, { min, max }) => raw !== '' && Number.isFinite(+raw) && +raw >= min && +raw <= max;
  const roundTo = (n) => Math.round(n / cs.roundTo) * cs.roundTo;

  const product = (id) => byId.get(id);
  const isSized = (p) => Boolean(p.sizing);
  const finish = (p, id) => p.finishes.find((f) => f.id === id) || p.finishes[0];
  const customDims = (c) => ({ h: clamp(c.custom.h, cs.height), w: clamp(c.custom.w, cs.width) });

  function defaults(p, seed = {}) {
    if (!isSized(p)) return { product: p.id };
    const height = p.sizing.heights.includes(seed.height) ? seed.height : p.sizing.heights[0];
    return { product: p.id, finish: finish(p, seed.finish).id, height };
  }

  function customStart(p, c = {}) {
    if (c.custom) return customDims(c);
    return { h: p.sizing.heights[1] ?? p.sizing.heights[0], w: p.sizing.width };
  }

  function price(c) {
    const p = product(c.product);
    if (!isSized(p)) return p.pricing.fixed;
    const { base, perSizeStep } = p.pricing;
    if (c.custom) {
      const { h, w } = customDims(c);
      return roundTo(base + customExtra(p, { h, w }) + cs.surcharge);
    }
    return base + perSizeStep * Math.max(0, p.sizing.heights.indexOf(c.height));
  }

  const customExtra = (p, { h, w }) => Math.max(0, h - p.sizing.heights[0]) * cs.pricePerCm.height + Math.max(0, w - p.sizing.width) * cs.pricePerCm.width;

  const fromPrice = (p) => (isSized(p) ? p.pricing.base : p.pricing.fixed);

  function lineKey(c) {
    const p = product(c.product);
    if (!isSized(p)) return p.id;
    const f = finish(p, c.finish).id;
    if (c.custom) {
      const { h, w } = customDims(c);
      return `${p.id}:${f}:${h}x${w}`;
    }
    return `${p.id}:${f}:${c.height}`;
  }

  const isCustomSize = (size) => /^\d+x\d+$/.test(size || '');

  function parseKey(key) {
    const [id, f, size] = String(key).split(':');
    const p = product(id);
    if (!p) return null;
    if (!isSized(p)) return { product: id };
    if (isCustomSize(size)) {
      const [h, w] = size.split('x').map(Number);
      return { product: id, finish: finish(p, f).id, custom: { h, w } };
    }
    const height = Number(size);
    return p.sizing.heights.includes(height) ? { product: id, finish: finish(p, f).id, height } : null;
  }

  function outerDimensions(p, { h, w }) {
    const shape = p.sizing.shape;
    if (shape === 'square') return `${w} × ${w} × ${h} cm`;
    if (shape === 'oval') return `${w} × ${Math.round((w * 2) / 3)} × ${h} cm`;
    return `Ø ${w} × ${h} cm`;
  }

  return { data, customSize: cs, product, isSized, finish, defaults, customStart, customDims, price, fromPrice, lineKey, parseKey, outerDimensions, clamp, inRange };
}

export function describe(catalog, i18n, c) {
  const p = catalog.product(c.product);
  if (!catalog.isSized(p)) return { finish: i18n.loc(p.summary), size: i18n.loc(p.dimensions) };
  const finish = i18n.loc(catalog.finish(p, c.finish).name);
  if (c.custom) {
    const { h, w } = catalog.customDims(c);
    return { finish, size: i18n.t('common.customSizeLabel', { h, w }) };
  }
  return { finish, size: i18n.t('common.heightLabel', { h: c.height }) };
}
