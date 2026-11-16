import { FwElement } from '../../js/element.js';
import { stockLeft } from '../../js/catalog.js';
import { cart } from '../../js/store.js';

customElements.define(
  'fw-cart-control',
  class extends FwElement {
    static observedAttributes = ['data-key'];

    setup() {
      this.add = this.$('.cart-control__add');
      this.stepper = this.$('.cart-control__stepper');
      this.dec = this.$('.cart-control__dec');
      this.inc = this.$('.cart-control__inc');
      this.qty = this.$('.cart-control__qty');
      this.addContent = this.add && [this.add.innerHTML, this.add.ariaLabel];
      this.on('click', '.cart-control__add, .cart-control__inc', () => this.available() && cart.add(this.dataset.key));
      this.on('click', '.cart-control__dec', () => this.decrement());
      addEventListener('cart:change', () => this.render(), { signal: this.signal });
      this.render();
    }

    available() {
      return !('stock' in this.dataset) || stockLeft(Number(this.dataset.stock), this.dataset.key, cart.lines) > 0;
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

    showAvailability(available) {
      this.add.disabled = !available;
      if (!('labelSoldOut' in this.dataset)) return;
      const [html, label] = available ? this.addContent : [this.dataset.labelSoldOut, this.dataset.labelSoldOutNamed];
      if (this.add.innerHTML !== html) this.add.innerHTML = html;
      this.add.ariaLabel = label;
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
      const available = this.available();
      this.inc.disabled = !available;
      if (this.add) this.showAvailability(available);
      this.qty.textContent = String(q);
    }
  },
);
