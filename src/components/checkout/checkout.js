import { FwElement, page, reflectValidity } from '../../js/element.js';
import { cart, details } from '../../js/store.js';
import { sum } from '../../js/catalog.js';
import { checkoutErrors, checkoutLines, checkoutSuggestions } from './checkout.template.js';

const REMEMBERED = ['email', 'phone', 'name', 'country', 'address', 'address2', 'postcode', 'city', 'same-billing', 'billing-name', 'billing-country', 'billing-address', 'billing-postcode', 'billing-city'];
const DAY_MS = 86_400_000;

const GEOCODER = 'https://nominatim.openstreetmap.org/search';
const GEOCODER_GAP_MS = 1100;
const CHECK_DELAY_MS = 400;
const SUGGESTER = 'https://photon.komoot.io/api/';
const BENELUX_BBOX = '2.5,49.4,7.3,53.6';
const SUGGEST_DELAY_MS = 250;
const SUGGEST_MIN_CHARS = 3;
const SUGGESTIONS_SHOWN = 6;
const TYPED = /^(insertText|insertFromPaste|insertCompositionText|delete)/;
const ADDRESS_PARTS = ['address', 'postcode', 'city', 'country'];
const ADDRESS_FIELD = /^(billing-)?(address|postcode|city|country)$/;
const HOUSE_NUMBER = String.raw`\d+[a-zA-Z]?(?:[-/]\d+[a-zA-Z]?)?`;
const NUMBER_LAST = new RegExp(String.raw`^(.+?)[\s,]+(${HOUSE_NUMBER})(?:[\s,]+(?:bus|box|bte|boîte)\s*\w+)?\s*$`, 'i');
const NUMBER_FIRST = new RegExp(String.raw`^(${HOUSE_NUMBER})[\s,]+(.+)$`);
const PLACE_KEYS = ['city', 'town', 'village', 'suburb', 'city_district', 'municipality', 'hamlet'];
const DUTCH_POSTCODE = /^(\d{4})\s*([a-z]{2})$/i;

const isValue = (el) => el.type !== 'checkbox';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fold = (v) => v.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
const barePostcode = (v = '') => v.toUpperCase().replace(/^L-?/, '').replace(/\s+/g, '');
const samePostcode = (a, b) => barePostcode(a) === barePostcode(b);
const groupOf = (name) => name.match(ADDRESS_FIELD)?.[1] ?? (ADDRESS_FIELD.test(name) ? '' : null);

function splitStreet(line) {
  const last = line.trim().match(NUMBER_LAST);
  if (last) return { street: last[1], number: last[2] };
  const first = line.trim().match(NUMBER_FIRST);
  return first ? { street: first[2], number: first[1] } : null;
}

function hasNumber(found = '', number) {
  const base = parseInt(number, 10);
  return String(found)
    .split(/[;,]/)
    .some((part) => {
      const range = part.match(/^\s*(\d+)\s*-\s*(\d+)/);
      return range ? base >= +range[1] && base <= +range[2] : parseInt(part, 10) === base;
    });
}

const placesOf = (address) => PLACE_KEYS.map((k) => address[k]).filter(Boolean);
const namesPlace = (places, city) => places.some((p) => fold(p).includes(fold(city)) || fold(city).includes(fold(p)));

let nextGeocodeAt = 0;
async function geocode(params) {
  const at = Math.max(Date.now(), nextGeocodeAt);
  nextGeocodeAt = at + GEOCODER_GAP_MS;
  await sleep(at - Date.now());
  const response = await fetch(`${GEOCODER}?${new URLSearchParams({ format: 'jsonv2', addressdetails: '1', limit: '10', ...params })}`);
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

function toSuggestion(p) {
  const street = p.type === 'street' ? p.name : p.street;
  return { line: p.housenumber ? `${street} ${p.housenumber}` : street, complete: Boolean(p.housenumber), postcode: p.postcode, city: p.city || p.district || p.name, country: p.countrycode };
}

async function suggestAddresses(query, countries, signal) {
  const params = new URLSearchParams({ q: query, limit: '12', bbox: BENELUX_BBOX, lang: 'default' });
  params.append('layer', 'house');
  params.append('layer', 'street');
  const response = await fetch(`${SUGGESTER}?${params}`, { signal });
  if (!response.ok) throw new Error(String(response.status));
  const seen = new Set();
  return (await response.json()).features
    .map((f) => f.properties)
    .filter((p) => countries.includes(p.countrycode) && p.postcode && (p.street || p.type === 'street'))
    .map(toSuggestion)
    .filter((item) => !seen.has(`${item.line}|${item.postcode}`) && seen.add(`${item.line}|${item.postcode}`))
    .slice(0, SUGGESTIONS_SHOWN);
}

async function findAddress({ country, postcode, city, street, number }, lang) {
  const area = { countrycodes: country.toLowerCase(), 'accept-language': lang };
  const results = await geocode({ ...area, street: `${number} ${street}`, postalcode: barePostcode(postcode) });
  const match = results.find((r) => samePostcode(r.address.postcode, postcode) && hasNumber(r.address.house_number, number));
  if (match) {
    const places = placesOf(match.address);
    return namesPlace(places, city) ? { ok: true } : { field: 'city', key: 'cityMismatch', vars: { postcode, city: places.at(-1) || places[0] } };
  }
  const postcodes = await geocode({ ...area, postalcode: barePostcode(postcode) });
  return postcodes.length ? { field: 'address', key: 'addressUnknown' } : { field: 'postcode', key: 'postcodeUnknown' };
}

const errorText = (input) => document.getElementById(input.dataset.error)?.textContent || input.validationMessage;

customElements.define(
  'fw-checkout',
  class extends FwElement {
    async setup() {
      this.form = this.$('.checkout__form');
      this.title = document.title;
      this.validates();
      this.restore();
      this.checks = new Map();
      this.accepted = new Set();
      this.timers = new Map();
      this.on('change', '[data-country]', (e, select) => this.postcodeFor(select));
      this.on('input', '.field__input', (e, input) => groupOf(input.name) !== null && this.resetCheck(groupOf(input.name)));
      this.on('focusout', '.field__input', (e, input) => {
        const prefix = groupOf(input.name);
        if (prefix === null) return;
        if (input.name.endsWith('postcode')) this.tidyPostcode(prefix);
        this.scheduleCheck(prefix);
      });
      this.on('click', '[data-keep]', (e, button) => this.keep(button.dataset.keep));
      this.suggestions = new Map();
      this.on('input', '[data-suggest]', (e, input) => (TYPED.test(e.inputType || '') ? this.queueSuggest(input.dataset.suggest) : this.closeSuggestions(input.dataset.suggest)));
      this.on('keydown', '[data-suggest]', (e, input) => this.suggestKey(e, input.dataset.suggest));
      this.on('focusout', '[data-suggest]', (e, input) => this.closeSuggestions(input.dataset.suggest));
      this.on('mousedown', '.checkout__suggestions', (e) => e.preventDefault());
      this.on('click', '.checkout__suggestion', (e, option) => this.pick(this.suggestPrefixOf(option), Number(option.dataset.index)));
      this.on('change', '[name="same-billing"]', () => this.syncBilling());
      this.on('click', '.checkout__forget', () => this.forget());
      this.on('click', '.checkout__error-link', (e, a) => {
        e.preventDefault();
        document.getElementById(a.hash.slice(1))?.focus();
      });
      this.on('submit', '.checkout__form', (e) => {
        e.preventDefault();
        this.submit();
      });
      addEventListener('pageshow', () => (this.$('.checkout__submit').disabled = false), { signal: this.signal });
      this.ctx = await page();
      if (this.signal.aborted) return;
      addEventListener('cart:change', () => this.render(), { signal: this.signal });
      this.render();
    }

    get controls() {
      return [...this.form.elements].filter((el) => el.name);
    }

    restore() {
      const saved = details.get();
      if (!saved) return;
      for (const el of this.controls) {
        if (!(el.name in saved)) continue;
        if (isValue(el)) el.value = saved[el.name];
        else el.checked = saved[el.name];
      }
      this.form.elements.remember.checked = true;
      for (const more of this.$$('.checkout__more')) more.open ||= [...more.querySelectorAll('.field__input')].some((el) => el.value);
      this.$$('[data-country]').forEach((select) => this.postcodeFor(select));
      this.syncBilling();
      this.$('.checkout__saved').hidden = false;
    }

    forget() {
      details.forget();
      this.form.elements.remember.checked = false;
      this.$('.checkout__saved-text').textContent = this.ctx?.i18n.t('checkout.forgotten') ?? '';
      this.$('.checkout__forget').remove();
    }

    postcodeFor(select) {
      const { postcode, postcodeError } = select.selectedOptions[0].dataset;
      const input = this.form.elements[select.name.replace('country', 'postcode')];
      const error = document.getElementById(input.dataset.error);
      input.pattern = postcode;
      delete error.dataset.default;
      error.textContent = postcodeError;
      if (input.value) reflectValidity(input);
    }

    syncBilling() {
      this.$('.checkout__billing').disabled = this.form.elements['same-billing'].checked;
    }

    part(prefix, name) {
      return this.form.elements[`${prefix}${name}`];
    }

    addressOf(prefix) {
      const values = Object.fromEntries(ADDRESS_PARTS.map((name) => [name, this.part(prefix, name).value.trim()]));
      const complete = ADDRESS_PARTS.every((name) => values[name]) && !this.part(prefix, 'postcode').validity.patternMismatch;
      return { ...values, complete, key: JSON.stringify(values) };
    }

    tidyPostcode(prefix) {
      const input = this.part(prefix, 'postcode');
      const dutch = this.part(prefix, 'country').value === 'NL' && input.value.trim().match(DUTCH_POSTCODE);
      if (dutch) input.value = `${dutch[1]} ${dutch[2].toUpperCase()}`;
    }

    scheduleCheck(prefix) {
      clearTimeout(this.timers.get(prefix));
      this.timers.set(prefix, setTimeout(() => this.check(prefix), CHECK_DELAY_MS));
    }

    resetCheck(prefix) {
      clearTimeout(this.timers.get(prefix));
      this.checks.delete(prefix);
      for (const name of ADDRESS_PARTS) this.flag(this.part(prefix, name), '');
      this.showCheck(prefix, '');
    }

    flag(input, message) {
      const error = input.dataset.error && document.getElementById(input.dataset.error);
      input.setCustomValidity(message);
      if (!error) return;
      if (message) {
        error.dataset.default ??= error.textContent;
        error.textContent = message;
      } else if (error.dataset.default) {
        error.textContent = error.dataset.default;
        delete error.dataset.default;
      }
      if (message || input.ariaInvalid === 'true') reflectValidity(input);
    }

    showCheck(prefix, state) {
      const line = this.$(`[data-verify="${prefix}"]`);
      line.dataset.state = state;
      line.querySelector('.checkout__verify-text').textContent = state && this.ctx ? this.ctx.i18n.t(`checkout.${state}`) : '';
      line.querySelector('.checkout__keep').hidden = state !== 'notFound';
    }

    keep(prefix) {
      this.accepted.add(this.addressOf(prefix).key);
      this.resetCheck(prefix);
      this.part(prefix, 'address').focus();
    }

    suggestPrefixOf(option) {
      return option.closest('.field__control').querySelector('[data-suggest]').dataset.suggest;
    }

    queueSuggest(prefix) {
      const state = this.suggestions.get(prefix);
      clearTimeout(state?.timer);
      state?.request?.abort();
      const query = this.part(prefix, 'address').value.trim();
      if (query.length < SUGGEST_MIN_CHARS || !this.ctx) return this.closeSuggestions(prefix);
      const request = new AbortController();
      const timer = setTimeout(async () => {
        const countries = this.ctx.catalog.data.delivery.countries.map((c) => c.code);
        const items = await suggestAddresses(query, countries, request.signal).catch(() => []);
        if (!request.signal.aborted) this.showSuggestions(prefix, items, -1);
      }, SUGGEST_DELAY_MS);
      this.suggestions.set(prefix, { timer, request, items: [], active: -1 });
    }

    showSuggestions(prefix, items, active) {
      const input = this.part(prefix, 'address');
      const list = document.getElementById(input.getAttribute('aria-controls'));
      const section = list.id.split('--')[1];
      const names = new Intl.DisplayNames([document.documentElement.lang], { type: 'region' });
      this.suggestions.set(prefix, { ...this.suggestions.get(prefix), items, active });
      list.innerHTML = items.length ? checkoutSuggestions(section, items, active, (code) => names.of(code)) : '';
      list.hidden = !items.length;
      input.ariaExpanded = String(items.length > 0);
      const option = active >= 0 ? list.children[active] : null;
      if (option) input.setAttribute('aria-activedescendant', option.id);
      else input.removeAttribute('aria-activedescendant');
      option?.scrollIntoView({ block: 'nearest' });
    }

    closeSuggestions(prefix) {
      const state = this.suggestions.get(prefix);
      clearTimeout(state?.timer);
      state?.request?.abort();
      if (state?.items.length || this.part(prefix, 'address').ariaExpanded === 'true') this.showSuggestions(prefix, [], -1);
    }

    suggestKey(e, prefix) {
      const { items = [], active = -1 } = this.suggestions.get(prefix) || {};
      if (!items.length) return;
      const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
      if (step) {
        e.preventDefault();
        const next = active + step;
        this.showSuggestions(prefix, items, next < -1 ? items.length - 1 : next >= items.length ? -1 : next);
      } else if (e.key === 'Enter' && active >= 0) {
        e.preventDefault();
        this.pick(prefix, active);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.closeSuggestions(prefix);
      }
    }

    pick(prefix, index) {
      const item = this.suggestions.get(prefix)?.items[index];
      if (!item) return;
      const country = this.part(prefix, 'country');
      const input = this.part(prefix, 'address');
      this.closeSuggestions(prefix);
      this.resetCheck(prefix);
      country.value = item.country;
      this.postcodeFor(country);
      input.value = item.complete ? item.line : `${item.line} `;
      this.part(prefix, 'postcode').value = item.postcode;
      this.part(prefix, 'city').value = item.city;
      this.tidyPostcode(prefix);
      for (const name of ['address', 'postcode', 'city']) if (this.part(prefix, name).ariaInvalid === 'true') reflectValidity(this.part(prefix, name));
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      if (!item.complete) return;
      this.checks.set(prefix, { key: this.addressOf(prefix).key, outcome: Promise.resolve({ ok: true }) });
      this.showCheck(prefix, 'found');
    }

    async check(prefix) {
      const address = this.addressOf(prefix);
      if (!address.complete || !this.ctx || this.accepted.has(address.key)) return true;
      const parts = splitStreet(address.address);
      if (!parts) {
        this.flag(this.part(prefix, 'address'), this.ctx.i18n.t('checkout.addressNumber'));
        return false;
      }
      let entry = this.checks.get(prefix);
      if (entry?.key !== address.key) {
        entry = { key: address.key, outcome: findAddress({ ...address, ...parts }, this.ctx.locale).catch(() => ({ ok: true, offline: true })) };
        this.checks.set(prefix, entry);
        this.showCheck(prefix, 'checking');
      }
      const outcome = await entry.outcome;
      if (this.checks.get(prefix) !== entry) return true;
      if (outcome.ok) {
        this.showCheck(prefix, outcome.offline ? '' : 'found');
        return true;
      }
      this.flag(this.part(prefix, outcome.field), this.ctx.i18n.t(`checkout.${outcome.key}`, outcome.vars));
      this.showCheck(prefix, 'notFound');
      return false;
    }

    async submit() {
      const submit = this.$('.checkout__submit');
      submit.disabled = true;
      const groups = ['', 'billing-'].filter((prefix) => !this.part(prefix, 'address').matches(':disabled'));
      await Promise.all(groups.map((prefix) => this.check(prefix)));
      submit.disabled = false;
      const invalid = this.controls.filter((el) => el.willValidate && !el.checkValidity());
      this.showErrors(invalid);
      if (invalid.length) return;
      if (this.form.elements.remember.checked) details.save(Object.fromEntries(this.controls.filter((el) => !el.matches(':disabled') && REMEMBERED.includes(el.name)).map((el) => [el.name, isValue(el) ? el.value.trim() : el.checked])));
      else details.forget();
      await this.placeOrder();
    }

    async placeOrder() {
      const submit = this.$('.checkout__submit');
      submit.disabled = true;
      submit.ariaBusy = 'true';
      const result = await this.postOrder().catch(() => null);
      if (result?.checkout) return location.assign(result.checkout);
      submit.disabled = false;
      submit.ariaBusy = 'false';
      this.showStatus(this.failureText(result));
    }

    async postOrder() {
      const lines = this.ctx.catalog.groups(cart.lines).flatMap((g) => g.lines).filter((l) => l.qty > 0).map((l) => [l.key, l.qty]);
      const values = this.controls.filter((el) => !el.matches(':disabled') && el.name !== 'remember').map((el) => [el.name, isValue(el) ? el.value.trim() : el.checked]);
      const response = await fetch(new URL('../../api/order', import.meta.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ locale: this.ctx.locale, lines: Object.fromEntries(lines), details: Object.fromEntries(values) }),
      });
      return response.json();
    }

    failureText(result) {
      const { i18n, catalog } = this.ctx;
      if (result?.error !== 'stock') return i18n.t('checkout.orderFailed');
      return result.products.map(({ product, left }) => i18n.t(left ? 'checkout.stockLeft' : 'checkout.soldOut', { name: catalog.product(product)?.name ?? product, left })).join(' ');
    }

    showStatus(text) {
      const status = this.$('.checkout__status');
      this.$('.checkout__status-text').textContent = text;
      status.hidden = false;
      status.focus();
    }

    showErrors(invalid) {
      const box = this.$('.checkout__errors');
      box.hidden = invalid.length === 0;
      document.title = invalid.length && this.ctx ? this.ctx.i18n.t('checkout.errorTitle', { title: this.title }) : this.title;
      if (!invalid.length) return;
      this.$('.checkout__error-list').innerHTML = checkoutErrors(invalid.map((input) => ({ key: input.name, href: `#${input.id}`, text: errorText(input) })));
      this.$('.checkout__status').hidden = true;
      box.focus();
    }

    render() {
      const { i18n, catalog } = this.ctx;
      const groups = catalog.groups(cart.lines);
      const lines = groups.flatMap((g) => g.lines).filter((l) => l.qty > 0);
      for (const el of this.$$('[data-when]')) el.hidden = (el.dataset.when === 'empty') !== (lines.length === 0);
      const subtotal = sum(lines, (l) => l.price * l.qty);
      const total = subtotal + catalog.data.delivery.price;
      this.$('.checkout__lines').innerHTML = checkoutLines(this.ctx, groups);
      this.$('[data-subtotal]').textContent = i18n.money(subtotal);
      this.$$('[data-total]').forEach((el) => (el.textContent = i18n.money(total)));
      this.$('[data-count]').textContent = i18n.pieces(sum(lines, (l) => l.qty));
      this.$('[data-expected]').textContent = this.expected(i18n);
    }

    expected(i18n) {
      const [from, to] = this.ctx.catalog.data.delivery.weeks.map((w) => new Date(Date.now() + w * 7 * DAY_MS));
      const date = new Intl.DateTimeFormat(document.documentElement.lang, { day: 'numeric', month: 'long' });
      return i18n.t('checkout.expected', { from: date.format(from), to: date.format(to) });
    }
  },
);
