import { bem, esc, img } from '../../js/bem.js';
import { describe } from '../../js/catalog.js';
import { cartControl } from '../cart-control/cart-control.template.js';

const b = bem('cart');
let i18n;
const t = (k, vars) => esc(i18n.t(`cart.${k}`, vars));

export function cart(ctx) {
  ({ i18n } = ctx);
  return `<fw-cart ${b()}>
 <div ${b('layout')}>
  <aside ${b('banner')}>
    <div ${b('intro')}>
      <a ${b('continue', { cls: 'eyebrow' })} href="${i18n.url('shop')}"><span ${b('continue-icon')} aria-hidden="true">←</span> ${t('continue')}</a>
      <p ${b('cheer')}>${esc(i18n.t('cart.cheers')[0])}</p>
    </div>
    <div ${b('summary')} hidden>
      <div ${b('subtotal')}>
        <span ${b('subtotal-label', { cls: 'eyebrow' })}></span>
        <span ${b('subtotal-value', { cls: 'figure' })}></span>
      </div>
      <button ${b('checkout', { cls: 'button button--paper' })} type="button">${t('checkout')} <span ${b('checkout-icon', { cls: 'button__icon' })} aria-hidden="true">→</span></button>
    </div>
  </aside>
  <div ${b('main')}>
    <h1 ${b('title', { cls: 'visually-hidden' })}>${esc(i18n.t('menuBar.cart'))}</h1>
    <div ${b('grid')} hidden></div>
    <div ${b('empty')} hidden>
      <p ${b('empty-title')}>${t('empty')}</p>
      <p ${b('empty-body')}>${t('emptyBody')}</p>
      <a ${b('browse', { cls: 'button button--primary' })} href="${i18n.url('shop')}">${t('browse')} <span ${b('browse-icon', { cls: 'button__icon' })} aria-hidden="true">→</span></a>
    </div>
  </div>
 </div>
</fw-cart>`;
}

function spans(n, cols) {
  if (cols === 1) return Array.from({ length: n }, () => [1, 1]);
  if (cols === 2) return Array.from({ length: n }, (_, k) => (k === 0 || (k === n - 1 && (n - 1) % 2 === 1) ? [2, 1] : [1, 1]));
  const out = [];
  for (let g = 0; g < Math.floor(n / 4); g++) out.push([2, 2], [2, 1], [1, 1], [1, 1]);
  const rem = n % 4;
  if (rem === 1) out.push(n === 1 ? [4, 2] : [4, 1]);
  if (rem === 2) out.push([2, 2], [2, 2]);
  if (rem === 3) out.push([2, 2], [2, 1], [2, 1]);
  return out;
}

export function cartGroups(catalog, lines) {
  const order = new Map(catalog.data.products.map((p, i) => [p.id, i]));
  const groups = new Map();
  for (const [key, qty] of Object.entries(lines)) {
    const config = catalog.parseKey(key);
    if (!config) continue;
    if (!groups.has(config.product)) groups.set(config.product, { product: catalog.product(config.product), lines: [] });
    groups.get(config.product).lines.push({ key, config, qty, price: catalog.price(config) });
  }
  return [...groups.values()].sort((a, z) => order.get(a.product.id) - order.get(z.product.id));
}

export const sum = (lines, f) => lines.reduce((a, l) => a + f(l), 0);

export function cartTiles(ctx, { groups, open = '', adding = false }) {
  ({ i18n } = ctx);
  const s = [1, 2, 4].map((cols) => spans(groups.length, cols));
  return groups
    .map((g, n) => {
      const vars = [1, 2, 4].map((cols, i) => `--c${cols}:${s[i][n][0]};--r${cols}:${s[i][n][1]}`).join(';');
      const style = `${vars};view-transition-name:cart-tile-${g.product.id};view-transition-class:cart-tile`;
      const group = ctx.catalog.isSized(g.product) && (g.lines.length > 1 || open === g.product.id);
      return group ? groupTile(ctx, g, style, open === g.product.id, adding) : singleTile(ctx, g, style);
    })
    .join('');
}

function frame(g, { style, mods, keys, removeLabel }, inner) {
  const p = g.product;
  const k = p.id;
  return `<article ${b('tile', { key: k, mods })} data-product="${k}" style="${style}">
  <div ${b('media', { key: k, cls: 'media' })}>${img(p.image, { attrs: b('image', { key: k }), alt: p.name })}</div>
  <a ${b('view', { key: k })} href="${i18n.url('shop', i18n.locale, p.id)}" aria-label="${t('view', { name: p.name })}"></a>
  <button ${b('remove', { key: k, cls: 'button button--icon hit' })} type="button" data-remove="${esc(keys)}" aria-label="${esc(removeLabel)}" title="${t('removeTitle')}"${mods.open ? ' hidden' : ''}>×</button>
  ${inner}
</article>`;
}

function singleTile(ctx, g, style) {
  const { catalog } = ctx;
  const p = g.product;
  const [l] = g.lines;
  const d = describe(catalog, i18n, l.config);
  const k = p.id;
  return frame(
    g,
    { style, mods: { single: true, zero: l.qty === 0 }, keys: l.key, removeLabel: i18n.t('cart.remove', { name: p.name, details: `${d.finish}, ${d.size}` }) },
    `<div ${b('price', { key: k })}>
    <span ${b('line-total', { key: k, cls: 'figure' })}>${esc(i18n.money(l.price * l.qty))}</span>
    <span ${b('line-detail', { key: k })}>${l.qty} × ${esc(i18n.money(l.price))} · ${esc(d.size)}</span>
  </div>
  ${cartControl(ctx, { key: l.key, name: p.name, instance: l.key, variant: 'tile', qty: l.qty })}`,
  );
}

function groupTile(ctx, g, style, open, adding) {
  const { catalog } = ctx;
  const p = g.product;
  const k = p.id;
  const pieces = i18n.pieces(sum(g.lines, (l) => l.qty));
  const total = i18n.money(sum(g.lines, (l) => l.price * l.qty));
  const options = g.lines.length === 1 ? i18n.t('cart.option') : i18n.t('cart.options', { n: g.lines.length });
  const last = g.lines[g.lines.length - 1].config;
  const close = t('closeOptions', { name: p.name });

  const rows = g.lines
    .map((l) => {
      const c = l.config;
      const dims = c.custom && catalog.customDims(c);
      const size = dims ? i18n.t('cart.customRow', dims) : i18n.t('common.heightLabel', { h: c.height });
      const finish = i18n.loc(catalog.finish(p, c.finish).name);
      const r = l.key;
      return `<div ${b('row', { key: r })}>
      <div ${b('row-head', { key: r })}>
        <span ${b('row-option', { key: r })}><span ${b('row-size', { key: r })}>${esc(size)}</span><span ${b('row-finish', { key: r })}>${esc(dims ? i18n.t('cart.madeToMeasure', { finish }) : finish)}</span></span>
        <span ${b('row-total', { key: r, cls: 'figure' })}>${esc(i18n.money(l.price * l.qty))}</span>
      </div>
      <div ${b('row-actions', { key: r })}>
        ${cartControl(ctx, { key: l.key, name: `${p.name} ${size}`, instance: l.key, variant: 'row', qty: l.qty })}
        <button ${b('row-remove', { key: r, cls: 'hit' })} type="button" data-remove-line="${esc(l.key)}" aria-label="${t('remove', { name: p.name, details: size })}">${t('removeLine')}</button>
      </div>
    </div>`;
    })
    .join('');

  const another = adding
    ? `<div ${b('sizes', { key: k })} role="group" aria-label="${t('addSizeGroup', { name: p.name })}">
        <span ${b('sizes-label', { key: k })}>${t('addLabel')}</span>
        ${p.sizing.heights.map((h) => `<button ${b('size', { key: `${k}-${h}`, cls: 'hit' })} type="button" data-add="${esc(catalog.lineKey({ product: k, finish: last.finish, height: h }))}" aria-label="${t('addSize', { h, name: p.name })}">${h}</button>`).join('')}
        <button ${b('size', { key: `${k}-custom`, cls: 'hit' })} type="button" data-custom="${k}" data-finish="${esc(last.finish)}" aria-label="${t('addCustom', { name: p.name })}">${esc(i18n.t('common.custom'))}</button>
      </div>
      <button ${b('sizes-close', { key: k, cls: 'button button--icon hit' })} type="button" data-adding aria-label="${t('closeSizes')}">×</button>`
    : `<button ${b('another', { key: k, cls: 'eyebrow hit' })} type="button" data-adding aria-expanded="false"><span ${b('another-icon', { key: k })} aria-hidden="true">+</span>${t('anotherSize')}</button>`;

  return frame(
    g,
    { style, mods: { group: true, open }, keys: g.lines.map((l) => l.key).join(' '), removeLabel: i18n.t('cart.removeAll', { name: p.name }) },
    `<button ${b('toggle', { key: k })} type="button" data-toggle="${k}" aria-expanded="${open}" aria-label="${t('showOptions', { name: p.name, sizes: options, pieces, total })}"${open ? ' hidden' : ''}>
    <span ${b('toggle-totals', { key: k })}><span ${b('toggle-total', { key: k, cls: 'figure' })}>${esc(total)}</span><span ${b('toggle-pieces', { key: k })}>${esc(pieces)}</span></span>
    <span ${b('toggle-options', { key: k, cls: 'eyebrow' })}>${esc(options)} <span ${b('toggle-icon', { key: k })} aria-hidden="true">⌃</span></span>
  </button>
  ${
    open
      ? `<button ${b('scrim', { key: k })} type="button" data-toggle="${k}" aria-label="${close}" tabindex="-1"></button>
  <div ${b('panel', { key: k })} role="group" aria-label="${t('optionsOf', { name: p.name })}">
    <div ${b('panel-head', { key: k })}>
      <span ${b('panel-name', { key: k, cls: 'product-name' })}>${esc(p.name)}</span>
      <button ${b('panel-close', { key: k, cls: 'button button--icon hit' })} type="button" data-toggle="${k}" aria-label="${close}">×</button>
    </div>
    ${rows}
    <div ${b('another-row', { key: k })}>${another}</div>
    <div ${b('panel-total', { key: k })}>
      <span ${b('panel-total-label', { key: k, cls: 'eyebrow' })}>${t('total', { pieces })}</span>
      <span ${b('panel-total-value', { key: k, cls: 'figure' })}>${esc(total)}</span>
    </div>
  </div>`
      : ''
  }`,
  );
}
