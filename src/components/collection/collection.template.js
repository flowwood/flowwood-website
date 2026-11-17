import { bem, esc } from '../../js/bem.js';
import { productCard } from '../product-card/product-card.template.js';

export function collection(ctx, { id, title, titleClass, intro, link, count, items, variant, mods = {}, card, priority = false }) {
  const b = bem('collection', id);
  return `<section ${b('', { mods: { [variant]: true, ...mods } })} data-collection="${esc(id)}" aria-labelledby="${b.id('title')}">
  <div ${b('head')}>
    <h2 ${b('title', { cls: titleClass })}>${esc(title)}</h2>
    ${intro ? `<p ${b('intro')}>${esc(intro)}</p>` : ''}
    ${link ? `<a ${b('link', { cls: 'link hit' })} href="${link.href}">${esc(link.label)}</a>` : ''}
    ${count ? `<span ${b('count')}>${esc(count)}</span>` : ''}
  </div>
  <div ${b('grid')}>
    ${items.map((it, i) => productCard(ctx, { product: it.product, instance: `${id}-${it.product.id}`, configId: it.configId, seed: it.seed, variant: card, priority: priority && i === 0 })).join('')}
  </div>
</section>`;
}
