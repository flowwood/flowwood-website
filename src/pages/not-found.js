import { notFound } from '../components/not-found/not-found.template.js';

export default {
  route: 'home',
  current: '',
  index: false,
  meta: 'notFound',
  render: (ctx) => notFound(ctx),
};
