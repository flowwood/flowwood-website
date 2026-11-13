import { FwElement } from '../../js/element.js';
import { cart } from '../../js/store.js';

customElements.define(
  'fw-cart-control',
  class extends FwElement {
    static observedAttributes = ['data-key'];

    setup() {
      this.add = this.$('.cart-control__add');
      this.stepper = this.$('.cart-control__stepper');
      this.dec = this.$('.cart-control__dec');
      this.qty = this.$('.cart-control__qty');
      this.on('click', '.cart-control__add, .cart-control__inc', () => cart.add(this.dataset.key));
      this.on('click', '.cart-control__dec', () => this.decrement());
      addEventListener('cart:change', () => this.render(), { signal: this.signal });
      this.render();
    }

    attributeChangedCallback() {
      if (this.signal) this.render();
    }

    decrement() {
      const key = this.dataset.key;
      const q = cart.qty(key);
      if (!this.add) q > Number(this.dataset.min) && cart.set(key, q - 1);
      else q <= 1 ? cart.remove(key) : cart.set(key, q - 1);
    }

    render() {
      const q = cart.qty(this.dataset.key);
      if (this.add) {
        this.add.hidden = q > 0;
        this.stepper.hidden = q === 0;
        const removes = q <= 1;
        this.dec.textContent = removes ? '×' : '−';
        this.dec.ariaLabel = removes ? this.dataset.labelRemove : this.dataset.labelLess;
        this.dec.title = this.dec.ariaLabel;
      } else {
        this.dec.disabled = q <= Number(this.dataset.min);
      }
      this.qty.textContent = String(q);
    }
  },
);
