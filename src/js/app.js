import { start } from './router.js';
import { LOCALE_STORAGE_KEY } from './i18n.js';

const requestedTags = new Set();
function upgrade() {
  for (const el of document.querySelectorAll(':not(:defined)')) {
    const tag = el.localName;
    if (!tag.startsWith('fw-') || requestedTags.has(tag)) continue;
    requestedTags.add(tag);
    const block = tag.slice(3);
    import(new URL(`../components/${block}/${block}.js`, import.meta.url).href).catch((err) => console.error(`fw: cannot load <${tag}>`, err));
  }
}

function rememberLocale() {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, document.documentElement.dataset.locale);
  } catch {}
}

upgrade();
rememberLocale();
start();
addEventListener('route:change', () => {
  upgrade();
  rememberLocale();
});

const whenIdle = window.requestIdleCallback || setTimeout;
const isDevServer = location.hostname === 'localhost';
if ('serviceWorker' in navigator && !isDevServer) {
  addEventListener('load', () => whenIdle(() => navigator.serviceWorker.register(new URL('../sw.js', import.meta.url))));
}
