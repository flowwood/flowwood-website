import { bem, esc, img } from '../../js/bem.js';
import { productCard } from '../product-card/product-card.template.js';
import { collection } from '../collection/collection.template.js';

export const images = (p) => [p.image, p.altImage, ...(p.gallery || [])].filter(Boolean);

const GRID_SLOTS = 4;

const breadcrumb = (b, i18n, links, current) => `<nav ${b('breadcrumb', { cls: 'breadcrumb' })} aria-label="${esc(i18n.t('product.breadcrumb'))}">
      ${links.map((l) => `<a ${b('crumb', { key: l.key, cls: 'breadcrumb__link hit' })} href="${l.href}">${esc(l.label)}</a><span ${b('crumb-separator', { key: l.key })} aria-hidden="true">/</span>`).join('')}
      <span ${b('crumb', { key: 'current', cls: 'breadcrumb__current' })} aria-current="page">${esc(current)}</span>
    </nav>`;

export function product(ctx, p) {
  const { catalog, i18n } = ctx;
  const b = bem('product');
  const list = images(p);
  const photoLabel = (n) => esc(i18n.t('product.photo', { n, total: list.length }));
  const photos = list.slice(1).map((image, k) => `<a ${b('thumb', { key: k + 2, cls: 'media' })} href="#${b.id('slide', k + 2)}" aria-label="${photoLabel(k + 2)}">${img(image, { attrs: b('thumb-image', { key: k + 2 }), thumb: true })}</a>`);
  const texts = notes(ctx, b, p).map(([key, body]) => note(i18n, b, key, body));
  const tiles = fillSlots(texts, photos);
  const from = catalog.isSized(p) ? `<span ${b('from-label')}>${esc(i18n.t('common.from'))}</span> ` : '';

  return `<fw-product ${b()} data-product="${p.id}">
  ${breadcrumb(b, i18n, [
    { key: 'home', href: i18n.url('home'), label: i18n.t('menuBar.home') },
    { key: 'shop', href: i18n.url('shop'), label: i18n.t('shop.title') },
  ], p.name)}
  <header ${b('head')}>
    <h1 ${b('name', { cls: 'product-name' })}>${esc(p.name)}</h1>
    <div ${b('lead')}>
      <p ${b('summary', { cls: 'eyebrow' })}>${esc(i18n.loc(p.summary))}</p>
      <p ${b('from')}>${from}<span ${b('from-price', { cls: 'figure' })}>${esc(i18n.money(catalog.fromPrice(p)))}</span></p>
    </div>
  </header>
  <div ${b('grid')}>
    <div ${b('viewer')}>
      ${list.length > 1 ? reel(b, list, photoLabel) : ''}
      ${stage(i18n, b, p, list)}
    </div>
    <div ${b('options')}>${productCard(ctx, { product: p, instance: 'options', configId: p.id, variant: 'options' })}</div>
    ${tiles.grid.join('')}
  </div>
  ${tiles.rest.length ? `<div ${b('more')}>${tiles.rest.join('')}</div>` : ''}
  ${related(ctx, p)}
  <div ${b('bar')}>
    ${productCard(ctx, { product: p, instance: 'bar', configId: p.id, variant: 'bar' })}
  </div>
</fw-product>`;
}

function related(ctx, p) {
  const { catalog, i18n } = ctx;
  const items = (p.related || [])
    .filter((id) => id !== p.id)
    .map((id) => catalog.product(id))
    .filter(Boolean)
    .map((product) => ({ product, configId: product.id }));
  const link = { href: i18n.url('shop'), label: i18n.t('collection.all') };
  return items.length ? collection(ctx, { id: 'related', variant: 'related', title: i18n.t('product.related', { name: p.name }), titleClass: 'eyebrow', card: 'compact', link, items }) : '';
}

function fillSlots(texts, photos) {
  const grid = [];
  const queue = { text: [...texts], photo: [...photos] };
  while (grid.length < GRID_SLOTS && (queue.text.length || queue.photo.length)) {
    const [first, second] = grid.length % 2 ? ['photo', 'text'] : ['text', 'photo'];
    grid.push(queue[first].shift() ?? queue[second].shift());
  }
  return { grid, rest: [...queue.text, ...queue.photo] };
}

const reel = (b, list, photoLabel) => `<div ${b('reel')}>${list
  .map((image, k) => `<a ${b('pick', { key: k + 1, cls: 'media' })} href="#${b.id('slide', k + 1)}" aria-label="${photoLabel(k + 1)}"${k ? '' : ' aria-current="true"'}>${img(image, { attrs: b('pick-image', { key: k + 1 }), thumb: true })}</a>`)
  .join('')}</div>`;

function stage(i18n, b, p, list) {
  const alt = (k) => (k ? i18n.t('productCard.alternateView', { name: p.name }) : p.name);
  const slide = (image, k) => `<div ${b('slide', { key: k + 1, cls: 'media' })}>${img(image, { attrs: b('image', { key: k + 1 }), alt: alt(k), priority: k === 0 })}</div>`;
  const step = (key, dir) => `<button ${b('step', { key, mods: { [key]: true }, cls: 'button button--icon hit' })} type="button" data-step="${dir}" aria-label="${esc(i18n.t(`product.${key}Photo`))}"></button>`;
  return `<div ${b('stage')} style="--photo-ratio:${Number(list[0].width)} / ${Number(list[0].height)}">
      <div ${b('track')} role="group" aria-label="${esc(i18n.t('product.gallery', { name: p.name }))}" tabindex="0">${list.map(slide).join('')}</div>
      ${list.length > 1 ? step('previous', -1) + step('next', 1) : ''}
    </div>`;
}

const note = (i18n, b, key, body) => `<section ${b('note', { key })} aria-labelledby="${b.id('note-title', key)}">
      <h2 ${b('note-title', { key, cls: 'eyebrow' })}>${esc(i18n.t(`product.${key}`))}</h2>
      <div ${b('note-body', { key })}>${body}</div>
    </section>`;

function notes({ catalog, i18n }, b, p) {
  const t = (k, vars) => esc(i18n.t(`product.${k}`, vars));
  const cs = catalog.customSize;
  const row = (key, term, value) => `<div ${b('spec', { key })}><dt ${b('spec-term', { key })}>${esc(term)}</dt><dd ${b('spec-value', { key })}>${esc(value)}</dd></div>`;
  const dimensions = catalog.isSized(p)
    ? `<dl ${b('specs')}>${p.sizing.heights.map((h) => row(h, i18n.t('common.heightLabel', { h }), catalog.outerDimensions(p, { h, w: p.sizing.width }))).join('')}</dl>
       <p ${b('text', { key: 'custom' })}>${t('dimensionsCustom', { hmin: cs.height.min, hmax: cs.height.max, wmin: cs.width.min, wmax: cs.width.max })}</p>`
    : `<p ${b('text', { key: 'dimensions' })}>${esc(i18n.loc(p.dimensions))}</p>`;
  const text = (key, value) => (value ? `<p ${b('text', { key })}>${esc(value)}</p>` : '');
  const availability = i18n.loc(p.availability) || i18n.t(catalog.isSized(p) ? 'customSize.leadTime' : 'product.inStock');
  const delivery = [availability, i18n.t('product.deliveryBody'), i18n.t('product.returnsBody')];
  return [
    ['about', text('about', i18n.loc(p.description))],
    ['dimensions', dimensions],
    ['materials', text('materials', i18n.loc(p.materials))],
    ['care', text('care', i18n.loc(p.care))],
    ['deliveryReturns', delivery.map((v, n) => text(`delivery-${n + 1}`, v)).join('')],
  ].filter(([, body]) => body);
}
