import { FwElement } from '../../js/element.js';

const TOKEN_WAIT_MS = 60000;
const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let turnstileLoaded;
const loadTurnstile = () =>
  (turnstileLoaded ??= new Promise((resolve, reject) => {
    const script = Object.assign(document.createElement('script'), { src: TURNSTILE_SCRIPT });
    script.onload = () => resolve(window.turnstile);
    script.onerror = () => {
      turnstileLoaded = null;
      script.remove();
      reject(new Error('turnstile'));
    };
    document.head.append(script);
  }));

const post = (form) =>
  fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
    .then((response) => response.json())
    .then((body) => body.outcome || 'failed')
    .catch(() => 'failed');

customElements.define(
  'fw-contact',
  class extends FwElement {
    setup() {
      this.submit = this.$('.contact__submit');
      this.submitLabel = this.$('.contact__submit-label');
      this.token = this.$('.contact__token');
      this.idleLabel = this.submitLabel.textContent;
      this.validates();
      this.on('focusin', '.contact__form', () => this.challenge());
      this.on('input', '.contact__form', () => this.challenge());
      this.on('submit', '.contact__form', (event, form) => {
        event.preventDefault();
        this.send(form);
      });
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      if (this.widget !== undefined) window.turnstile?.remove(this.widget);
    }

    challenge() {
      this.rendering ??= loadTurnstile()
        .then((turnstile) => this.render(turnstile))
        .catch(() => (this.rendering = null));
      return this.rendering;
    }

    render(turnstile) {
      if (!this.isConnected) return;
      this.widget = turnstile.render(this.$('.contact__challenge'), {
        sitekey: this.dataset.turnstile,
        action: 'contact',
        appearance: 'interaction-only',
        language: document.documentElement.dataset.locale,
        'response-field': false,
        'refresh-expired': 'auto',
        callback: (token) => this.settle(token),
        'expired-callback': () => (this.token.value = ''),
        'error-callback': () => this.settle(''),
      });
    }

    settle(token) {
      this.token.value = token;
      this.waiting?.(token);
    }

    nextToken() {
      if (this.token.value || this.widget === undefined) return this.token.value;
      return new Promise((resolve) => {
        this.waiting = resolve;
        setTimeout(resolve, TOKEN_WAIT_MS, '');
      });
    }

    async send(form) {
      this.showOutcome('');
      this.setBusy(form, true);
      await this.challenge();
      await this.nextToken();
      const outcome = await post(form);
      this.renew();
      this.setBusy(form, false);
      if (outcome === 'sent') form.reset();
      this.showOutcome(outcome);
    }

    renew() {
      this.token.value = '';
      if (this.widget !== undefined) window.turnstile.reset(this.widget);
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
