import { FwElement, page } from '../../js/element.js';
import { bem, esc } from '../../js/bem.js';
import { cart, config } from '../../js/store.js';
import { describe } from '../../js/catalog.js';

customElements.define(
  'fw-product-card',
  class extends FwElement {
    setup() {
      const id = this.dataset.config;
      this.on('click', '[data-height]', (e, el) => (el.dataset.height === 'custom' ? this.custom() : this.pick({ height: Number(el.dataset.height), custom: undefined })));
      this.on('click', '[data-finish]', (e, el) => this.pick({ finish: el.dataset.finish }));
      this.on('click', '[data-line]', (e, el) => this.pickLine(el.dataset.line));
      addEventListener('config:change', (e) => e.detail.id === id && this.reflect(e.detail.value), { signal: this.signal });
      addEventListener('cart:change', () => this.hasCartLines() && this.current().then((c) => this.reflect(c)), { signal: this.signal });
      if (config.get(id)) this.reflect(config.get(id));
      else if (this.hasCartLines()) this.current().then((c) => this.reflect(c));
    }

    hasCartLines() {
      return Boolean(this.$('.product-card__elsewhere')) && Object.keys(cart.lines).some((key) => key.split(':')[0] === this.dataset.product);
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
      this.markCart(catalog, i18n, c);
    }

    markCart(catalog, i18n, c) {
      const elsewhere = this.$('.product-card__elsewhere');
      if (!elsewhere) return;
      const current = catalog.lineKey(c);
      const lines = catalog.groups(cart.lines).find((g) => g.product.id === c.product)?.lines || [];
      const others = lines.filter((l) => l.qty > 0 && l.key !== current);
      const many = others.length > 1;
      const jump = this.$('.product-card__jump');
      const list = this.$('.product-card__others');
      jump.classList.toggle('product-card__jump--many', many);
      jump.toggleAttribute('popovertarget', many);
      if (many) jump.setAttribute('popovertarget', list.id);
      if (many) delete jump.dataset.line;
      else if (others.length) jump.dataset.line = others[0].key;
      this.$('.product-card__jump-text').textContent = many
        ? i18n.t('productCard.alsoInCartMany', { count: others.length })
        : others.length ? i18n.t('productCard.alsoInCart', { item: this.otherItem(catalog, i18n, c, others[0]) }) : '';
      this.$('.product-card__others-list').innerHTML = many ? others.map((l) => this.otherOption(catalog, i18n, l)).join('') : '';
      if (!many && list.matches(':popover-open')) list.hidePopover();
      const hadFocus = elsewhere.contains(document.activeElement);
      elsewhere.hidden = others.length === 0;
      if (hadFocus && elsewhere.hidden) this.$('[data-height][aria-pressed="true"]')?.focus();
    }

    otherOption(catalog, i18n, line) {
      const b = bem('product-card', this.id.replace(/^product-card--/, ''));
      const d = describe(catalog, i18n, line.config);
      return `<button ${b('other', { key: line.key, cls: 'popover__option' })} type="button" data-line="${esc(line.key)}"><span ${b('other-name', { key: line.key })}>${esc(d.finish)}, ${esc(d.size)}</span><span ${b('other-qty', { key: line.key })}>×${line.qty}</span></button>`;
    }

    async pickLine(key) {
      const { catalog } = await page();
      const c = catalog.parseKey(key);
      if (!c) return;
      this.$('.product-card__others').hidePopover?.();
      config.set(this.dataset.config, c);
    }

    otherItem(catalog, i18n, c, line) {
      const d = describe(catalog, i18n, line.config);
      const item = line.config.finish === c.finish ? d.size : `${d.finish}, ${d.size}`;
      return line.qty > 1 ? `${line.qty} × ${item}` : item;
    }
  },
);
