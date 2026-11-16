import { bem, esc } from '../../js/bem.js';
import { field } from '../field/field.template.js';

export function contact(ctx) {
  const { site, i18n } = ctx;
  const b = bem('contact');
  const t = (k) => esc(i18n.t(`contact.${k}`));
  const { phone, email } = site.contact;
  const signature = site.home.signature;

  const channel = (key, href, value) => `<li ${b('channel', { key })}>
      <a ${b('channel-link', { key })} href="${esc(href)}">
        <span ${b('channel-label', { key, cls: 'eyebrow' })}>${esc(i18n.t(`field.${key}`))}</span>
        <span ${b('channel-value', { key })}>${esc(value)}</span>
        <span ${b('channel-action', { key })}>${t(`${key}Action`)} <span ${b('channel-arrow', { key })} aria-hidden="true">→</span></span>
      </a>
    </li>`;

  const status = (outcome, content) => `<p ${b('status', { key: outcome, mods: { [outcome]: true } })} tabindex="-1">${content}</p>`;

  return `<fw-contact ${b()} data-sending="${t('sending')}">
  <div ${b('intro')}>
    <div ${b('intro-text')}>
      <p ${b('eyebrow', { cls: 'eyebrow' })}>${esc(i18n.t('footer.contact'))}</p>
      <h1 ${b('title')}>${t('title')}</h1>
      <p ${b('lead')}>${t('intro')}</p>
    </div>
    <ul ${b('channels')}>
      ${channel('phone', `tel:${phone.replace(/\s/g, '')}`, phone)}
      ${channel('email', `mailto:${email}`, email)}
    </ul>
    <figure ${b('signature')}>
      <div ${b('signature-mark')} role="img" aria-label="${esc(i18n.t('brand.signature'))}" style="--signature:url('${esc(signature.src)}');aspect-ratio:${signature.width} / ${signature.height}"></div>
      <figcaption ${b('founder')}>${esc(i18n.t('brand.founder'))}</figcaption>
    </figure>
  </div>
  <form ${b('form')} method="post" action="${site.basePath}/api/contact">
    <div ${b('form-head')}>
      <h2 ${b('form-title')}>${t('formTitle')}</h2>
      <p ${b('required-note')}><span ${b('required')} aria-hidden="true">*</span> ${esc(i18n.t('field.requiredNote'))}</p>
    </div>
    ${field(ctx, { form: 'contact', name: 'name', label: i18n.t('field.name'), error: i18n.t('field.nameError'), autocomplete: 'name', attrs: ' autocapitalize="words"' })}
    ${field(ctx, { form: 'contact', name: 'email', label: i18n.t('field.email'), error: i18n.t('field.emailError'), type: 'email', autocomplete: 'email', attrs: ' spellcheck="false" autocapitalize="off"' })}
    ${field(ctx, { form: 'contact', name: 'phone', label: i18n.t('field.phone'), hint: i18n.t('contact.phoneHint'), type: 'tel', autocomplete: 'tel', optional: true })}
    ${field(ctx, { form: 'contact', name: 'message', label: i18n.t('contact.message'), hint: i18n.t('contact.messageHint'), error: i18n.t('contact.messageError'), type: 'textarea' })}
    <div ${b('honeypot', { cls: 'visually-hidden' })} aria-hidden="true">
      <label ${b('honeypot-label')} for="${b.id('honeypot-input')}">${t('honeypot')}</label>
      <input ${b('honeypot-input')} name="website" type="text" tabindex="-1" autocomplete="off">
    </div>
    <input ${b('back')} name="back" type="hidden" value="${i18n.url('contact')}">
    ${status('sent', t('sent'))}
    ${status('failed', `${t('failed')} <a ${b('failed-email')} href="mailto:${esc(email)}">${esc(email)}</a>`)}
    <div ${b('actions')}>
      <button ${b('submit', { cls: 'button button--primary' })} type="submit"><span ${b('submit-label')}>${t('submit')}</span> <span ${b('submit-icon', { cls: 'button__icon button__icon--accent' })} aria-hidden="true">→</span></button>
      <p ${b('privacy')}>${t('privacy')}</p>
    </div>
  </form>
</fw-contact>`;
}
