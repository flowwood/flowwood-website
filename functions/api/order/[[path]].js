import site from '../../../content/site.json' with { type: 'json' };
import catalogData from '../../../dist/data/catalog.json' with { type: 'json' };
import { createCatalog, describe, sum } from '../../../src/js/catalog.js';
import { createI18n } from '../../../src/js/i18n.js';
import { sameOrigin, withinRate } from '../../_lib/guard.js';
import { legalText } from '../../../src/components/legal/legal.template.js';

const MOLLIE = 'https://api.mollie.com/v2/payments';
const RESEND = 'https://api.resend.com/emails';
const SENDER = 'Flowwood <website@flowwood.be>';
const MAX_LINES = 30;
const MAX_QTY = 20;
const ORDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PAYMENT_ID = /^tr_\w+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const MOLLIE_LOCALES = { nl: 'nl_BE', en: 'en_GB' };
const CLOSED = ['failed', 'canceled', 'expired'];
const RATE = { scope: 'order', limit: 10, seconds: 600 };
const TERMS_RULE = '—'.repeat(32);
const IF_PENDING = "EXISTS (SELECT 1 FROM orders WHERE id = ?3 AND status = 'pending')";

const catalog = createCatalog(catalogData);
const { delivery } = catalogData;
const postcodeOf = new Map(delivery.countries.map((c) => [c.code, new RegExp(`^(?:${c.postcode})$`, 'v')]));

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const originOf = (request) => new URL(request.url).origin;
const orderNumber = (id) => id.slice(0, 8).toUpperCase();
const oneLine = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const severalLines = (value) => String(value ?? '').replace(/\r\n?/g, '\n').trim();

function readCustomer(details) {
  const invalid = [];
  const take = (name, { limit = name, optional = false, valid = () => true, value = oneLine(details[name]) } = {}) => {
    if ((!value && !optional) || value.length > (site.limits[limit] ?? Infinity) || (value && !valid(value))) invalid.push(name);
    return value;
  };
  const address = (prefix) => {
    const country = take(`${prefix}country`, { valid: (code) => postcodeOf.has(code) });
    return {
      name: take(`${prefix}name`, { limit: 'name' }),
      address: take(`${prefix}address`, { limit: 'address' }),
      address2: prefix ? '' : take('address2', { limit: 'address', optional: true }),
      postcode: take(`${prefix}postcode`, { limit: 'postcode', valid: (v) => postcodeOf.get(country)?.test(v) }),
      city: take(`${prefix}city`, { limit: 'city' }),
      country,
    };
  };
  const shipping = address('');
  const customer = {
    email: take('email', { valid: (v) => EMAIL.test(v) }),
    phone: take('phone'),
    shipping,
    billing: details['same-billing'] === true ? shipping : address('billing-'),
    notes: take('notes', { optional: true, value: severalLines(details.notes) }),
  };
  return { customer, invalid };
}

function readLine(i18n, [key, qty]) {
  const config = catalog.parseKey(key);
  if (!config || catalog.lineKey(config) !== key || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return null;
  const product = catalog.product(config.product);
  const { finish, size } = describe(catalog, i18n, config);
  return { key, product: product.id, name: product.name, finish, size, custom: Boolean(config.custom), qty, price: catalog.price(config) };
}

function readLines(i18n, entries) {
  if (!entries.length || entries.length > MAX_LINES) return null;
  const lines = entries.map((entry) => readLine(i18n, entry));
  return lines.every(Boolean) ? lines : null;
}

const perProduct = (lines) => [...lines.reduce((m, l) => m.set(l.product, (m.get(l.product) ?? 0) + l.qty), new Map())];
const reserve = (db) => ([product, qty]) => db.prepare('UPDATE stock SET quantity = quantity - ?1 WHERE product = ?2').bind(qty, product);
const release = (db, id) => ([product, qty]) => db.prepare(`UPDATE stock SET quantity = quantity + ?1 WHERE product = ?2 AND ${IF_PENDING}`).bind(qty, product, id);

async function shortages(db, wanted) {
  const { results } = await db.prepare(`SELECT product, quantity FROM stock WHERE product IN (${wanted.map(() => '?').join(', ')})`).bind(...wanted.map(([product]) => product)).all();
  const left = new Map(results.map((r) => [r.product, r.quantity]));
  return wanted.filter(([product, qty]) => left.has(product) && left.get(product) < qty).map(([product]) => ({ product, left: left.get(product) }));
}

async function mollie(env, path = '', init = {}) {
  const response = await fetch(`${MOLLIE}${path}`, { ...init, headers: { Authorization: `Bearer ${env.MOLLIE_API_KEY}`, 'Content-Type': 'application/json' } });
  if (!response.ok) throw new Error(`Mollie ${response.status}`);
  return response.json();
}

async function createPayment(env, { id, locale, totalCents, origin }) {
  const webhookUrl = LOCAL_ORIGIN.test(origin) ? {} : { webhookUrl: `${origin}/api/order/webhook` };
  const body = {
    amount: { currency: 'EUR', value: (totalCents / 100).toFixed(2) },
    description: `Flowwood ${orderNumber(id)}`,
    redirectUrl: `${origin}${createI18n(site, locale).url('order')}?id=${id}`,
    ...webhookUrl,
    locale: MOLLIE_LOCALES[locale],
    metadata: { order: id },
  };
  return mollie(env, '', { method: 'POST', body: JSON.stringify(body) });
}

const close = (db, order, status) =>
  db.batch([...perProduct(order.lines).map(release(db, order.id)), db.prepare("UPDATE orders SET status = ?1, updated_at = datetime('now') WHERE id = ?2 AND status = 'pending'").bind(status, order.id)]);

async function create(request, env) {
  if (!sameOrigin(request)) return json({ error: 'origin' }, 403);
  if (!(await withinRate(request, env.DB, RATE).catch(() => true))) return json({ error: 'rate' }, 429);
  const body = Object(await request.json().catch(() => null));
  const locale = Object.hasOwn(site.locales, body.locale) ? body.locale : site.defaultLocale;
  const lines = readLines(createI18n(site, locale), Object.entries(Object(body.lines)));
  const { customer, invalid } = readCustomer(Object(body.details));
  if (!lines || invalid.length) return json({ error: 'invalid', fields: invalid }, 422);
  const id = crypto.randomUUID();
  const totalCents = Math.round((sum(lines, (l) => l.price * l.qty) + delivery.price) * 100);
  const wanted = perProduct(lines);
  const insert = env.DB.prepare('INSERT INTO orders (id, locale, email, customer, lines, total_cents) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(id, locale, customer.email, JSON.stringify(customer), JSON.stringify(lines), totalCents);
  try {
    await env.DB.batch([...wanted.map(reserve(env.DB)), insert]);
  } catch (error) {
    const short = await shortages(env.DB, wanted);
    if (short.length) return json({ error: 'stock', products: short }, 409);
    throw error;
  }
  const payment = await createPayment(env, { id, locale, totalCents, origin: originOf(request) }).catch((error) => console.error(error));
  if (!payment) {
    await close(env.DB, { id, lines }, 'failed');
    return json({ error: 'payment' }, 502);
  }
  await env.DB.prepare("UPDATE orders SET payment = ?1, updated_at = datetime('now') WHERE id = ?2").bind(payment.id, id).run();
  return json({ checkout: payment._links.checkout.href }, 201);
}

async function load(db, column, value) {
  const row = await db.prepare(`SELECT * FROM orders WHERE ${column} = ?1`).bind(value).first();
  return row && { ...row, customer: JSON.parse(row.customer), lines: JSON.parse(row.lines) };
}

async function sync(env, order) {
  if (order.status !== 'pending' || !order.payment) return order;
  const { status } = await mollie(env, `/${order.payment}`);
  if (status === 'paid') await env.DB.prepare("UPDATE orders SET status = 'paid', updated_at = datetime('now') WHERE id = ?1 AND status = 'pending'").bind(order.id).run();
  else if (CLOSED.includes(status)) await close(env.DB, order, status);
  else return order;
  return load(env.DB, 'id', order.id);
}

const addressLines = (i18n, a) => [a.name, a.address, a.address2, `${a.postcode} ${a.city}`, i18n.countries([{ code: a.country }])].filter(Boolean);

function summaryLines(i18n, order) {
  const t = (key, vars) => i18n.t(`orderEmail.${key}`, vars);
  return [
    ...order.lines.flatMap((l) => [`${l.qty} × ${l.name} · ${l.finish} · ${l.size}: ${i18n.money(l.price * l.qty)}`, ...(l.custom ? [`  ${i18n.t('checkout.noWithdrawal')}`] : [])]),
    `${t('delivery')}: ${delivery.price ? i18n.money(delivery.price) : i18n.t('checkout.free')}`,
    `${t('total')}: ${i18n.money(order.total_cents / 100)} (${i18n.t('checkout.vat')})`,
  ];
}

function customerEmail(order, origin) {
  const i18n = createI18n(site, order.locale);
  const t = (key, vars) => i18n.t(`orderEmail.${key}`, vars);
  const number = orderNumber(order.id);
  const [from, to] = delivery.weeks;
  return {
    to: order.email,
    reply_to: site.contact.email,
    subject: t('subject', { number }),
    text: [
      t('greeting', { name: order.customer.shipping.name }),
      t('confirmed', { number }),
      '',
      ...summaryLines(i18n, order),
      '',
      `${t('deliverTo')}:`,
      ...addressLines(i18n, order.customer.shipping),
      t('expected', { from, to }),
      '',
      t('questions', { phone: site.contact.phone, email: site.contact.email }),
      '',
      t('terms', { url: `${origin}${i18n.url('terms')}` }),
      '',
      TERMS_RULE,
      '',
      legalText({ site, catalog, i18n, locale: order.locale }, 'terms'),
    ].join('\n'),
  };
}

function shopEmail(order) {
  const i18n = createI18n(site, site.defaultLocale);
  const t = (key, vars) => i18n.t(`orderEmail.${key}`, vars);
  const { customer } = order;
  const billing = JSON.stringify(customer.billing) === JSON.stringify(customer.shipping) ? [t('sameBilling')] : addressLines(i18n, customer.billing);
  return {
    to: site.contact.email,
    reply_to: customer.email,
    subject: t('shopSubject', { number: orderNumber(order.id), name: customer.shipping.name }),
    text: [
      `${customer.email} · ${customer.phone} · ${order.locale}`,
      '',
      ...summaryLines(i18n, order),
      '',
      `${t('deliverTo')}:`,
      ...addressLines(i18n, customer.shipping),
      '',
      `${t('billTo')}:`,
      ...billing,
      ...(customer.notes ? ['', `${t('notes')}:`, customer.notes] : []),
      '',
      `${order.id} · ${order.payment}`,
    ].join('\n'),
  };
}

async function send(env, email) {
  const response = await fetch(RESEND, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: SENDER, ...email }),
  });
  if (!response.ok) throw new Error(`Resend ${response.status}`);
}

async function notifyOnce(env, order, origin) {
  if (order.status !== 'paid' || order.notified) return;
  const claim = await env.DB.prepare('UPDATE orders SET notified = 1 WHERE id = ?1 AND notified = 0').bind(order.id).run();
  if (!claim.meta.changes) return;
  try {
    await Promise.all([send(env, shopEmail(order)), send(env, customerEmail(order, origin))]);
  } catch (error) {
    await env.DB.prepare('UPDATE orders SET notified = 0 WHERE id = ?1').bind(order.id).run();
    throw error;
  }
}

async function webhook(request, env) {
  const id = String((await request.formData().catch(() => new FormData())).get('id') ?? '');
  const order = PAYMENT_ID.test(id) && (await load(env.DB, 'payment', id));
  if (order) await notifyOnce(env, await sync(env, order), originOf(request));
  return new Response(null, { status: 200 });
}

async function status(request, env, id) {
  const stored = await load(env.DB, 'id', id);
  if (!stored) return json({ error: 'not found' }, 404);
  const order = await sync(env, stored).catch(() => stored);
  await notifyOnce(env, order, originOf(request)).catch((error) => console.error(error));
  return json({ status: order.status, keys: order.status === 'paid' ? order.lines.map((l) => l.key) : [] });
}

export async function onRequest({ request, env, params }) {
  const path = [].concat(params.path ?? []);
  const [route = ''] = path;
  try {
    if (path.length > 1) return json({ error: 'not found' }, 404);
    if (route === '' && request.method === 'POST') return await create(request, env);
    if (route === 'webhook' && request.method === 'POST') return await webhook(request, env);
    if (ORDER_ID.test(route) && request.method === 'GET') return await status(request, env, route);
    return json({ error: 'not found' }, 404);
  } catch (error) {
    console.error(error);
    return json({ error: 'server' }, 500);
  }
}
