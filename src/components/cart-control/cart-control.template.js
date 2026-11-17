import { bem, esc } from '../../js/bem.js';

export function cartControl({ i18n }, { key, name, instance, variant = 'card', qty = 0, stock = null }) {
  const b = bem('cart-control', instance);
  const t = (k) => esc(i18n.t(`cartControl.${k}`, { name }));
  const soldOut = stock === 0;
  const canAdd = variant === 'card' || variant === 'hero' || variant === 'detail';
  const addText = variant === 'card' ? t('add') : t('addToCart');
  const addLabel = soldOut ? esc(i18n.t('common.soldOut')) : `<span ${b('add-text')}>${addText}</span><span ${b('add-icon', { cls: 'button__icon button__icon--accent' })} aria-hidden="true">+</span>`;
  const min = canAdd ? '' : ` data-min="${variant === 'row' ? 1 : 0}"`;
  const step = canAdd ? 'stepper__button hit' : 'stepper__button';
  const stockData = stock == null ? '' : ` data-stock="${stock}" data-label-sold-out="${esc(i18n.t('common.soldOut'))}" data-label-sold-out-named="${t('soldOutNamed')}"`;
  return `<fw-cart-control ${b('', { mods: { [variant]: true, addable: canAdd } })} data-key="${esc(key)}"${min} data-label-less="${t('oneLess')}" data-label-remove="${t('remove')}"${stockData}>
  ${canAdd ? `<button ${b('add', { cls: 'link hit' })} type="button" aria-label="${t(soldOut ? 'soldOutNamed' : 'addNamed')}"${soldOut ? ' disabled' : ''}${qty ? ' hidden' : ''}>${addLabel}</button>` : ''}
  <div ${b('stepper', { cls: 'stepper' })}${canAdd && !qty ? ' hidden' : ''}>
    ${canAdd ? `<span ${b('in-cart')}>${t('inCart')}</span>` : ''}
    <button ${b('dec', { cls: step })} type="button" aria-label="${t('oneLess')}">−</button>
    <span ${b('qty', { cls: 'stepper__value' })} aria-live="polite">${qty}</span>
    <button ${b('inc', { cls: step })} type="button" aria-label="${t('oneMore')}">+</button>
  </div>
</fw-cart-control>`;
}
