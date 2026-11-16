import { bem, esc, img } from '../../js/bem.js';
import { productCard } from '../product-card/product-card.template.js';
import { breadcrumb } from '../shop/shop.template.js';

export const images = (p) => [p.image, p.altImage, ...(p.gallery || [])].filter(Boolean);

export function product(ctx, p) {
  const { i18n } = ctx;
  const b = bem('product');
  return `<article ${b()} data-product="${p.id}">
  ${breadcrumb(b, i18n, [
    { key: 'home', href: i18n.url('home'), label: i18n.t('menuBar.home') },
    { key: 'shop', href: i18n.url('shop'), label: i18n.t('shop.title') },
  ], p.name)}
  <div ${b('layout')}>
    ${gallery(ctx, b, p)}
    <div ${b('info')}>
      <span ${b('summary', { cls: 'eyebrow' })}>${esc(i18n.loc(p.summary))}</span>
      ${productCard(ctx, { product: p, instance: 'detail', configId: p.id, detail: true })}
      <a ${b('cart', { cls: 'link hit' })} href="${i18n.url('cart')}">${esc(i18n.t('product.viewCart'))} <span ${b('cart-arrow')} aria-hidden="true">→</span></a>
      ${details(ctx, b, p)}
    </div>
  </div>
</article>`;
}

const photoRatio = (image) => `--photo-ratio:${Number(image.width)} / ${Number(image.height)}`;

function gallery({ i18n }, b, p) {
  const list = images(p);
  const alt = (n) => (n ? i18n.t('productCard.alternateView', { name: p.name }) : p.name);
  const slide = (image, k) => `<div ${b('slide', { key: k + 1, cls: 'media' })}>${img(image, { attrs: b('image', { key: k + 1 }), alt: alt(k), priority: k === 0 })}</div>`;
  if (list.length === 1) return `<fw-product ${b('gallery')} style="${photoRatio(list[0])}">${slide(list[0], 0)}</fw-product>`;
  const label = (n) => esc(i18n.t('product.photo', { n, total: list.length }));
  const step = (key, dir) => `<button ${b('step', { key, mods: { [key]: true }, cls: 'button button--icon hit' })} type="button" data-step="${dir}" aria-label="${esc(i18n.t(`product.${key}Photo`))}"></button>`;
  const thumbs = list.map(
    (image, k) =>
      `<a ${b('thumb', { key: k + 1, cls: 'media' })} href="#${b.id('slide', k + 1)}" aria-label="${label(k + 1)}"${k ? '' : ' aria-current="true"'}>${img(image, { attrs: b('thumb-image', { key: k + 1 }) })}</a>`,
  );
  return `<fw-product ${b('gallery')} style="${photoRatio(list[0])}">
      <div ${b('stage')}>
        <div ${b('track')} role="group" aria-label="${esc(i18n.t('product.gallery', { name: p.name }))}" tabindex="0">${list.map(slide).join('')}</div>
        ${step('previous', -1)}${step('next', 1)}
      </div>
      <div ${b('thumbs')}>${thumbs.join('')}</div>
    </fw-product>`;
}

function details({ catalog, i18n }, b, p) {
  const t = (k, vars) => esc(i18n.t(`product.${k}`, vars));
  const cs = catalog.customSize;
  const row = (key, term, value) => `<div ${b('spec', { key })}><dt ${b('spec-term', { key })}>${esc(term)}</dt><dd ${b('spec-value', { key })}>${esc(value)}</dd></div>`;
  const dimensions = catalog.isSized(p)
    ? `<dl ${b('specs')}>${p.sizing.heights.map((h) => row(h, i18n.t('common.heightLabel', { h }), catalog.outerDimensions(p, { h, w: p.sizing.width }))).join('')}</dl>
       <p ${b('text', { key: 'custom' })}>${t('dimensionsCustom', { hmin: cs.height.min, hmax: cs.height.max, wmin: cs.width.min, wmax: cs.width.max })}</p>`
    : `<p ${b('text', { key: 'dimensions' })}>${esc(i18n.loc(p.dimensions))}</p>`;
  const text = (key, value) => (value ? `<p ${b('text', { key })}>${esc(value)}</p>` : '');
  const delivery = [catalog.isSized(p) ? i18n.t('customSize.leadTime') : i18n.t('product.inStock'), i18n.t('product.deliveryBody'), i18n.t('product.returnsBody')];
  const sections = [
    ['dimensions', dimensions],
    ['materials', text('materials', i18n.loc(p.materials))],
    ['care', text('care', i18n.loc(p.care))],
    ['deliveryReturns', delivery.map((v, n) => text(`delivery-${n + 1}`, v)).join('')],
  ].filter(([, body]) => body);
  return `<div ${b('details')}>
      ${sections
        .map(
          ([key, body], n) => `<details ${b('detail', { key })}${n ? '' : ' open'}>
        <summary ${b('detail-summary', { key, cls: 'eyebrow' })}>${t(key)}</summary>
        <div ${b('detail-body', { key })}>${body}</div>
      </details>`,
        )
        .join('')}
    </div>`;
}
