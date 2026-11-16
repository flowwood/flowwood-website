import { hero } from '../components/hero/hero.template.js';
import { collection } from '../components/collection/collection.template.js';
import { brand, samples } from '../components/brand/brand.template.js';

export default {
  route: 'home',
  customSize: true,
  lcp: ({ site, catalog }) => catalog.product(site.home.hero.products[0]).image,
  render(ctx) {
    const { site, catalog, i18n } = ctx;
    const products = site.home.collection.products.map((id) => catalog.product(id));
    return [
      hero(ctx),
      collection(ctx, {
        id: 'home',
        variant: 'home',
        title: i18n.t('collection.title'),
        link: { href: i18n.url('shop'), label: i18n.t('collection.all') },
        items: products.map((product) => ({ product, configId: product.id })),
      }),
      brand(ctx),
      samples(ctx),
    ].join('\n');
  },
};
