import { brand } from '../components/brand/brand.template.js';

export default {
  route: 'about',
  lcp: ({ site }) => site.home.brandImage,
  render: (ctx) => brand(ctx, { headingLevel: 1 }),
};
