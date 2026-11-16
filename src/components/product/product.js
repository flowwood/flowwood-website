import { FwElement } from '../../js/element.js';

const LONG_PRESS_MS = 250;
const PRESS_SLOP_PX = 8;
const ZOOMED = 'product__slide--zoomed';
const PHOTO_LINKS = '.product__pick, .product__thumb';

const percentWithin = (value, start, size) => `${Math.min(100, Math.max(0, ((value - start) / size) * 100))}%`;

customElements.define(
  'fw-product',
  class extends FwElement {
    setup() {
      this.track = this.$('.product__track');
      this.slides = this.$$('.product__slide');
      this.on('pointerdown', '.product__slide', (e, slide) => this.press(e, slide));
      this.on('contextmenu', '.product__slide', (e) => this.pressing && e.preventDefault());
      this.on('dragstart', '.product__image', (e) => e.preventDefault());
      this.addEventListener('touchmove', (e) => this.zoomed && e.cancelable && e.preventDefault(), { passive: false, signal: this.signal });
      if (this.slides.length < 2) return;
      this.on('click', PHOTO_LINKS, (e, thumb) => {
        e.preventDefault();
        this.go(this.slides.indexOf(this.$(thumb.hash)));
      });
      this.on('click', '.product__step', (e, button) => this.go(this.current() + Number(button.dataset.step)));
      this.track.addEventListener('scrollend', () => this.mark(this.current()), { signal: this.signal });
    }

    current() {
      return Math.min(this.slides.length - 1, Math.round(this.track.scrollLeft / this.track.clientWidth));
    }

    go(index) {
      const count = this.slides.length;
      const slide = this.slides[((index % count) + count) % count];
      this.track.scrollTo({ left: slide.offsetLeft });
      this.mark(this.slides.indexOf(slide));
    }

    mark(index) {
      const id = this.slides[index].id;
      for (const thumb of this.$$(PHOTO_LINKS)) {
        if (thumb.hash === `#${id}`) thumb.setAttribute('aria-current', 'true');
        else thumb.removeAttribute('aria-current');
      }
    }

    press(e, slide) {
      if (e.button !== 0 || this.pressing) return;
      const isMouse = e.pointerType === 'mouse';
      const start = { x: e.clientX, y: e.clientY };
      const ac = new AbortController();
      const opts = { signal: ac.signal };
      let last = e;
      let timer = 0;
      const release = () => {
        clearTimeout(timer);
        ac.abort();
        this.pressing = false;
        this.zoom(slide, false);
      };
      const zoomAt = (ev) => {
        slide.setPointerCapture(e.pointerId);
        this.zoom(slide, true);
        this.aim(slide, ev);
      };
      this.pressing = true;
      if (isMouse) {
        e.preventDefault();
        zoomAt(e);
      } else {
        timer = setTimeout(() => zoomAt(last), LONG_PRESS_MS);
      }
      slide.addEventListener(
        'pointermove',
        (ev) => {
          last = ev;
          if (this.zoomed) return this.aim(slide, ev);
          if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > PRESS_SLOP_PX) release();
        },
        opts,
      );
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) slide.addEventListener(type, release, opts);
      this.signal.addEventListener('abort', release, opts);
    }

    zoom(slide, on) {
      this.zoomed = on;
      slide.classList.toggle(ZOOMED, on);
    }

    aim(slide, e) {
      const r = slide.getBoundingClientRect();
      slide.style.setProperty('--zoom-x', percentWithin(e.clientX, r.left, r.width));
      slide.style.setProperty('--zoom-y', percentWithin(e.clientY, r.top, r.height));
    }
  },
);
