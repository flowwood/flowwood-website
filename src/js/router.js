const htmlRequestsByPath = new Map();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const HOVER_INTENT_MS = 65;
const SCROLL_SAVE_DEBOUNCE_MS = 100;
const SWAPPED_HEAD_TAGS = 'meta[name="description"], meta[name="robots"], link[rel="canonical"], link[rel="alternate"], script[type="application/ld+json"]';
let hoverTimer;

const keyOf = (url) => url.pathname + url.search;

function routable(a, e) {
  if (!a || !a.href || (e && (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey))) return null;
  if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return null;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || /\.\w+$/.test(url.pathname)) return null;
  if (isHashOnCurrentPage(url)) return null;
  return url;
}

const isHashOnCurrentPage = (url) => keyOf(url) === keyOf(location) && Boolean(url.hash);

function prefetch(url) {
  const key = keyOf(url);
  if (!htmlRequestsByPath.has(key)) {
    const p = fetch(key, { credentials: 'same-origin' }).then((r) => {
      if (!r.ok || !(r.headers.get('content-type') || '').includes('text/html')) throw new Error(String(r.status));
      return r.text();
    });
    p.catch(() => htmlRequestsByPath.delete(key));
    htmlRequestsByPath.set(key, p);
  }
  return htmlRequestsByPath.get(key);
}

const ignoreSkippedTransition = () => {};

export function transition(update) {
  if (!document.startViewTransition || reduceMotion.matches) return Promise.resolve(update());
  const vt = document.startViewTransition(update);
  vt.ready.catch(ignoreSkippedTransition);
  return vt.updateCallbackDone;
}

function swapHead(doc) {
  document.title = doc.title;
  document.documentElement.lang = doc.documentElement.lang;
  document.documentElement.dataset.locale = doc.documentElement.dataset.locale;
  const head = document.head;
  head.querySelectorAll(SWAPPED_HEAD_TAGS).forEach((n) => n.remove());
  doc.head.querySelectorAll(SWAPPED_HEAD_TAGS).forEach((n) => head.append(n));
  doc.head.querySelectorAll('style[data-block]').forEach((s) => {
    if (!head.querySelector(`style[data-block="${s.dataset.block}"]`)) head.append(s);
  });
}

async function navigate(url, { pop = false } = {}) {
  let doc;
  try {
    doc = new DOMParser().parseFromString(await prefetch(url), 'text/html');
    if (!doc.getElementById('app__main')) throw new Error('not an app page');
  } catch {
    location.assign(url.href);
    return;
  }
  if (!pop) {
    saveScroll();
    history.pushState({}, '', url.href);
  }
  const swap = () => {
    swapHead(doc);
    document.body.replaceWith(document.adoptNode(doc.body));
    const target = url.hash && document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (pop) scrollTo(0, history.state?.scroll || 0);
    else if (target) target.scrollIntoView();
    else scrollTo(0, 0);
    document.getElementById('app__main')?.focus({ preventScroll: true });
    window.dispatchEvent(new CustomEvent('route:change'));
  };
  await transition(swap);
}

const saveScroll = () => history.replaceState({ ...history.state, scroll: scrollY }, '');

function keepScrollOfEveryEntry() {
  let saving;
  addEventListener(
    'scroll',
    () => {
      clearTimeout(saving);
      saving = setTimeout(saveScroll, SCROLL_SAVE_DEBOUNCE_MS);
    },
    { passive: true },
  );
}

export function start() {
  history.scrollRestoration = 'manual';
  keepScrollOfEveryEntry();
  document.addEventListener('click', (e) => {
    const url = routable(e.target.closest?.('a'), e);
    if (!url) return;
    e.preventDefault();
    navigate(url);
  });
  const prefetchLinkTarget = (e) => {
    const url = routable(e.target.closest?.('a'));
    if (url && keyOf(url) !== keyOf(location)) prefetch(url);
  };
  document.addEventListener('pointerover', (e) => {
    clearTimeout(hoverTimer);
    if (e.pointerType === 'mouse') hoverTimer = setTimeout(() => prefetchLinkTarget(e), HOVER_INTENT_MS);
  });
  document.addEventListener('pointerout', () => clearTimeout(hoverTimer));
  document.addEventListener('pointerdown', prefetchLinkTarget, { passive: true });
  document.addEventListener('focusin', prefetchLinkTarget);
  addEventListener('popstate', () => {
    const url = new URL(location.href);
    if (document.body.dataset.path !== url.pathname) navigate(url, { pop: true });
  });
}
