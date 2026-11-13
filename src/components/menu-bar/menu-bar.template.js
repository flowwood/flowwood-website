import { bem, esc } from '../../js/bem.js';

const bag = (b) =>
  `<svg ${b('cart-icon')} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path ${b('cart-icon-body')} d="M5 8h14l-1 12H6z"></path><path ${b('cart-icon-handle')} d="M9 8V6a3 3 0 0 1 6 0v2"></path></svg>`;

export function menuBar({ site, i18n, locale, route, current }) {
  const b = bem('menu-bar');
  const t = (k) => esc(i18n.t(`menuBar.${k}`));
  const isCurrent = (on) => (on ? ' aria-current="page"' : '');
  return `<fw-menu-bar ${b()} role="banner">
  <span ${b('spacer')}></span>
  <div ${b('inner', { cls: 'eyebrow' })}>
    <nav ${b('nav')} aria-label="${t('navigation')}">
      ${site.navigation.map((r) => `<a ${b('link', { key: r, cls: 'marker' })} href="${i18n.url(r)}"${isCurrent(r === current)}>${t(r)}</a>`).join('')}
    </nav>
    <div ${b('actions')}>
      <button ${b('language', { cls: 'eyebrow popover-trigger' })} type="button" popovertarget="${b.id('languages')}" aria-label="${t('language')}">${esc(site.locales[locale].code)}</button>
      <div ${b('languages', { cls: 'popover' })} popover>
        ${i18n
          .alternates(route)
          .map((a) => `<a ${b('language-option', { key: a.locale, cls: 'popover__option' })} href="${a.href}" hreflang="${a.lang}" lang="${a.lang}"${isCurrent(a.locale === locale)}>${esc(a.label)}<span ${b('language-code', { key: a.locale })}>${esc(a.code)}</span></a>`)
          .join('')}
      </div>
      <a ${b('cart', { cls: 'marker' })} href="${i18n.url('cart')}" aria-label="${t('cart')}" title="${t('cart')}"${isCurrent(current === 'cart')}>${bag(b)}<span ${b('badge')} hidden></span></a>
    </div>
  </div>
</fw-menu-bar>`;
}
