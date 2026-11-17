const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TOKEN_LENGTH = 2048;

export const sameOrigin = (request) => request.headers.get('Origin') === new URL(request.url).origin;

const clientIp = (request) => request.headers.get('CF-Connecting-IP') || '';

export async function passedChallenge(request, token, secret) {
  if (!secret || !token || token.length > TOKEN_LENGTH) return false;
  const body = new URLSearchParams({ secret, response: token });
  const ip = clientIp(request);
  if (ip) body.set('remoteip', ip);
  const response = await fetch(SITEVERIFY, { method: 'POST', body }).catch(() => null);
  const result = response?.ok ? await response.json().catch(() => ({})) : {};
  return result.success === true;
}

async function fingerprint(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function withinRate(request, db, { scope, limit, seconds }) {
  if (!db) return true;
  const period = Math.floor(Date.now() / 1000 / seconds);
  const key = `${scope}:${await fingerprint(clientIp(request))}`;
  const [, counted] = await db.batch([
    db.prepare('DELETE FROM rate_limit WHERE scope = ?1 AND period < ?2').bind(scope, period),
    db
      .prepare('INSERT INTO rate_limit (key, scope, period, hits) VALUES (?1, ?2, ?3, 1) ON CONFLICT (key) DO UPDATE SET hits = hits + 1 RETURNING hits')
      .bind(key, scope, period),
  ]);
  return counted.results[0].hits <= limit;
}

export async function guard({ request, env }, { token, scope, limit, seconds }) {
  if (!sameOrigin(request)) return 'origin';
  if (!(await passedChallenge(request, token, env.TURNSTILE_SECRET_KEY))) return 'challenge';
  if (!(await withinRate(request, env.DB, { scope, limit, seconds }).catch(() => true))) return 'rate';
  return null;
}
