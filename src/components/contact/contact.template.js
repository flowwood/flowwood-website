import { bem, esc } from '../../js/bem.js';

export function contact({ site, i18n }) {
  const b = bem('contact');
  const t = (k) => esc(i18n.t(`contact.${k}`));
  const { phone, email, limits } = site.contact;
  const signature = site.home.signature;

  const channel = (key, href, value) => `<li ${b('channel', { key })}>
      <a ${b('channel-link', { key })} href="${href}">
        <span ${b('channel-label', { key, cls: 'eyebrow' })}>${t(key)}</span>
        <span ${b('channel-value', { key })}>${esc(value)}</span>
        <span ${b('channel-action', { key })}>${t(`${key}Action`)} <span ${b('channel-arrow', { key })} aria-hidden="true">→</span></span>
      </a>
    </li>`;

  const marker = (name, optional) =>
    optional
      ? ` <span ${b('optional', { key: name })}>(${t('optional')})</span>`
      : `<span ${b('required', { key: name })} aria-hidden="true">*</span>`;

  function control(name, { type, autocomplete, optional, hint, error, attrs = '' }) {
    const hintId = hint ? b.id('hint', name) : '';
    const notes = `${hint ? ` aria-describedby="${hintId}" data-hint="${hintId}"` : ''}${error ? ` data-error="${b.id('error', name)}"` : ''}`;
    const shared = `name="${name}" maxlength="${limits[name]}"${optional ? '' : ' required'}${notes}`;
    if (type === 'textarea') return `<textarea ${b('input', { key: name, mods: { multiline: true } })} ${shared} rows="5"></textarea>`;
    return `<input ${b('input', { key: name })} ${shared} type="${type}" autocomplete="${autocomplete}"${attrs}>`;
  }

  const field = (name, options) => `<div ${b('field', { key: name })}>
      <label ${b('label', { key: name })} for="${b.id('input', name)}">${t(name)}${marker(name, options.optional)}</label>
      ${options.hint ? `<p ${b('hint', { key: name })}>${t(`${name}Hint`)}</p>` : ''}
      <div ${b('control', { key: name })}>${control(name, options)}<span ${b('check', { key: name })} aria-hidden="true"></span></div>
      ${options.error ? `<p ${b('error', { key: name })}>${t(`${name}Error`)}</p>` : ''}
    </div>`;

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
      <p ${b('required-note')}><span ${b('required', { key: 'note' })} aria-hidden="true">*</span> ${t('requiredNote')}</p>
    </div>
    ${field('name', { type: 'text', autocomplete: 'name', error: true, attrs: ' autocapitalize="words"' })}
    ${field('email', { type: 'email', autocomplete: 'email', error: true, attrs: ' spellcheck="false" autocapitalize="off"' })}
    ${field('phone', { type: 'tel', autocomplete: 'tel', optional: true, hint: true })}
    ${field('message', { type: 'textarea', hint: true, error: true })}
    <div ${b('honeypot', { cls: 'visually-hidden' })} aria-hidden="true">
      <label ${b('honeypot-label')} for="${b.id('honeypot-input')}">${t('honeypot')}</label>
      <input ${b('honeypot-input')} name="website" type="text" tabindex="-1" autocomplete="off">
    </div>
    <input ${b('back')} name="back" type="hidden" value="${i18n.url('contact')}">
    ${status('sent', t('sent'))}
    ${status('failed', `${t('failed')} <a ${b('failed-email')} href="mailto:${email}">${esc(email)}</a>`)}
    <div ${b('actions')}>
      <button ${b('submit', { cls: 'button button--primary' })} type="submit"><span ${b('submit-label')}>${t('submit')}</span> <span ${b('submit-icon', { cls: 'button__icon button__icon--accent' })} aria-hidden="true">→</span></button>
      <p ${b('privacy')}>${t('privacy')}</p>
    </div>
  </form>
</fw-contact>`;
}
