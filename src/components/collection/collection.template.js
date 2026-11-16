import { bem, esc } from '../../js/bem.js';
import { productCard } from '../product-card/product-card.template.js';

export function collection(ctx, { id, title, link, count, items, variant, priority = false }) {
  const b = bem('collection', id);
  return `<section ${b('', { mods: { [variant]: true } })} data-collection="${esc(id)}" aria-labelledby="${b.id('title')}">
  <div ${b('head')}>
    <h2 ${b('title')}>${esc(title)}</h2>
    ${link ? `<a ${b('link', { cls: 'link hit' })} href="${link.href}">${esc(link.label)}</a>` : ''}
    ${count ? `<span ${b('count')}>${esc(count)}</span>` : ''}
  </div>
  <div ${b('grid')}>
    ${items.map((it, i) => productCard(ctx, { product: it.product, instance: `${id}-${it.product.id}`, configId: it.configId, seed: it.seed, priority: priority && i === 0 })).join('')}
  </div>
</section>`;
}
