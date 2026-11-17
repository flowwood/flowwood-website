import { FwElement } from '../../js/element.js';

const READING_LINE = 0.4;
const clamp01 = (n) => Math.min(1, Math.max(0, n));

customElements.define(
  'fw-shop',
  class extends FwElement {
    setup() {
      this.links = this.$$('.shop__link');
      this.groups = this.links.map((a) => this.$(a.hash));
      this.on('scroll', null, () => this.schedule(), window);
      this.on('resize', null, () => this.schedule(), window);
      this.track();
    }

    schedule() {
      if (this.frame) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.track();
      });
    }

    track() {
      const line = innerHeight * READING_LINE;
      const progress = this.groups.map((g) => {
        const r = g.getBoundingClientRect();
        return clamp01((line - r.top) / r.height);
      });
      const current = Math.max(0, progress.findLastIndex((p) => p > 0));
      this.links.forEach((a, i) => {
        a.style.setProperty('--progress', progress[i].toFixed(3));
        if (i === current) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
      this.reveal(this.links[current]);
    }

    reveal(link) {
      if (link === this.revealed) return;
      this.revealed = link;
      const list = link.closest('.shop__list');
      if (list.scrollWidth <= list.clientWidth) return;
      list.scrollTo({ left: link.parentElement.offsetLeft - list.offsetLeft, behavior: 'smooth' });
    }
  },
);
