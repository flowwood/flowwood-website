import site from '../../content/site.json' with { type: 'json' };

const RESEND_URL = 'https://api.resend.com/emails';
const SENDER = 'Flowwood website <website@flowwood.be>';
const RECIPIENT = site.contact.email;
const LIMITS = site.contact.limits;
const LOCAL_PAGE = /^\/[a-z]{2}\/[a-z-]+\/$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    page: LOCAL_PAGE.test(back) ? back : '/',
  };
}

const withinLimits = (submission) => Object.entries(LIMITS).every(([name, max]) => submission[name].length <= max);
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

const answer = (request, submission, delivered) =>
  wantsJson(request) ? Response.json({ delivered }, { status: delivered ? 200 : 502 }) : backTo(request, submission, delivered ? 'sent' : 'failed');

const backTo = (request, submission, outcome) => Response.redirect(new URL(`${submission.page}#contact__status--${outcome}`, request.url).href, 303);

export async function onRequestPost({ request, env }) {
  const submission = readSubmission(await request.formData().catch(() => new FormData()));
  if (submission.honeypot) return answer(request, submission, true);
  const delivered = isComplete(submission) && (await deliver(submission, env.RESEND_API_KEY).catch(() => false));
  return answer(request, submission, delivered);
}
