import { order } from '../components/order/order.template.js';

export default {
  route: 'order',
  current: 'cart',
  index: false,
  render: (ctx) => order(ctx),
};
