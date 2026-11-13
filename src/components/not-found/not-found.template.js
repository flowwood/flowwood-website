import { bem, esc } from '../../js/bem.js';

export function notFound({ i18n }) {
  const b = bem('not-found');
  return `<section ${b()}>
  <h1 ${b('title')}>${esc(i18n.t('notFound.title'))}</h1>
  <a ${b('home', { cls: 'button button--primary' })} href="${i18n.url('home')}">${esc(i18n.t('notFound.home'))} <span ${b('home-icon', { cls: 'button__icon' })} aria-hidden="true">→</span></a>
</section>`;
}
