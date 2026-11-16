import { bem, esc } from '../../js/bem.js';

export function cartControl({ i18n }, { key, name, instance, variant = 'card', qty = 0 }) {
  const b = bem('cart-control', instance);
  const t = (k) => esc(i18n.t(`cartControl.${k}`, { name }));
  const canAdd = variant === 'card' || variant === 'hero' || variant === 'detail';
  const addText = variant === 'card' ? t('add') : t('addToCart');
  const min = canAdd ? '' : ` data-min="${variant === 'row' ? 1 : 0}"`;
  const step = canAdd ? 'stepper__button hit' : 'stepper__button';
  return `<fw-cart-control ${b('', { mods: { [variant]: true, addable: canAdd } })} data-key="${esc(key)}"${min} data-label-less="${t('oneLess')}" data-label-remove="${t('remove')}">
  ${canAdd ? `<button ${b('add', { cls: 'link' })} type="button" aria-label="${t('addNamed')}"${qty ? ' hidden' : ''}><span ${b('add-text')}>${addText}</span><span ${b('add-icon', { cls: 'button__icon button__icon--accent' })} aria-hidden="true">+</span></button>` : ''}
  <div ${b('stepper', { cls: 'stepper' })}${canAdd && !qty ? ' hidden' : ''}>
    ${canAdd ? `<span ${b('in-cart')}>${t('inCart')}</span>` : ''}
    <button ${b('dec', { cls: step })} type="button" aria-label="${t('oneLess')}">−</button>
    <span ${b('qty', { cls: 'stepper__value' })} aria-live="polite">${qty}</span>
    <button ${b('inc', { cls: step })} type="button" aria-label="${t('oneMore')}">+</button>
  </div>
</fw-cart-control>`;
}
