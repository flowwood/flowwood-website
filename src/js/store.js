const CART_STORAGE_KEY = 'fw:cart:v1';
const isQuantity = (n) => Number.isInteger(n) && n >= 0;
const read = () => {
  try {
    const v = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '{}');
    return v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([, n]) => isQuantity(n))) : {};
  } catch {
    return {};
  }
};

let lines = read();
const emit = (type, detail) => window.dispatchEvent(new CustomEvent(type, { detail }));
const commit = () => {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
  } catch {}
  emit('cart:change', { lines });
};

window.addEventListener('storage', (e) => {
  if (e.key !== CART_STORAGE_KEY) return;
  lines = read();
  emit('cart:change', { lines });
});

export const cart = {
  get lines() {
    return lines;
  },
  qty: (key) => lines[key] || 0,
  count: () => Object.values(lines).reduce((a, n) => a + n, 0),
  add(key, n = 1) {
    lines = { ...lines, [key]: (lines[key] || 0) + n };
    commit();
  },
  set(key, n) {
    lines = { ...lines, [key]: Math.max(0, n) };
    commit();
  },
  remove(...keys) {
    lines = { ...lines };
    keys.forEach((k) => delete lines[k]);
    commit();
  },
  prune() {
    if (!Object.values(lines).some((n) => n === 0)) return;
    lines = Object.fromEntries(Object.entries(lines).filter(([, n]) => n > 0));
    commit();
  },
};

const configsById = new Map();
export const config = {
  get: (id) => configsById.get(id),
  set(id, value) {
    configsById.set(id, value);
    emit('config:change', { id, value });
  },
};

const DETAILS_STORAGE_KEY = 'fw:details:v1';
export const details = {
  get() {
    try {
      const v = JSON.parse(localStorage.getItem(DETAILS_STORAGE_KEY) || 'null');
      return v && typeof v === 'object' ? v : null;
    } catch {
      return null;
    }
  },
  save(value) {
    try {
      localStorage.setItem(DETAILS_STORAGE_KEY, JSON.stringify(value));
    } catch {}
  },
  forget() {
    try {
      localStorage.removeItem(DETAILS_STORAGE_KEY);
    } catch {}
  },
};
