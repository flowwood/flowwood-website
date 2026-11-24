import { FwElement, page } from '../../js/element.js';
import { cart } from '../../js/store.js';
import { sum } from '../../js/catalog.js';

const READING_LINE = 0.4;
const VIEW_STORAGE_KEY = 'fw:shop-view';
const clamp01 = (n) => Math.min(1, Math.max(0, n));

customElements.define(
  'fw-shop',
  class extends FwElement {
    setup() {
      this.links = this.$$('.shop__link');
      this.groups = this.links.map((a) => this.$(a.hash));
      this.panels = this.$$('.shop__panel');
      this.restoreView();
      this.on('change', '.shop__input', (e, input) => this.switchView(input.value));
      this.on('cart:change', null, () => this.showCart(), window);
      this.showCart();
      this.on('scroll', null, () => this.schedule(), window);
      this.on('resize', null, () => this.schedule(), window);
      this.track();
    }

    schedule() {
      if (this.frame) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.track();
      });
    }

    track() {
      const line = innerHeight * READING_LINE;
      const progress = this.groups.map((g) => {
        const r = g.getBoundingClientRect();
        return clamp01((line - r.top) / r.height);
      });
      const current = Math.max(0, progress.findLastIndex((p) => p > 0));
      this.links.forEach((a, i) => {
        a.style.setProperty('--progress', progress[i].toFixed(3));
        if (i === current) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
      this.panels.forEach((p, i) => (p.hidden = i !== current));
      this.reveal(this.links[current]);
    }

    async showCart() {
      const filled = cart.count() > 0;
      if (filled) {
        const { i18n, catalog } = await page();
        const lines = catalog.groups(cart.lines).flatMap((g) => g.lines);
        this.$('.shop__cart-label').textContent = i18n.t('shop.inCart', { pieces: i18n.pieces(sum(lines, (l) => l.qty)) });
        this.$('.shop__cart-total').textContent = i18n.money(sum(lines, (l) => l.price * l.qty));
      }
      this.$('.shop__facts').hidden = filled;
      this.$('.shop__cart').hidden = !filled;
    }

    restoreView() {
      try {
        const saved = this.$$('.shop__input').find((input) => input.value === localStorage.getItem(VIEW_STORAGE_KEY));
        if (saved) saved.checked = true;
      } catch {}
    }

    switchView(view) {
      try {
        localStorage.setItem(VIEW_STORAGE_KEY, view);
      } catch {}
      scrollTo(0, 0);
      this.schedule();
    }

    reveal(link) {
      if (link === this.revealed) return;
      this.revealed = link;
      const list = link.closest('.shop__list');
      if (list.scrollWidth <= list.clientWidth) return;
      list.scrollTo({ left: link.parentElement.offsetLeft - list.offsetLeft, behavior: 'smooth' });
    }
  },
);
