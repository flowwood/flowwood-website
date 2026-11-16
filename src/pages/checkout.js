import { checkout } from '../components/checkout/checkout.template.js';

export default {
  route: 'checkout',
  current: 'cart',
  index: false,
  render: (ctx) => checkout(ctx),
};
