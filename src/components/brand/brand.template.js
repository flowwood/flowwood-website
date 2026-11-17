import { bem, esc, img } from '../../js/bem.js';

export function brand({ site, i18n }, { headingLevel = 2 } = {}) {
  const b = bem('brand');
  const t = (k, vars) => esc(i18n.t(`brand.${k}`, vars));
  const h = `h${headingLevel}`;
  const sig = site.home.signature;
  const cells = Array.from({ length: site.home.partners }, (_, i) => i + 1);
  return `<section ${b()} aria-labelledby="${b.id('title')}">
  <div ${b('intro')}>
    <div ${b('copy')}>
      <p ${b('eyebrow', { cls: 'eyebrow' })}>${esc(i18n.t('menuBar.about'))}</p>
      <${h} ${b('title')}>${t('title')}</${h}>
      ${i18n.t('brand.body').map((p, i) => `<p ${b('text', { key: i })}>${esc(p)}</p>`).join('')}
      <a ${b('cta', { cls: 'link hit' })} href="#">${t('cta')} <span ${b('cta-arrow')} aria-hidden="true">→</span></a>
    </div>
    <div ${b('media', { cls: 'media' })}>${img(site.home.brandImage, { attrs: b('image'), alt: i18n.t('brand.imageAlt'), priority: headingLevel === 1 })}</div>
  </div>
  <div ${b('partners')}>
    <p ${b('lead')}>${t('partnersLead')}</p>
    <ul ${b('logos')}>
      ${cells.map((n) => `<li ${b('logo', { key: n })}>${t('partner', { n })}</li>`).join('')}
    </ul>
  </div>
  <div ${b('closing')}>
    <p ${b('statement')}>${i18n
      .t('brand.statement')
      .map((s, i) => (i % 2 ? `<span ${b('highlight', { key: i })}>${esc(s)}</span>` : esc(s)))
      .join('')}</p>
    <figure ${b('signature')}>
      <div ${b('signature-mark')} role="img" aria-label="${t('signature')}" style="--signature:url('${esc(sig.src)}');aspect-ratio:${sig.width} / ${sig.height}"></div>
      <figcaption ${b('founder')}>${t('founder')}</figcaption>
    </figure>
  </div>
</section>`;
}

export function samples({ i18n }) {
  const b = bem('brand');
  const t = (k) => esc(i18n.t(`samples.${k}`));
  const column = (key, variant, href) => `<div ${b('sample', { key })}>
    <h3 ${b('sample-title', { key })}>${t(`${key}Title`)}</h3>
    <p ${b('sample-text', { key })}>${t(`${key}Body`)}</p>
    <a ${b('sample-cta', { key, cls: `button button--${variant}` })} href="${href}">${t(`${key}Cta`)} <span ${b('sample-arrow', { key, cls: 'button__icon' })} aria-hidden="true">→</span></a>
  </div>`;
  return `<section ${b('samples')}>
  ${column('samples', 'primary', '#')}
  ${column('bespoke', 'outline', i18n.url('contact'))}
</section>`;
}
