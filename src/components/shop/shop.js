import { FwElement, page } from '../../js/element.js';

customElements.define(
  'fw-shop',
  class extends FwElement {
    setup() {
      this.sort = 'featured';
      this.sorts = this.$('.shop__sorts');
      this.anchor(this.sorts, this.$('.shop__sort-button'));
      this.on('click', '.shop__filter', (e, el) => this.filter(el));
      this.on('click', '[data-sort]', (e, el) => this.pickSort(el));
      this.on('product-card:change', null, () => this.sort !== 'featured' && this.order());
    }

    async filter(el) {
      const id = el.dataset.filter;
      for (const f of this.$$('.shop__filter')) f.ariaPressed = String(f === el);
      if (id) this.dataset.filter = id;
      else delete this.dataset.filter;
      for (const g of this.$$('.collection[data-collection]')) g.hidden = Boolean(id) && g.dataset.collection !== id;
      const { i18n } = await page();
      this.$('.shop__count').textContent = i18n.pieces(Number(el.dataset.count));
      this.bringGroupsUnderStickyBar();
    }

    bringGroupsUnderStickyBar() {
      const top = this.$('.shop__groups').getBoundingClientRect().top;
      const barBottom = this.$('.shop__bar').getBoundingClientRect().bottom;
      if (top < barBottom) scrollBy({ top: top - barBottom });
    }

    pickSort(el) {
      this.sort = el.dataset.sort;
      for (const o of this.$$('[data-sort]')) o.ariaSelected = String(o === el);
      this.$('.shop__sort-label').textContent = el.textContent;
      this.sorts.hidePopover();
      this.order();
    }

    order() {
      const dir = this.sort === 'priceAsc' ? 1 : this.sort === 'priceDesc' ? -1 : 0;
      for (const grid of this.$$('.collection__grid')) {
        const cards = [...grid.children];
        if (!dir) {
          cards.forEach((c) => (c.style.order = ''));
          continue;
        }
        cards
          .map((c, i) => ({ c, i, p: Number(c.dataset.price) }))
          .sort((a, z) => dir * (a.p - z.p) || a.i - z.i)
          .forEach(({ c }, n) => (c.style.order = String(n)));
      }
    }
  },
);
