import site from '../../content/site.json' with { type: 'json' };
import { guard } from '../_lib/guard.js';

const RESEND_URL = 'https://api.resend.com/emails';
const SENDER = 'Flowwood website <website@flowwood.be>';
const RECIPIENT = site.contact.email;
const LIMITS = site.limits;
const FIELDS = ['name', 'email', 'phone', 'message'];
const LOCAL_PAGE = /^(?:\/[a-z0-9-]+)+\/$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE = { scope: 'contact', limit: 5, seconds: 600 };
const REFUSED = { challenge: { outcome: 'unverified', status: 403 }, rate: { outcome: 'failed', status: 429 } };

const singleLine = (text) => text.replace(/[\r\n]+/g, ' ');

function readSubmission(form) {
  const field = (name) => String(form.get(name) ?? '').trim();
  const back = field('back');
  return {
    name: singleLine(field('name')),
    email: field('email'),
    phone: singleLine(field('phone')),
    message: field('message').replace(/\r\n?/g, '\n'),
    honeypot: field('website'),
    token: field('cf-turnstile-response'),
    page: LOCAL_PAGE.test(back) ? back : '/',
  };
}

const withinLimits = (submission) => FIELDS.every((name) => submission[name].length <= LIMITS[name]);
const isComplete = (submission) => Boolean(submission.name && EMAIL.test(submission.email) && submission.message && withinLimits(submission));

function emailFor(submission) {
  const about = [`${submission.name} <${submission.email}>`, submission.phone, `${site.origin}${submission.page}`].filter(Boolean);
  return {
    from: SENDER,
    to: RECIPIENT,
    reply_to: submission.email,
    subject: `Contact: ${submission.name}`,
    text: [...about, '', submission.message].join('\n'),
  };
}

async function deliver(submission, apiKey) {
  if (!apiKey) return false;
  const response = await fetch(RESEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(emailFor(submission)),
  });
  return response.ok;
}

const wantsJson = (request) => (request.headers.get('Accept') || '').includes('application/json');

const backTo = (request, submission, outcome) => Response.redirect(new URL(`${submission.page}#contact__status--${outcome}`, request.url).href, 303);

const answer = (request, submission, outcome, status) => (wantsJson(request) ? Response.json({ outcome }, { status }) : backTo(request, submission, outcome));

export async function onRequestPost(context) {
  const { request, env } = context;
  const submission = readSubmission(await request.formData().catch(() => new FormData()));
  const refused = await guard(context, { token: submission.token, ...RATE });
  if (refused === 'origin') return new Response(null, { status: 403 });
  if (refused) return answer(request, submission, REFUSED[refused].outcome, REFUSED[refused].status);
  if (submission.honeypot) return answer(request, submission, 'sent', 200);
  const delivered = isComplete(submission) && (await deliver(submission, env.RESEND_API_KEY).catch(() => false));
  return delivered ? answer(request, submission, 'sent', 200) : answer(request, submission, 'failed', 502);
}
