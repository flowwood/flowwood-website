import { FwElement } from '../../js/element.js';
import { cart } from '../../js/store.js';

const hiddenSides = (nav) =>
  [nav.scrollLeft > 1 && 'start', nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1 && 'end'].filter(Boolean).join(' ');

function revealCurrentLink(nav) {
  const current = nav.querySelector('[aria-current="page"]');
  if (!current) return;
  const hiddenWidth = current.getBoundingClientRect().right - nav.getBoundingClientRect().right;
  if (hiddenWidth > 0) nav.scrollLeft += hiddenWidth;
}

customElements.define(
  'fw-menu-bar',
  class extends FwElement {
    setup() {
      this.anchor(this.$('.menu-bar__languages'), this.$('.menu-bar__language'));
      this.badge = this.$('.menu-bar__badge');
      this.count();
      this.nav = this.$('.menu-bar__nav');
      revealCurrentLink(this.nav);
      this.markMore();
      this.nav.addEventListener('scroll', () => this.markMore(), { passive: true, signal: this.signal });
      addEventListener('resize', () => this.markMore(), { signal: this.signal });
      addEventListener('cart:change', () => this.count(), { signal: this.signal });
    }

    markMore() {
      const sides = hiddenSides(this.nav);
      if (sides) this.nav.dataset.more = sides;
      else delete this.nav.dataset.more;
    }

    count() {
      const n = cart.count();
      this.badge.hidden = n === 0;
      this.badge.textContent = n > 99 ? '99+' : String(n);
    }
  },
);
