import { cart } from '../components/cart/cart.template.js';

export default {
  route: 'cart',
  customSize: true,
  blocks: ['cart-control'],
  render: (ctx) => cart(ctx),
};
