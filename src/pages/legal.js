import { legal } from '../components/legal/legal.template.js';

const legalPage = (route) => ({ route, render: (ctx) => legal(ctx, route) });

export const terms = legalPage('terms');
export const privacy = legalPage('privacy');
