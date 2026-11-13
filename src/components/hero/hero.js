import { FwElement, page } from '../../js/element.js';
import { config } from '../../js/store.js';

const DEEP = /^#hero__slide--(.+)$/;
const editable = (el) => el?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])');

customElements.define(
  'fw-hero',
  class extends FwElement {
    setup() {
      this.ids = this.dataset.products.split(' ');
      this.slides = this.$$('.hero__slide');
      this.panels = this.$$('.hero__panel');
      this.thumbs = this.$$('.hero__thumb');
      this.counter = this.$('.hero__counter');

      this.on('click', '[data-step]', (e, el) => this.go(this.active + Number(el.dataset.step)));
      this.on('click', '.hero__thumb', (e, el) => this.go(Number(el.dataset.index)));
      this.on('animationend', '.hero__progress', (e) => e.animationName === 'hero-progress' && this.go(this.active + 1));

      document.addEventListener(
        'keydown',
        (e) => {
          if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || editable(e.target) || document.querySelector('dialog[open]')) return;
          if (e.key === 'ArrowRight') this.go(this.active + 1);
          else if (e.key === 'ArrowLeft') this.go(this.active - 1);
        },
        { signal: this.signal },
      );

      const deepLink = () => this.deepLink();
      addEventListener('hashchange', deepLink, { signal: this.signal });
      addEventListener('route:change', deepLink, { signal: this.signal });
      this.deepLink();

      addEventListener('config:change', (e) => this.reflect(e.detail.id, e.detail.value), { signal: this.signal });
      for (const id of this.ids) if (config.get(id)) this.reflect(id, config.get(id));
    }

    get active() {
      return Number(this.dataset.active) || 0;
    }

    go(n) {
      const len = this.slides.length;
      const i = ((n % len) + len) % len;
      if (i === this.active) return;
      const set = (el, name, on) => (on ? el.setAttribute(name, 'true') : el.removeAttribute(name));
      this.dataset.active = String(i);
      this.dataset.tone = this.slides[i].classList.contains('hero__slide--dark') ? 'dark' : 'light';
      this.slides.forEach((el, k) => set(el, 'aria-hidden', k !== i));
      this.panels.forEach((el, k) => {
        set(el, 'aria-hidden', k !== i);
        el.inert = k !== i;
      });
      this.thumbs.forEach((el, k) => set(el, 'aria-current', k === i));
      this.counter.textContent = `${String(i + 1).padStart(2, '0')} / ${String(this.slides.length).padStart(2, '0')}`;
    }

    deepLink() {
      const id = location.hash.match(DEEP)?.[1];
      const i = this.ids.indexOf(id);
      if (i < 0) return;
      this.dataset.paused = '';
      this.go(i);
    }

    async reflect(id, value) {
      const i = this.ids.indexOf(id);
      if (i < 0) return;
      const { catalog } = await page();
      this.panels[i].querySelector('fw-cart-control').dataset.key = catalog.lineKey(value);
    }
  },
);
