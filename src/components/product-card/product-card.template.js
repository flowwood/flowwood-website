import { bem, esc, img } from '../../js/bem.js';
import { describe } from '../../js/catalog.js';
import { cartControl } from '../cart-control/cart-control.template.js';

export const swatches = (i18n, b, p, selected, large = false) =>
  p.finishes
    .map((f) => `<button ${b('swatch', { key: f.id, cls: large ? 'swatch swatch--large' : 'swatch' })} type="button" data-finish="${f.id}" aria-pressed="${f.id === selected}" aria-label="${esc(i18n.loc(f.name))}" title="${esc(i18n.loc(f.name))}" style="--swatch:${esc(f.color)}"></button>`)
    .join('');

export function productCard(ctx, { product: p, instance, configId = instance, seed, priority = false, variant = 'card' }) {
  const { catalog, i18n } = ctx;
  const b = bem('product-card', instance);
  const c = catalog.defaults(p, seed);
  const d = describe(catalog, i18n, c);
  const sized = catalog.isSized(p);
  const price = catalog.price(c);
  const name = esc(p.name);
  const href = i18n.url('shop', i18n.locale, p.id);
  const altImage = () => (p.altImage ? img(p.altImage, { attrs: b('alt-image'), alt: i18n.t('productCard.alternateView', { name: p.name }) }) : '');
  const card = variant === 'card' || variant === 'compact';
  const choices = variant !== 'compact';
  const media = !card ? '' : `<a ${b('media', { cls: 'media', mods: { alternate: Boolean(p.altImage) } })} href="${href}">${img(p.image, { attrs: b('image'), alt: p.name, priority })}${altImage()}</a>`;
  const title = !card ? `<span ${b('name', { cls: 'product-name' })}>${name}</span>` : `<a ${b('name', { cls: 'product-name hit' })} href="${href}">${name}</a>`;

  const sizes = sized
    ? `<span ${b('unit')}>${esc(i18n.t('common.cm'))}</span>
       <div ${b('heights')} role="group" aria-label="${esc(i18n.t('productCard.sizes'))}">
         ${p.sizing.heights.map((h) => `<button ${b('height', { key: h, cls: 'marker hit' })} type="button" data-height="${h}" aria-pressed="${h === c.height}" aria-label="${esc(i18n.t('productCard.heightOption', { h }))}">${h}</button>`).join('')}
         <button ${b('height', { key: 'custom', cls: 'marker hit' })} type="button" data-height="custom" aria-pressed="false" aria-label="${esc(i18n.t('common.customSizeFor', { name: p.name }))}">${esc(i18n.t('common.custom'))}</button>
       </div>`
    : `<span ${b('unit')}>${esc(i18n.t('common.oneSize'))}</span>`;

  return `<fw-product-card ${b('', { mods: { [variant]: variant !== 'card' } })} data-product="${p.id}" data-config="${esc(configId)}" data-price="${price}">
  ${media}
  <div ${b('head')}>
    <div ${b('titles')}>
      ${title}
      <span ${b('option')}>${esc(d.finish)}, ${esc(d.size)}</span>
      ${p.stock > 0 ? `<span ${b('stock', { cls: 'eyebrow' })}>${esc(i18n.t('productCard.inStock', { count: p.stock }))}</span>` : ''}
    </div>
    <span ${b('price', { cls: 'figure' })}>${esc(i18n.money(price))}</span>
  </div>
  <div ${b('controls')}>
    ${choices ? `<div ${b('sizes')}>${sizes}</div>` : ''}
    <div ${b('buy')}>
      ${choices ? `<div ${b('swatches')} role="group" aria-label="${esc(i18n.t('productCard.finishes'))}">${sized ? swatches(i18n, b, p, c.finish, !card) : ''}</div>` : ''}
      ${cartControl(ctx, { key: catalog.lineKey(c), name: p.name, instance, variant: card ? 'card' : 'detail', stock: p.stock })}
    </div>
  </div>
</fw-product-card>`;
}
