import { bem, esc, img } from '../../js/bem.js';
import { swatches } from '../product-card/product-card.template.js';

export const customSize = () => `<dialog ${bem('custom-size')()}></dialog>`;

export function customSizeBody({ i18n, catalog }, { product: p, config: c }) {
  const b = bem('custom-size');
  const t = (k, vars) => esc(i18n.t(`customSize.${k}`, vars));
  const cs = catalog.customSize;
  const finish = esc(i18n.loc(catalog.finish(p, c.finish).name));

  const field = (dim, range, label) => {
    const raw = c.custom[dim];
    const l = i18n.t(`customSize.${label}`);
    const lower = l.toLowerCase();
    const ok = catalog.inRange(raw, range);
    return `<div ${b('field', { key: dim, mods: { invalid: !ok } })}>
  <div ${b('field-head', { key: dim })}>
    <label ${b('label', { key: dim, cls: 'eyebrow' })} for="${b.id('input', dim)}">${esc(l)}</label>
    <span ${b('range', { key: dim })}>${range.min}–${range.max} ${esc(i18n.t('common.cm'))}</span>
  </div>
  <div ${b('stepper', { key: dim, cls: 'stepper' })}>
    <button ${b('step', { key: `${dim}-down`, cls: 'stepper__button' })} type="button" data-dim="${dim}" data-step="-1" aria-label="${t('less', { label: lower })}">−</button>
    <input ${b('input', { key: dim })} data-dim="${dim}" value="${esc(raw)}" inputmode="numeric" autocomplete="off" aria-invalid="${!ok}" aria-label="${t('inCm', { label: l })}">
    <button ${b('step', { key: `${dim}-up`, cls: 'stepper__button' })} type="button" data-dim="${dim}" data-step="1" aria-label="${t('more', { label: lower })}">+</button>
  </div>
</div>`;
  };

  return `<div ${b('panel')}>
  <div ${b('head')}>
    <span ${b('title', { cls: 'eyebrow' })}>${t('title')}</span>
    <button ${b('close', { cls: 'button button--icon hit' })} type="button" data-close aria-label="${esc(i18n.t('common.close'))}">×</button>
  </div>
  <div ${b('product')}>
    <div ${b('media', { cls: 'media' })}>${img(p.image, { attrs: b('image'), alt: p.name })}</div>
    <div ${b('titles')}>
      <span ${b('name', { cls: 'product-name' })}>${esc(p.name)}</span>
      <span ${b('finish', { key: 'product' })}>${finish}</span>
    </div>
  </div>
  <div ${b('material')}>
    <div ${b('material-head')}>
      <span ${b('material-label', { cls: 'eyebrow' })}>${t('material')}</span>
      <span ${b('finish', { key: 'material' })}>${finish}</span>
    </div>
    <div ${b('swatches')} role="group" aria-label="${t('material')}">
      ${swatches(i18n, b, p, c.finish, true)}
    </div>
  </div>
  ${field('h', cs.height, 'height')}
  ${field('w', cs.width, 'width')}
  <dl ${b('summary')}>
    <div ${b('row', { key: 'size' })}><dt ${b('term', { key: 'size' })}>${t('size')}</dt><dd ${b('dims')}>${esc(catalog.outerDimensions(p, catalog.customDims(c)))}</dd></div>
    <div ${b('row', { key: 'delivery' })}><dt ${b('term', { key: 'delivery' })}>${t('delivery')}</dt><dd ${b('lead')}>${t('leadTime')}</dd></div>
  </dl>
  <div ${b('actions')}>
    <div ${b('total')}>
      <span ${b('price-label', { cls: 'eyebrow' })}>${t('price')}</span>
      <span ${b('price', { cls: 'figure' })} aria-live="polite">${esc(i18n.money(catalog.price(c)))}</span>
    </div>
    <button ${b('add', { cls: 'button button--primary' })} type="button" data-add>${t('add')}<span ${b('add-icon', { cls: 'button__icon button__icon--accent' })} aria-hidden="true">+</span></button>
    <button ${b('later', { cls: 'hit' })} type="button" data-close>${t('later')}</button>
  </div>
</div>`;
}
