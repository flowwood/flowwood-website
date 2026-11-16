import { bem, esc, img } from '../../js/bem.js';
import { describe } from '../../js/catalog.js';
import { field } from '../field/field.template.js';

const b = bem('checkout');
const FORM = 'checkout';

const hrefOf = (i18n, link) => (link.route ? i18n.url(link.route) : esc(link.href));

function countryOptions({ site, catalog, i18n, locale }) {
  const names = new Intl.DisplayNames([site.locales[locale].lang], { type: 'region' });
  return catalog.data.delivery.countries.map((c, i) => ({
    value: c.code,
    label: names.of(c.code),
    selected: i === 0,
    attrs: ` data-postcode="${esc(c.postcode)}" data-postcode-error="${esc(i18n.t('checkout.postcodeError', { example: c.example }))}"`,
  }));
}

function address(ctx, { prefix, section }) {
  const { i18n, catalog } = ctx;
  const t = (k, vars) => i18n.t(`checkout.${k}`, vars);
  const [home] = catalog.data.delivery.countries;
  const f = (name, options) => field(ctx, { form: FORM, name: `${prefix}${name}`, ...options });
  const auto = (token) => `${section} ${token}`;
  const line2 = prefix
    ? ''
    : `<details ${b('more', { key: 'address2' })}>
        <summary ${b('more-toggle', { key: 'address2', cls: 'hit' })}><span ${b('more-icon', { key: 'address2' })} aria-hidden="true">+</span> ${esc(t('address2Toggle'))}</summary>
        ${f('address2', { label: t('address2'), autocomplete: auto('address-line2'), optional: true, limit: 'address' })}
      </details>`;
  const pair = (key, ...fields) => `<div ${b('pair', { key: `${prefix}${key}`, mods: { [key]: true } })}>${fields.join('')}</div>`;
  return [
    f('name', { label: i18n.t('field.name'), error: i18n.t('field.nameError'), autocomplete: auto('name'), limit: 'name', attrs: ' autocapitalize="words"' }),
    f('address', {
      label: t('address'),
      error: t('addressError'),
      autocomplete: auto('address-line1'),
      limit: 'address',
      attrs: ` role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${b.id('suggestions', section)}" data-suggest="${prefix}"`,
      extra: `<ul ${b('suggestions', { key: section })} role="listbox" aria-label="${esc(t('suggestions'))}" hidden></ul>`,
    }),
    line2,
    pair(
      'place',
      f('postcode', {
      label: t('postcode'),
      error: t('postcodeError', { example: home.example }),
      autocomplete: auto('postal-code'),
      limit: 'postcode',
      attrs: ` pattern="${esc(home.postcode)}" autocapitalize="characters" spellcheck="false"`,
      }),
      f('city', { label: t('city'), error: t('cityError'), autocomplete: auto('address-level2'), limit: 'city' }),
    ),
    f('country', { label: t('country'), hint: prefix ? '' : t('countryHint'), type: 'select', autocomplete: auto('country'), options: countryOptions(ctx), attrs: ' data-country' }),
    `<p ${b('verify', { key: section })} data-verify="${prefix}" aria-live="polite"><span ${b('verify-text', { key: section })}></span> <button ${b('keep', { key: section, cls: 'hit' })} type="button" data-keep="${prefix}" hidden>${esc(t('keepAddress'))}</button></p>`,
  ].join('');
}

const section = (key, title, content) => `<fieldset ${b('section', { key })}>
    <legend ${b('legend', { key })}>${esc(title)}</legend>
    <div ${b('fields', { key })}>${content}</div>
  </fieldset>`;

const option = (key, { name, label, checked = false, hint = '' }) => `<label ${b('option', { key, mods: { [key]: true } })}>
      <input ${b('checkbox', { key })} type="checkbox" name="${name}"${checked ? ' checked' : ''}${hint ? ` aria-describedby="${b.id('option-hint', key)}"` : ''}>
      <span ${b('option-text', { key })}>${esc(label)}${hint ? `<span ${b('option-hint', { key })}>${esc(hint)}</span>` : ''}</span>
    </label>`;

function summary({ catalog, i18n }) {
  const t = (k) => esc(i18n.t(`checkout.${k}`));
  const { price } = catalog.data.delivery;
  const row = (key, label, value) => `<div ${b('total-row', { key, mods: { [key]: true } })}><dt ${b('total-label', { key })}>${label}</dt><dd ${b('total-value', { key, cls: 'figure' })}${value === null ? ` data-${key}` : ''}>${value ?? ''}</dd></div>`;
  return `<aside ${b('aside')} aria-labelledby="${b.id('summary-title')}" data-when="filled">
    <details ${b('summary')}>
      <summary ${b('summary-bar')}>
        <h2 ${b('summary-title', { cls: 'eyebrow' })}>${t('summary')}</h2>
        <span ${b('summary-count')} data-count></span>
        <span ${b('summary-total', { cls: 'figure' })} data-total></span>
      </summary>
      <div ${b('summary-body')}>
        <ul ${b('lines')}></ul>
        <a ${b('edit', { cls: 'link hit' })} href="${i18n.url('cart')}">${t('editCart')}</a>
        <dl ${b('totals')}>
          ${row('subtotal', t('subtotal'), null)}
          ${row('delivery', t('delivery'), esc(price ? i18n.money(price) : i18n.t('checkout.free')))}
          ${row('total', `${t('total')} <span ${b('vat')}>${t('vat')}</span>`, null)}
        </dl>
      </div>
    </details>
  </aside>`;
}

export function checkout(ctx) {
  const { site, catalog, i18n } = ctx;
  const t = (k, vars) => esc(i18n.t(`checkout.${k}`, vars));
  const c = (k) => esc(i18n.t(`cart.${k}`));
  const f = (name, options) => field(ctx, { form: FORM, name, ...options });
  const { phone, email } = site.contact;
  const link = (id, label) => `<a ${b('terms-link', { key: id })} href="${hrefOf(i18n, site.footerLinks.find((l) => l.id === id))}">${label}</a>`;
  const { price } = catalog.data.delivery;

  return `<fw-checkout ${b()}>
  ${summary(ctx)}
  <form ${b('form')} novalidate data-when="filled">
    <div ${b('head')}>
      <a ${b('back', { cls: 'eyebrow' })} href="${i18n.url('cart')}"><span ${b('back-icon')} aria-hidden="true">←</span> ${t('back')}</a>
      <div ${b('heading')}>
        <h1 ${b('title')}>${t('title')}</h1>
        <p ${b('required-note')}><span ${b('required')} aria-hidden="true">*</span> ${esc(i18n.t('field.requiredNote'))}</p>
      </div>
    </div>
    <p ${b('saved')} hidden><span ${b('saved-text')}>${t('saved')}</span> <button ${b('forget', { cls: 'hit' })} type="button">${t('forget')}</button></p>
    <div ${b('errors')} tabindex="-1" aria-labelledby="${b.id('errors-title')}" hidden>
      <h2 ${b('errors-title')}>${t('errors')}</h2>
      <ul ${b('error-list')}></ul>
    </div>
    ${section(
      'contact',
      i18n.t('checkout.contact'),
      `<div ${b('pair', { key: 'contact', mods: { contact: true } })}>${[
        f('email', { label: i18n.t('field.email'), hint: i18n.t('checkout.emailHint'), error: i18n.t('field.emailError'), type: 'email', autocomplete: 'shipping email', attrs: ' spellcheck="false" autocapitalize="off"' }),
        f('phone', { label: i18n.t('field.phone'), hint: i18n.t('checkout.phoneHint'), error: i18n.t('checkout.phoneError'), type: 'tel', autocomplete: 'shipping tel' }),
      ].join('')}</div>`,
    )}
    ${section(
      'delivery',
      i18n.t('checkout.delivery'),
      `${address(ctx, { prefix: '', section: 'shipping' })}
      <div ${b('method')}>
        <span ${b('method-name')}>${t('homeDelivery')}</span>
        <span ${b('method-price', { cls: 'figure' })}>${esc(price ? i18n.money(price) : i18n.t('checkout.free'))}</span>
        <span ${b('method-note')} data-expected></span>
      </div>
      <details ${b('more', { key: 'notes' })}>
        <summary ${b('more-toggle', { key: 'notes', cls: 'hit' })}><span ${b('more-icon', { key: 'notes' })} aria-hidden="true">+</span> ${t('notesToggle')}</summary>
        ${f('notes', { label: i18n.t('checkout.notes'), hint: i18n.t('checkout.notesHint'), type: 'textarea', optional: true })}
      </details>
      ${option('same-billing', { name: 'same-billing', label: i18n.t('checkout.sameBilling'), checked: true })}
      <fieldset ${b('billing')} disabled>${address(ctx, { prefix: 'billing-', section: 'billing' })}</fieldset>`,
    )}
    <div ${b('review')}>
      ${option('remember', { name: 'remember', label: i18n.t('checkout.remember'), hint: i18n.t('checkout.rememberHint') })}
      <p ${b('payment-body')}><span ${b('lock')} aria-hidden="true"></span>${t('paymentBody')}</p>
      <p ${b('terms')}>${t('terms').replace('{terms}', link('terms', t('termsLink'))).replace('{privacy}', link('privacy', t('privacyLink')))}</p>
      <button ${b('submit', { cls: 'button button--primary' })} type="submit"><span ${b('submit-label')}>${t('submit')} <span ${b('submit-total')} data-total></span></span> <span ${b('submit-icon', { cls: 'button__icon button__icon--accent' })} aria-hidden="true">→</span></button>
      <p ${b('status')} tabindex="-1" hidden>${t('unavailable')} <a ${b('status-link', { key: 'phone' })} href="tel:${esc(phone.replace(/\s/g, ''))}">${esc(phone)}</a> · <a ${b('status-link', { key: 'email' })} href="mailto:${esc(email)}">${esc(email)}</a></p>
    </div>
  </form>
  <div ${b('empty')} data-when="empty" hidden>
    <p ${b('empty-title')}>${c('empty')}</p>
    <p ${b('empty-body')}>${c('emptyBody')}</p>
    <a ${b('browse', { cls: 'button button--primary' })} href="${i18n.url('shop')}">${c('browse')} <span ${b('browse-icon', { cls: 'button__icon button__icon--accent' })} aria-hidden="true">→</span></a>
  </div>
</fw-checkout>`;
}

export function checkoutLines({ catalog, i18n }, groups) {
  return groups
    .flatMap((g) => g.lines.filter((l) => l.qty > 0).map((l) => ({ p: g.product, l })))
    .map(({ p, l }) => {
      const k = l.key;
      const d = describe(catalog, i18n, l.config);
      return `<li ${b('line', { key: k })}>
      <span ${b('thumb', { key: k, cls: 'media' })}>${img(p.image, { attrs: b('image', { key: k }), alt: '' })}</span>
      <span ${b('line-text', { key: k })}>
        <span ${b('line-name', { key: k, cls: 'product-name' })}>${esc(p.name)}</span>
        <span ${b('line-detail', { key: k })}>${esc(d.finish)} · ${esc(d.size)}</span>
        <span ${b('line-qty', { key: k })}>${l.qty} × ${esc(i18n.money(l.price))}</span>
        ${l.config.custom ? `<span ${b('line-note', { key: k })}>${esc(i18n.t('checkout.noWithdrawal'))}</span>` : ''}
      </span>
      <span ${b('line-total', { key: k, cls: 'figure' })}>${esc(i18n.money(l.price * l.qty))}</span>
    </li>`;
    })
    .join('');
}

export const checkoutErrors = (errors) =>
  errors.map(({ key, href, text }) => `<li ${b('error-item', { key })}><a ${b('error-link', { key })} href="${esc(href)}">${esc(text)}</a></li>`).join('');

export const checkoutSuggestions = (section, items, active, countryName) =>
  items
    .map(
      (item, i) => `<li ${b('suggestion', { key: `${section}-${i}`, mods: { active: i === active } })} role="option" aria-selected="${i === active}" data-index="${i}">
      <span ${b('suggestion-line', { key: `${section}-${i}` })}>${esc(item.line)}</span>
      <span ${b('suggestion-place', { key: `${section}-${i}` })}>${esc(`${item.postcode} ${item.city} · ${countryName(item.country)}`)}</span>
    </li>`,
    )
    .join('') + `<li ${b('suggestions-credit', { key: section })} role="presentation" aria-hidden="true">© OpenStreetMap</li>`;
