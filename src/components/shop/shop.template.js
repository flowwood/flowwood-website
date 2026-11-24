import { bem, esc, img } from '../../js/bem.js';
import { collection } from '../collection/collection.template.js';

const headSpan = (count, columns) => {
  const rest = count % columns;
  return rest ? columns - rest : columns;
};

const collectionFinishes = (catalog, items) => {
  const finishes = items.map((it) => catalog.finish(catalog.product(it.product), it.finish));
  return finishes.filter((f, i) => finishes.findIndex((g) => g.color === f.color) === i);
};

const moodImage = (catalog, items) => {
  const pictured = items.map((it) => catalog.product(it.product)).find((p, i) => catalog.finish(p, items[i].finish) === p.finishes[0]);
  return pictured && (pictured.altImage || pictured.image);
};

function panel(ctx, b, c, current) {
  const { catalog, i18n } = ctx;
  const name = i18n.loc(c.name);
  const mood = moodImage(catalog, c.items);
  const finishes = collectionFinishes(catalog, c.items);
  const swatches = finishes.map((f) => `<li ${b('finish', { key: `${c.id}-${f.id}`, cls: 'swatch' })} style="--swatch:${esc(f.color)}"></li>`).join('');
  const names = finishes.map((f) => i18n.loc(f.name)).join(', ');
  return `<div ${b('panel', { key: c.id })} data-collection="${esc(c.id)}"${current ? '' : ' hidden'}>
      <p ${b('heading', { key: c.id, cls: 'eyebrow' })}>${esc(i18n.t('shop.finishes', { name }))}</p>
      <ul ${b('finishes', { key: c.id })} aria-hidden="true">${swatches}</ul>
      <p ${b('names', { key: c.id, cls: 'shop__detail' })}>${esc(names)}</p>
      ${mood ? `<div ${b('mood', { key: c.id, cls: 'media' })}>${img(mood, { attrs: b('mood-image', { key: c.id }), thumb: true, priority: 'low' })}</div>` : ''}
    </div>`;
}

function facts(ctx, b) {
  const { catalog, i18n } = ctx;
  const { height, width } = catalog.customSize;
  const fact = (key, term, detail) => `<div ${b('fact', { key })}><dt ${b('term', { key, cls: 'eyebrow' })}>${esc(term)}</dt>${detail
    .map((d, i) => `<dd ${b('detail', { key: `${key}-${i}` })}>${esc(d)}</dd>`)
    .join('')}</div>`;
  return `<dl ${b('facts')}>
      ${fact('delivery', i18n.t('customSize.delivery'), [i18n.t('customSize.leadTime'), i18n.countries(catalog.data.delivery.countries)])}
      ${fact('custom', i18n.t('customSize.title'), [i18n.t('shop.customRange', { hMin: height.min, hMax: height.max, wMin: width.min, wMax: width.max })])}
    </dl>`;
}

const VIEW_ICONS = { tiles: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', rows: 'M3 6h18M3 12h18M3 18h18' };

function views(ctx, b) {
  const { i18n } = ctx;
  return `<div ${b('views')} role="radiogroup" aria-label="${esc(i18n.t('shop.view'))}">
      ${Object.entries(VIEW_ICONS)
        .map(
          ([view, d], i) => `<label ${b('view', { key: view, cls: 'hit' })} title="${esc(i18n.t(`shop.${view}`))}">
        <input ${b('input', { key: view, mods: { [view]: true }, cls: 'visually-hidden' })} type="radio" name="shop-view" value="${view}" aria-label="${esc(i18n.t(`shop.${view}`))}"${i === 0 ? ' checked' : ''}>
        <svg ${b('icon', { key: view })} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path ${b('icon-path', { key: view })} d="${d}"></path></svg>
      </label>`,
        )
        .join('')}
    </div>`;
}

export function shop(ctx) {
  const { catalog, i18n } = ctx;
  const b = bem('shop');
  const cols = catalog.data.collections;

  return `<fw-shop ${b()}>
  <aside ${b('side')}>
    <div ${b('bar')}>
      <h1 ${b('title', { cls: 'eyebrow visually-hidden--mobile' })}>${esc(i18n.t('shop.title'))}</h1>
      ${views(ctx, b)}
    </div>
    <nav ${b('contents')} aria-label="${esc(i18n.t('shop.filter'))}">
      <ol ${b('list')}>
        ${cols
          .map(
            (c, i) => `<li ${b('entry', { key: c.id })}><a ${b('link', { key: c.id })} href="#${bem('collection', c.id).id()}"${i === 0 ? ' aria-current="location"' : ''}>
          <span ${b('label', { key: c.id })}>${esc(i18n.loc(c.name))}</span><span ${b('count', { key: c.id })}>${c.items.length}</span>
        </a></li>`,
          )
          .join('')}
      </ol>
    </nav>
    <div ${b('about')}>
      ${cols.map((c, i) => panel(ctx, b, c, i === 0)).join('')}
      ${facts(ctx, b)}
    </div>
  </aside>
  <div ${b('groups')}>
    ${cols
      .map((c, i) =>
        collection(ctx, {
          id: c.id,
          variant: 'group',
          mods: { [`head-${headSpan(c.items.length, 3)}`]: true, [`head-tablet-${headSpan(c.items.length, 2)}`]: true },
          title: i18n.loc(c.name),
          intro: c.intro && i18n.loc(c.intro),
          count: i18n.pieces(c.items.length),
          priority: i === 0,
          items: c.items.map((it) => ({ product: catalog.product(it.product), seed: { finish: it.finish, height: it.height } })),
        }),
      )
      .join('')}
  </div>
</fw-shop>`;
}
