import { bem, esc } from '../../js/bem.js';

const SOCIAL_ICONS = {
  instagram: { paint: 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"', d: 'M7 2.5h10A4.5 4.5 0 0 1 21.5 7v10a4.5 4.5 0 0 1-4.5 4.5H7A4.5 4.5 0 0 1 2.5 17V7A4.5 4.5 0 0 1 7 2.5zM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM17.5 6.5h.01' },
  facebook: { paint: 'fill="currentColor"', d: 'M13.5 21.5v-8h2.7l.4-3.2h-3.1V8.3c0-.9.3-1.5 1.6-1.5h1.7V4a22 22 0 0 0-2.5-.1c-2.5 0-4.1 1.5-4.1 4.2v2.3H7.4v3.2h2.8v8z' },
};

export function footer({ site, i18n }) {
  const b = bem('footer');
  const t = (k) => esc(i18n.t(`footer.${k}`));
  const hrefOf = (link) => (link.route ? i18n.url(link.route) : esc(link.href));
  const external = (href) => (/^https?:/.test(href) ? ' rel="noopener" target="_blank"' : '');
  return `<footer ${b()}>
  <div ${b('brand')}><a ${b('wordmark', { cls: 'hit' })} href="${i18n.url('home')}">${esc(site.name)}</a></div>
  <div ${b('inner')}>
    <div ${b('links')}>
      <span ${b('rights')}>${t('rights')}</span>
      ${site.footerLinks.map((l) => `<a ${b('link', { key: l.id, cls: 'hit' })} href="${hrefOf(l)}"${external(hrefOf(l))}>${t(l.id)}</a>`).join('')}
    </div>
    <nav ${b('socials')} aria-label="${t('socials')}">
      ${site.socials.map((s) => `<a ${b('social', { key: s.id, cls: 'hit' })} href="${esc(s.href)}"${external(s.href)} aria-label="${t(s.id)}" title="${t(s.id)}"><svg ${b('social-icon', { key: s.id })} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path ${b('social-glyph', { key: s.id })} ${SOCIAL_ICONS[s.id].paint} d="${SOCIAL_ICONS[s.id].d}"/></svg></a>`).join('')}
    </nav>
    <a ${b('top', { cls: 'eyebrow hit' })} href="#app">${t('top')} <span ${b('top-icon')} aria-hidden="true">↑</span></a>
  </div>
</footer>`;
}
