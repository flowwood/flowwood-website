import { bem, esc } from '../../js/bem.js';

function placeholders({ site, catalog, i18n }) {
  const { delivery } = catalog.data;
  const [from, to] = delivery.weeks;
  return {
    ...site.contact,
    countries: i18n.countries(delivery.countries),
    from,
    to,
    submit: i18n.t('checkout.submit'),
    remember: i18n.t('checkout.remember'),
    forget: i18n.t('checkout.forget'),
  };
}

const longDate = (lang, iso) => new Intl.DateTimeFormat(lang, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

function legalSections(ctx, route) {
  const vars = placeholders(ctx);
  return ctx.site.legal[route].sections.map((s) => ({ title: ctx.i18n.text(s.title), body: ctx.i18n.text(s.body, vars), list: s.list && ctx.i18n.text(s.list, vars) }));
}

export function legalText(ctx, route) {
  const { site, i18n, locale } = ctx;
  const doc = site.legal[route];
  const sections = legalSections(ctx, route).map(({ title, body: [first, ...rest], list }, i) => {
    const paragraphs = list ? [first, list.map((item) => `- ${item}`).join('\n'), ...rest] : [first, ...rest];
    return `${i + 1}. ${title.toUpperCase()}\n\n${paragraphs.join('\n\n')}`;
  });
  const updated = i18n.t('legal.updated', { date: longDate(site.locales[locale].lang, doc.updated) });
  return [`${i18n.text(doc.title).toUpperCase()}\n${updated}`, ...sections].join('\n\n');
}

export function legal(ctx, route) {
  const { site, i18n, locale } = ctx;
  const doc = site.legal[route];
  const b = bem('legal');
  const sections = legalSections(ctx, route);

  const paragraphs = (lines, key) => lines.map((p, n) => `<p ${b('text', { key: `${key}-${n}` })}>${esc(p)}</p>`).join('');
  const list = (items, key) => `<ul ${b('list', { key })}>${items.map((li, n) => `<li ${b('item', { key: `${key}-${n}` })}>${esc(li)}</li>`).join('')}</ul>`;
  const section = ({ title, body, list: items }, i) => {
    const [first, ...rest] = body;
    return `<section ${b('section', { key: i + 1 })} aria-labelledby="${b.id('heading', i + 1)}">
      <h2 ${b('heading', { key: i + 1 })}>${esc(title)}</h2>
      ${items ? paragraphs([first], `${i + 1}-a`) + list(items, i + 1) + paragraphs(rest, `${i + 1}-b`) : paragraphs(body, i + 1)}
    </section>`;
  };

  return `<article ${b()} aria-labelledby="${b.id('title')}">
  <header ${b('head')}>
    <p ${b('eyebrow', { cls: 'eyebrow' })}>${esc(site.name)}</p>
    <h1 ${b('title')}>${esc(i18n.text(doc.title))}</h1>
    <p ${b('updated')}>${esc(i18n.t('legal.updated')).replace('{date}', `<time ${b('date')} datetime="${esc(doc.updated)}">${esc(longDate(site.locales[locale].lang, doc.updated))}</time>`)}</p>
  </header>
  <nav ${b('contents')} aria-labelledby="${b.id('contents-title')}">
    <h2 ${b('contents-title', { cls: 'eyebrow' })}>${esc(i18n.t('legal.contents'))}</h2>
    <ol ${b('toc')}>
      ${sections.map((s, i) => `<li ${b('toc-item', { key: i + 1 })}><a ${b('toc-link', { key: i + 1, cls: 'hit' })} href="#${b.id('section', i + 1)}">${esc(s.title)}</a></li>`).join('')}
    </ol>
  </nav>
  <div ${b('body')}>
    ${sections.map(section).join('')}
  </div>
</article>`;
}
