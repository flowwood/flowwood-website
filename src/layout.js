import { bem, esc } from './js/bem.js';
import { menuBar } from './components/menu-bar/menu-bar.template.js';
import { footer } from './components/footer/footer.template.js';
import { customSize } from './components/custom-size/custom-size.template.js';

const ICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#1f1e1c"/><path d="M8 24V8h8M8 15.5h6" fill="none" stroke="#fdfdfc" stroke-width="3.2"/><path d="M16.5 15l2.4 8.5 2.4-6.5 2.4 6.5 2.4-8.5" fill="none" stroke="#e0703a" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/></svg>')}`;

const localizedMeta = (i18n, meta) => ({ title: i18n.loc(meta.title), description: i18n.loc(meta.description) });

export function layout(ctx, page) {
  const { site, i18n, locale } = ctx;
  const meta = typeof page.meta === 'function' ? page.meta(ctx) : localizedMeta(i18n, site.meta[page.meta || page.route]);
  const b = bem('app');
  const lcp = page.lcp?.(ctx);
  return `<!doctype html>
<html lang="${site.locales[locale].lang}" data-locale="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.description)}">
<meta name="theme-color" content="#1f1e1c">
<link rel="icon" href="${ICON}">
${page.index === false ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${site.origin}${i18n.url(page.route, locale, ctx.item)}">`}
${i18n
  .alternates(page.route, ctx.item)
  .map((a) => `<link rel="alternate" hreflang="${a.lang}" href="${site.origin}${a.href}">`)
  .join('\n')}
<link rel="alternate" hreflang="x-default" href="${site.origin}${site.basePath}/">
${meta.jsonLd ? `<script type="application/ld+json">${JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
<!--fonts-->
${lcp ? `<link rel="preload" as="image" href="${esc(lcp.src)}" fetchpriority="high">` : ''}
<!--head-->
</head>
<body ${b()} data-path="">
<a ${b('skip', { cls: 'visually-hidden' })} href="#app__main">${esc(i18n.t('menuBar.skip'))}</a>
${menuBar(ctx)}
<main ${b('main')} tabindex="-1">
${page.render(ctx)}
</main>
${footer(ctx)}
${page.customSize ? customSize(ctx) : ''}
</body>
</html>`;
}
