
import { page } from '../../js/element.js';
import { cart, config } from '../../js/store.js';
import { customSizeBody } from './custom-size.template.js';

const wiredDialogs = new WeakSet();

export async function open(configId) {
  const { i18n, catalog } = await page();
  const dialog = document.getElementById('custom-size');
  const c = config.get(configId);
  if (!dialog || !c) return;
  const product = catalog.product(c.product);
  dialog.dataset.config = configId;
  dialog.setAttribute('aria-label', i18n.t('common.customSizeFor', { name: product.name }));
  dialog.innerHTML = customSizeBody({ i18n, catalog }, { product, config: c, configId });
  if (!wiredDialogs.has(dialog)) wire(dialog, { i18n, catalog });
  if (!dialog.open) dialog.showModal();
}

function wire(dialog, { i18n, catalog }) {
  wiredDialogs.add(dialog);
  const cs = catalog.customSize;
  const range = { h: cs.height, w: cs.width };
  const $ = (s) => dialog.querySelector(s);
  const current = () => config.get(dialog.dataset.config);

  const update = (patch) => {
    const c = current();
    const next = { ...c, ...patch, custom: { ...c.custom, ...patch.custom } };
    config.set(dialog.dataset.config, next);
    reflect(next);
  };

  const reflect = (c) => {
    const p = catalog.product(c.product);
    const finish = i18n.loc(catalog.finish(p, c.finish).name);
    for (const el of dialog.querySelectorAll('.custom-size__finish')) el.textContent = finish;
    for (const el of dialog.querySelectorAll('[data-finish]')) el.ariaPressed = String(el.dataset.finish === c.finish);
    for (const dim of ['h', 'w']) {
      const raw = c.custom[dim];
      const ok = catalog.inRange(raw, range[dim]);
      const input = $(`input[data-dim="${dim}"]`);
      if (input.value !== String(raw)) input.value = raw;
      input.ariaInvalid = String(!ok);
      input.closest('.custom-size__field').classList.toggle('custom-size__field--invalid', !ok);
    }
    $('.custom-size__dims').textContent = catalog.outerDimensions(p, catalog.customDims(c));
    $('.custom-size__price').textContent = i18n.money(catalog.price(c));
  };

  dialog.addEventListener('click', (e) => {
    const clickedBackdrop = e.target === dialog;
    if (clickedBackdrop) return dialog.close();
    const el = e.target.closest('[data-close], [data-finish], [data-step], [data-add]');
    if (!el) return;
    if (el.hasAttribute('data-close')) return dialog.close();
    if (el.dataset.finish) return update({ finish: el.dataset.finish });
    if (el.dataset.step) {
      const dim = el.dataset.dim;
      const r = range[dim];
      const v = Number(current().custom[dim]) || r.min;
      return update({ custom: { [dim]: catalog.clamp(v + Number(el.dataset.step) * r.step, r) } });
    }
    cart.add(catalog.lineKey(current()));
    dialog.close();
  });

  dialog.addEventListener('input', (e) => {
    const dim = e.target.dataset?.dim;
    if (!dim) return;
    const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
    update({ custom: { [dim]: Number.isNaN(n) ? '' : n } });
  });
}
