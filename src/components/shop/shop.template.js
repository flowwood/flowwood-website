import { bem, esc } from '../../js/bem.js';
import { collection } from '../collection/collection.template.js';

const headSpan = (count, columns) => {
  const rest = count % columns;
  return rest ? columns - rest : columns;
};

function headline(ctx, b, c, current) {
  const { i18n } = ctx;
  return `<p ${b('panel', { key: c.id })} data-collection="${esc(c.id)}"${current ? '' : ' hidden'}>${esc(i18n.loc(c.headline || c.name))}</p>`;
}

function summary(ctx, b) {
  const { i18n } = ctx;
  return `<div ${b('summary')}>
      ${facts(ctx, b)}
      <div ${b('cart')} hidden>
        <span ${b('cart-label', { cls: 'eyebrow' })}></span>
        <span ${b('cart-total', { cls: 'figure' })}></span>
        <a ${b('cart-link', { cls: 'button button--paper' })} href="${i18n.url('cart')}">${esc(i18n.t('shop.viewCart'))} <span ${b('cart-icon', { cls: 'button__icon' })} aria-hidden="true">→</span></a>
      </div>
    </div>`;
}

function facts(ctx, b) {
  const { catalog, i18n } = ctx;
  const { height, width } = catalog.customSize;
  const fact = (key, term, detail) => `<div ${b('fact', { key })}><dt ${b('term', { key, cls: 'eyebrow' })}>${esc(term)}</dt>${detail
    .map((d, i) => `<dd ${b('detail', { key: `${key}-${i}` })}>${esc(d)}</dd>`)
    .join('')}</div>`;
  return `<dl ${b('facts')}>
      ${fact('delivery', i18n.t('customSize.delivery'), [i18n.t('customSize.leadTime'), i18n.countries(catalog.data.delivery.countries)])}
      ${fact('custom', i18n.t('customSize.title'), [i18n.t('shop.customRange', { hMin: height.min, hMax: height.max, wMin: width.min, wMax: width.max })])}
    </dl>`;
}

const VIEW_ICONS = { tiles: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', rows: 'M3 6h18M3 12h18M3 18h18' };

function views(ctx, b) {
  const { i18n } = ctx;
  return `<div ${b('views')} role="radiogroup" aria-label="${esc(i18n.t('shop.view'))}">
      ${Object.entries(VIEW_ICONS)
        .map(
          ([view, d], i) => `<label ${b('view', { key: view, cls: 'hit' })} title="${esc(i18n.t(`shop.${view}`))}">
        <input ${b('input', { key: view, mods: { [view]: true }, cls: 'visually-hidden' })} type="radio" name="shop-view" value="${view}" aria-label="${esc(i18n.t(`shop.${view}`))}"${i === 0 ? ' checked' : ''}>
        <svg ${b('icon', { key: view })} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path ${b('icon-path', { key: view })} d="${d}"></path></svg>
      </label>`,
        )
        .join('')}
    </div>`;
}

export function shop(ctx) {
  const { catalog, i18n } = ctx;
  const b = bem('shop');
  const cols = catalog.data.collections;

  return `<fw-shop ${b()}>
  <aside ${b('side')}>
    <div ${b('bar')}>
      <h1 ${b('title', { cls: 'eyebrow visually-hidden--mobile' })}>${esc(i18n.t('shop.title'))}</h1>
      ${views(ctx, b)}
    </div>
    <div ${b('headlines')}>
      ${cols.map((c, i) => headline(ctx, b, c, i === 0)).join('')}
    </div>
    <nav ${b('contents')} aria-label="${esc(i18n.t('shop.filter'))}">
      <ol ${b('list')}>
        ${cols
          .map(
            (c, i) => `<li ${b('entry', { key: c.id })}><a ${b('link', { key: c.id })} href="#${bem('collection', c.id).id()}"${i === 0 ? ' aria-current="location"' : ''}>
          <span ${b('label', { key: c.id })}>${esc(i18n.loc(c.name))}</span><span ${b('count', { key: c.id })}>${c.items.length}</span>
        </a></li>`,
          )
          .join('')}
      </ol>
    </nav>
    ${summary(ctx, b)}
  </aside>
  <div ${b('groups')}>
    ${cols
      .map((c, i) =>
        collection(ctx, {
          id: c.id,
          variant: 'group',
          mods: { [`head-${headSpan(c.items.length, 3)}`]: true, [`head-tablet-${headSpan(c.items.length, 2)}`]: true },
          title: i18n.loc(c.name),
          intro: c.intro && i18n.loc(c.intro),
          count: i18n.pieces(c.items.length),
          priority: i === 0,
          items: c.items.map((it) => ({ product: catalog.product(it.product), seed: { finish: it.finish, height: it.height } })),
        }),
      )
      .join('')}
  </div>
</fw-shop>`;
}
