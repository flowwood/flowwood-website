import { shop } from '../components/shop/shop.template.js';

export default {
  route: 'shop',
  customSize: true,
  lcp: ({ catalog }) => catalog.product(catalog.data.collections[0].items[0].product).image,
  render: (ctx) => shop(ctx),
};
