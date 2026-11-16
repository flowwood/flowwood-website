import { product, images } from '../components/product/product.template.js';

const productOf = ({ catalog, item }) => catalog.product(item);
const absolute = (site, src) => (/^https?:/.test(src) ? src : `${site.origin}${src}`);
const SCHEMA = 'https://schema.org';

function offers({ catalog }, p, url) {
  const shared = { priceCurrency: 'EUR', url };
  if (!catalog.isSized(p)) return { '@type': 'Offer', price: p.pricing.fixed, availability: `${SCHEMA}/InStock`, ...shared };
  const tallest = catalog.defaults(p, { height: p.sizing.heights.at(-1) });
  return { '@type': 'AggregateOffer', lowPrice: catalog.fromPrice(p), highPrice: catalog.price(tallest), availability: `${SCHEMA}/MadeToOrder`, ...shared };
}

function structuredData(ctx, p, description) {
  const { site, i18n, locale } = ctx;
  const url = `${site.origin}${i18n.url('shop', locale, p.id)}`;
  return {
    '@context': SCHEMA,
    '@type': 'Product',
    name: p.name,
    description,
    sku: p.id,
    url,
    image: images(p).map((image) => absolute(site, image.src)),
    brand: { '@type': 'Brand', name: site.name },
    offers: offers(ctx, p, url),
  };
}

export default {
  route: 'shop',
  customSize: true,
  products: ({ catalog }) => catalog.data.products,
  lcp: (ctx) => images(productOf(ctx))[0],
  meta(ctx) {
    const { site, i18n } = ctx;
    const p = productOf(ctx);
    const description = i18n.loc(p.description || p.summary);
    return { title: `${p.name} · ${i18n.loc(p.summary)} · ${site.name}`, description, jsonLd: structuredData(ctx, p, description) };
  },
  render: (ctx) => product(ctx, productOf(ctx)),
};
