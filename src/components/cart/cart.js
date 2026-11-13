import { FwElement, page } from '../../js/element.js';
import { cart, config } from '../../js/store.js';
import { transition } from '../../js/router.js';
import { cartGroups, cartTiles, sum } from './cart.template.js';
import '../cart-control/cart-control.js';

let cheerIndex = 0;

customElements.define(
  'fw-cart',
  class extends FwElement {
    async setup() {
      this.open = '';
      this.adding = false;
      this.grid = this.$('.cart__grid');
      cart.prune();
      const line = this.$('.cart__cheer');
      this.ctx = await page();
      if (this.signal.aborted) return;
      const list = this.ctx.i18n.t('cart.cheers');
      cheerIndex = (cheerIndex + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
      line.textContent = list[cheerIndex];

      addEventListener('cart:change', () => this.render(), { signal: this.signal });
      addEventListener('keydown', (e) => e.key === 'Escape' && this.open && !document.querySelector('dialog[open]') && this.toggle(this.open), { signal: this.signal });
      this.on('click', '[data-toggle]', (e, el) => this.toggle(el.dataset.toggle));
      this.on('click', '[data-adding]', () => {
        this.adding = !this.adding;
        this.render(this.adding ? `#cart__tile--${this.open} [data-add]` : `#cart__another--${this.open}`);
      });
      this.on('click', '[data-add]', (e, el) => {
        this.adding = false;
        this.focusNext = `#cart__another--${this.open}`;
        cart.add(el.dataset.add);
      });
      this.on('click', '[data-custom]', (e, el) => this.custom(el.dataset.custom, el.dataset.finish));
      this.on('click', '[data-remove-line]', (e, el) => {
        this.focusNext = `#cart__panel-close--${this.open}`;
        cart.remove(el.dataset.removeLine);
      });
      this.on('click', '[data-remove]', (e, el) => this.removeTile(el.closest('.cart__tile'), el.dataset.remove.split(' ')));
      this.render();
    }

    toggle(id) {
      const opening = this.open !== id;
      this.open = opening ? id : '';
      this.adding = false;
      this.render(opening ? `#cart__panel-close--${id}` : [`#cart__toggle--${id}`, `#cart__view--${id}`]);
    }

    async custom(id, finish) {
      const { catalog } = this.ctx;
      const p = catalog.product(id);
      this.adding = false;
      this.render(`#cart__another--${id}`);
      config.set(`cart-${id}`, { product: id, finish, custom: catalog.customStart(p) });
      (await import('/components/custom-size/custom-size.js')).open(`cart-${id}`);
    }

    removeTile(tile, keys) {
      if (tile.classList.contains('cart__tile--removing')) return;
      tile.classList.add('cart__tile--removing');
      const neighbour = tile.nextElementSibling || tile.previousElementSibling;
      tile.addEventListener(
        'animationend',
        () => {
          if (this.open === tile.dataset.product) this.open = '';
          transition(() => cart.remove(...keys)).then(() => (neighbour?.querySelector('.cart__view') || this.$('.cart__browse')).focus({ preventScroll: true }));
        },
        { once: true, signal: this.signal },
      );
    }

    render(focus = '') {
      const { i18n, catalog } = this.ctx;
      const active = document.activeElement;
      const selector = focus || this.focusNext || (active?.id && this.grid.contains(active) ? `#${active.id}` : '');
      this.focusNext = '';
      const groups = cartGroups(catalog, cart.lines);
      if (this.open && !groups.some((g) => g.product.id === this.open)) this.open = '';

      const empty = groups.length === 0;
      this.grid.hidden = empty;
      this.$('.cart__empty').hidden = !empty;
      this.$('.cart__summary').hidden = empty;
      const lines = groups.flatMap((g) => g.lines);
      this.$('.cart__subtotal-label').textContent = i18n.t('cart.subtotal', { pieces: i18n.pieces(sum(lines, (l) => l.qty)) });
      this.$('.cart__subtotal-value').textContent = i18n.money(sum(lines, (l) => l.price * l.qty));

      this.patch(cartTiles(this.ctx, { groups, open: this.open, adding: this.adding }));
      const target = [].concat(selector).filter(Boolean).map((s) => this.$(s)).find(Boolean);
      if (target && document.activeElement !== target) target.focus({ preventScroll: true });
    }

    patch(html) {
      const tpl = document.createElement('template');
      tpl.innerHTML = html;
      const next = [...tpl.content.children];
      const keep = new Set(next.map((n) => n.id));
      for (const old of [...this.grid.children]) if (!keep.has(old.id)) old.remove();
      next.forEach((n, i) => {
        let el = this.grid.querySelector(`#${n.id}`);
        if (el?.classList.contains('cart__tile--removing')) return;
        if (el) {
          for (const a of [...el.attributes]) if (!n.hasAttribute(a.name)) el.removeAttribute(a.name);
          for (const a of n.attributes) if (el.getAttribute(a.name) !== a.value) el.setAttribute(a.name, a.value);
          const media = el.querySelector('.cart__media');
          const fresh = n.querySelector('.cart__media');
          if (media && fresh && media.isEqualNode(fresh)) fresh.replaceWith(media);
          el.replaceChildren(...n.childNodes);
        } else el = n;
        if (this.grid.children[i] !== el) this.grid.insertBefore(el, this.grid.children[i] || null);
      });
    }
  },
);
