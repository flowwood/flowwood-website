import { bem, esc } from '../../js/bem.js';
import { collection } from '../collection/collection.template.js';

export function shop(ctx) {
  const { catalog, i18n } = ctx;
  const b = bem('shop');
  const cols = catalog.data.collections;

  return `<fw-shop ${b()}>
  <aside ${b('side')}>
    <h1 ${b('title', { cls: 'eyebrow visually-hidden--mobile' })}>${esc(i18n.t('shop.title'))}</h1>
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
  </aside>
  <div ${b('groups')}>
    ${cols
      .map((c, i) =>
        collection(ctx, {
          id: c.id,
          variant: 'group',
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
