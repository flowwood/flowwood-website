import { FwElement } from '../../js/element.js';
import { cart } from '../../js/store.js';

const ORDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CLOSED = ['failed', 'canceled', 'expired'];
const POLL_MS = 3000;
const POLLS = 10;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function statusOf(id, signal) {
  try {
    const response = await fetch(new URL(`../../api/order/${id}`, import.meta.url), { signal, headers: { Accept: 'application/json' } });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

customElements.define(
  'fw-order',
  class extends FwElement {
    async setup() {
      const id = new URLSearchParams(location.search).get('id') || '';
      if (!ORDER_ID.test(id)) return this.show('pending');
      for (let poll = 0; poll < POLLS; poll++) {
        const result = await statusOf(id, this.signal);
        if (this.signal.aborted) return;
        if (result?.status === 'paid') {
          cart.remove(...result.keys);
          return this.show('paid');
        }
        if (CLOSED.includes(result?.status)) return this.show('closed');
        await sleep(POLL_MS);
      }
      this.show('pending');
    }

    show(state) {
      for (const el of this.$$('[data-state]')) el.hidden = el.dataset.state !== state;
    }
  },
);
