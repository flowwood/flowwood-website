import { FwElement, page } from '../../js/element.js';
import { config } from '../../js/store.js';
import { describe } from '../../js/catalog.js';

customElements.define(
  'fw-product-card',
  class extends FwElement {
    setup() {
      const id = this.dataset.config;
      this.on('click', '[data-height]', (e, el) => (el.dataset.height === 'custom' ? this.custom() : this.pick({ height: Number(el.dataset.height), custom: undefined })));
      this.on('click', '[data-finish]', (e, el) => this.pick({ finish: el.dataset.finish }));
      addEventListener('config:change', (e) => e.detail.id === id && this.reflect(e.detail.value), { signal: this.signal });
      if (config.get(id)) this.reflect(config.get(id));
    }

    async current() {
      const { catalog } = await page();
      return config.get(this.dataset.config) || catalog.defaults(catalog.product(this.dataset.product), this.prerenderedSeed());
    }

    prerenderedSeed() {
      const height = this.$('.product-card__height[aria-pressed="true"]')?.dataset.height;
      return { finish: this.$('.swatch[aria-pressed="true"]')?.dataset.finish, height: Number(height) || undefined };
    }

    async pick(patch) {
      const next = { ...(await this.current()), ...patch };
      if (!next.custom) delete next.custom;
      config.set(this.dataset.config, next);
    }

    async custom() {
      const [{ catalog }, dialog, c] = await Promise.all([page(), import('../custom-size/custom-size.js'), this.current()]);
      const p = catalog.product(this.dataset.product);
      config.set(this.dataset.config, { ...c, custom: catalog.customStart(p, c) });
      dialog.open(this.dataset.config);
    }

    async reflect(c) {
      const { catalog, i18n } = await page();
      const d = describe(catalog, i18n, c);
      this.$('.product-card__option').textContent = `${d.finish}, ${d.size}`;
      this.$('.product-card__price').textContent = i18n.money(catalog.price(c));
      for (const el of this.$$('[data-height]')) el.ariaPressed = String(c.custom ? el.dataset.height === 'custom' : Number(el.dataset.height) === c.height);
      for (const el of this.$$('[data-finish]')) el.ariaPressed = String(el.dataset.finish === c.finish);
      this.$('fw-cart-control').dataset.key = catalog.lineKey(c);
    }
  },
);
