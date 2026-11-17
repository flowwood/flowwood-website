import { FwElement } from '../../js/element.js';

const post = (form) =>
  fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
    .then((response) => response.ok)
    .catch(() => false);

customElements.define(
  'fw-contact',
  class extends FwElement {
    setup() {
      this.submit = this.$('.contact__submit');
      this.submitLabel = this.$('.contact__submit-label');
      this.idleLabel = this.submitLabel.textContent;
      this.validates();
      this.on('submit', '.contact__form', (event, form) => {
        event.preventDefault();
        this.send(form);
      });
    }

    async send(form) {
      this.showOutcome('');
      this.setBusy(form, true);
      const delivered = await post(form);
      this.setBusy(form, false);
      if (delivered) form.reset();
      this.showOutcome(delivered ? 'sent' : 'failed');
    }

    setBusy(form, busy) {
      form.ariaBusy = String(busy);
      this.submit.disabled = busy;
      this.submitLabel.textContent = busy ? this.dataset.sending : this.idleLabel;
    }

    showOutcome(outcome) {
      this.dataset.outcome = outcome;
      if (outcome) this.$(`.contact__status--${outcome}`).focus();
    }
  },
);
