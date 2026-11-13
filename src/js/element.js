import { createI18n } from './i18n.js';
import { createCatalog } from './catalog.js';

let pageData;
let pageDataLocale;
export function page() {
  const locale = document.documentElement.dataset.locale;
  if (!pageData || pageDataLocale !== locale) {
    pageDataLocale = locale;
    pageData = Promise.all([import('/data/catalog.js'), import(`/data/site.${locale}.js`)]).then(([c, s]) => ({
      locale,
      i18n: createI18n(s.default, locale),
      catalog: createCatalog(c.default),
    }));
  }
  return pageData;
}

const supportsAnchorPositioning = CSS.supports('position-anchor: --a');

export class FwElement extends HTMLElement {
  connectedCallback() {
    this.ac = new AbortController();
    this.signal = this.ac.signal;
    this.setup();
  }

  disconnectedCallback() {
    this.ac.abort();
  }

  setup() {}

  $(selector) {
    return this.querySelector(selector);
  }

  $$(selector) {
    return [...this.querySelectorAll(selector)];
  }

  anchor(popover, invoker) {
    if (supportsAnchorPositioning) return;
    popover.addEventListener(
      'toggle',
      (e) => {
        if (e.newState !== 'open') return;
        const r = invoker.getBoundingClientRect();
        Object.assign(popover.style, { position: 'fixed', margin: '0', top: `${r.bottom + 6}px`, left: 'auto', right: `${document.documentElement.clientWidth - r.right}px` });
      },
      { signal: this.signal },
    );
  }

  on(type, selector, fn, target = this) {
    target.addEventListener(
      type,
      (e) => {
        const el = selector ? e.target.closest?.(selector) : e.target;
        if (el && (target !== this || this.contains(el))) fn(e, el);
      },
      { signal: this.signal },
    );
  }
}
