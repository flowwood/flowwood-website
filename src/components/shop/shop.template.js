import { bem, esc, img } from '../../js/bem.js';
import { collection } from '../collection/collection.template.js';

const SORTS = ['featured', 'priceAsc', 'priceDesc'];

export const breadcrumb = (b, i18n, links, current) => `<nav ${b('breadcrumb', { cls: 'breadcrumb' })} aria-label="${esc(i18n.t('shop.breadcrumb'))}">
      ${links.map((l) => `<a ${b('crumb', { key: l.key, cls: 'breadcrumb__link hit' })} href="${l.href}">${esc(l.label)}</a><span ${b('crumb-separator', { key: l.key })} aria-hidden="true">/</span>`).join('')}
      <span ${b('crumb', { key: 'current', cls: 'breadcrumb__current' })} aria-current="page">${esc(current)}</span>
    </nav>`;

export function shop(ctx) {
  const { site, catalog, i18n } = ctx;
  const b = bem('shop');
  const t = (k) => esc(i18n.t(`shop.${k}`));
  const cols = catalog.data.collections;
  const total = cols.reduce((n, c) => n + c.items.length, 0);

  const filter = (key, label, image, n, on) =>
    `<button ${b('filter', { key, cls: 'marker' })} type="button" data-filter="${key === 'all' ? '' : esc(key)}" data-count="${n}" aria-pressed="${on}">
      <span ${b('thumb', { key, cls: 'media' })}>${img(image, { attrs: b('thumb-image', { key }) })}</span>
      <span ${b('label', { key, cls: 'eyebrow' })}>${esc(label)}<span ${b('n', { key })}>${n}</span></span>
    </button>`;

  return `<fw-shop ${b()}>
  <div ${b('head')}>
    ${breadcrumb(b, i18n, [{ key: 'home', href: i18n.url('home'), label: i18n.t('menuBar.home') }], i18n.t('shop.title'))}
    <div ${b('heading')}>
      <h1 ${b('title')}>${t('title')}</h1>
      <span ${b('count')}>${esc(i18n.pieces(total))}</span>
    </div>
  </div>
  <div ${b('bar')}>
    <div ${b('rail')} role="group" aria-label="${t('filter')}">
      ${filter('all', i18n.t('shop.all'), site.shop.allImage, total, true)}
      ${cols.map((c) => filter(c.id, i18n.loc(c.name), catalog.product(c.items[0].product).image, c.items.length, false)).join('')}
    </div>
    <div ${b('sort')}>
      <button ${b('sort-button', { cls: 'eyebrow popover-trigger' })} type="button" popovertarget="${b.id('sorts')}" aria-haspopup="listbox">
        <span ${b('sort-text')}>${t('sort')}</span>
        <span ${b('sort-label', { cls: 'visually-hidden--mobile' })}>${t('sortFeatured')}</span>
      </button>
      <div ${b('sorts', { cls: 'popover' })} popover role="listbox" aria-label="${t('sort')}">
        ${SORTS.map((s) => `<button ${b('sort-option', { key: s, cls: 'popover__option' })} type="button" role="option" data-sort="${s}" aria-selected="${s === 'featured'}">${t(`sort${s[0].toUpperCase()}${s.slice(1)}`)}</button>`).join('')}
      </div>
    </div>
  </div>
  <div ${b('groups')}>
    ${cols
      .map((c, i) =>
        collection(ctx, {
          id: c.id,
          variant: 'group',
          title: i18n.loc(c.name),
          count: i18n.pieces(c.items.length),
          priority: i === 0,
          items: c.items.map((it) => ({ product: catalog.product(it.product), seed: { finish: it.finish, height: it.height } })),
        }),
      )
      .join('')}
  </div>
</fw-shop>`;
}
