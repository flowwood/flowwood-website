import { bem, esc } from '../../js/bem.js';

const b = bem('order');

export function order({ site, catalog, i18n }) {
  const t = (key, vars) => esc(i18n.t(`order.${key}`, vars));
  const [from, to] = catalog.data.delivery.weeks;
  const { phone, email } = site.contact;
  const action = (key, route, label) => `<a ${b('action', { key, cls: 'button button--primary' })} href="${i18n.url(route)}">${label} <span ${b('action-icon', { key, cls: 'button__icon button__icon--accent' })} aria-hidden="true">→</span></a>`;
  const state = (key, body, extra = '') => `<div ${b('state', { key })} data-state="${key}"${key === 'checking' ? '' : ' hidden'}>
      <p ${b('lead', { key })}>${t(`${key}Lead`)}</p>
      <p ${b('body', { key })}>${body}</p>
      ${extra}
    </div>`;
  return `<fw-order ${b()}>
  <h1 ${b('title')}>${t('title')}</h1>
  <div ${b('states')} aria-live="polite">
    ${state('checking', t('checkingBody'))}
    ${state('paid', t('paidBody', { from, to }), action('shop', 'shop', t('shop')))}
    ${state('pending', t('pendingBody'))}
    ${state('closed', t('closedBody'), action('checkout', 'checkout', t('retry')))}
  </div>
  <p ${b('help')}>${t('help')} <a ${b('help-link', { key: 'phone' })} href="tel:${esc(phone.replace(/\s/g, ''))}">${esc(phone)}</a> · <a ${b('help-link', { key: 'email' })} href="mailto:${esc(email)}">${esc(email)}</a></p>
</fw-order>`;
}
