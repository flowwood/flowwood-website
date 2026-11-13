import { bem, esc, img } from '../../js/bem.js';
import { cartControl } from '../cart-control/cart-control.template.js';

export function hero(ctx) {
  const { site, catalog, i18n } = ctx;
  const b = bem('hero');
  const t = (k, vars) => esc(i18n.t(`hero.${k}`, vars));
  const products = site.home.hero.products.map((id) => catalog.product(id));
  const total = String(products.length).padStart(2, '0');
  const frame = products.map((p) => p.image).reduce((a, i) => (i.width < a.width ? i : a));
  const hidden = (k) => (k ? ' aria-hidden="true"' : '');

  const slides = products
    .map(
      (p, k) => `<div ${b('slide', { key: p.id, mods: { [p.tone]: true } })}${hidden(k)}>
      ${img(p.image, { attrs: b('image', { key: p.id }), alt: p.name, priority: k === 0 || 'low' })}
      <span ${b('scrim', { key: p.id })}></span>
    </div>`,
    )
    .join('');

  const panels = products
    .map(
      (p, k) => `<div ${b('panel', { key: p.id, mods: { [p.tone]: true } })}${hidden(k)}${k ? ' inert' : ''}>
        <h2 ${b('title', { key: p.id })}>${esc(p.name)}</h2>
        <div ${b('card', { key: p.id })}>
          <div ${b('info', { key: p.id })}>
            <div ${b('meta', { key: p.id })}>
              <span ${b('summary', { key: p.id, cls: 'eyebrow' })}>${esc(i18n.loc(p.summary))}</span>
              <a ${b('related', { key: p.id, cls: 'link hit' })} href="#collection--home">${t('seeRelated')} →</a>
            </div>
            <p ${b('description', { key: p.id })}>${esc(i18n.loc(p.description))}</p>
          </div>
          <div ${b('buy', { key: p.id })}>
            <div ${b('price', { key: p.id })}>
              <span ${b('from', { key: p.id })}>${esc(i18n.t('common.from'))}</span>
              <span ${b('amount', { key: p.id, cls: 'figure' })}>${esc(i18n.money(catalog.fromPrice(p)))}</span>
            </div>
            <div ${b('actions', { key: p.id })}>
              <a ${b('view', { key: p.id, cls: 'button button--primary button--small' })} href="${i18n.url('shop')}">${t('viewProduct')} <span ${b('arrow', { key: p.id, cls: 'button__icon' })} aria-hidden="true">→</span></a>
              ${cartControl(ctx, { variant: 'hero', key: catalog.lineKey(catalog.defaults(p)), name: p.name, instance: `hero-${p.id}` })}
            </div>
          </div>
        </div>
      </div>`,
    )
    .join('');

  const thumbs = products
    .map(
      (p, k) => `<button ${b('thumb', { key: p.id, cls: 'hit' })} type="button" data-index="${k}" aria-label="${t('slide', { name: p.name })}"${k ? '' : ' aria-current="true"'}>
          ${img(p.image, { attrs: b('thumb-image', { key: p.id }), alt: '' })}
          <span ${b('progress', { key: p.id })}></span>
        </button>`,
    )
    .join('');

  return `<fw-hero ${b()} role="region" aria-roledescription="carousel" aria-label="${t('label')}" data-active="0" data-tone="${products[0].tone}" data-products="${products.map((p) => p.id).join(' ')}" style="--autoplay:${Number(site.home.hero.autoplaySeconds)}s;--hero-frame-w:${Number(frame.width)}px;--hero-frame-h:${Number(frame.height)}px">
  <aside ${b('aside')}>
    <h1 ${b('wordmark')}><a ${b('home', { cls: 'hit' })} href="${i18n.url('home')}">${esc(site.name)}</a></h1>
  </aside>
  <div ${b('main')}>
    <div ${b('slides')}>${slides}</div>
    <div ${b('bar')}>
      <div ${b('panels')}>${panels}</div>
      <div ${b('controls')}>
        <div ${b('nav')}>
          <span ${b('counter')}>01 / ${total}</span>
          <button ${b('prev', { cls: 'hit' })} type="button" data-step="-1" aria-label="${t('previous')}">←</button>
          <button ${b('next', { cls: 'hit' })} type="button" data-step="1" aria-label="${t('next')}">→</button>
        </div>
        <div ${b('thumbs')}>${thumbs}</div>
      </div>
    </div>
  </div>
</fw-hero>`;
}
