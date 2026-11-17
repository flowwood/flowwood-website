import { CONTENT_FILES, SCHEMA_FILES, checkSave, fromBase64 } from '../../../src/js/cms.js';

const GITHUB = 'https://api.github.com';
const BRANCH = 'main';
const TOKEN_SECONDS = 540;
const MEDIA_TYPES = { webp: 'image/webp', jpg: 'image/jpeg', svg: 'image/svg+xml' };
const MEDIA_NAME = /^[a-z0-9][a-z0-9._-]*\.(webp|jpg|svg)$/;

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const fail = (status, ...errors) => json({ errors }, status);
const base64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64url = (text) => fromBase64(text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '='));
const encodeJson = (value) => base64url(new TextEncoder().encode(JSON.stringify(value)));
const decodeJson = (part) => JSON.parse(new TextDecoder().decode(fromBase64url(part)));

async function accessIdentity(request, env) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return null;
  const [head, payload, signature] = token.split('.');
  const { kid } = decodeJson(head);
  const { keys } = await (await fetch(`${env.CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`)).json();
  const jwk = keys.find((k) => k.kid === kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromBase64url(signature), new TextEncoder().encode(`${head}.${payload}`));
  const claims = decodeJson(payload);
  const audience = [].concat(claims.aud);
  const fresh = claims.exp * 1000 > Date.now();
  return valid && fresh && audience.includes(env.CF_ACCESS_AUD) && claims.iss === env.CF_ACCESS_TEAM_DOMAIN ? claims.email : null;
}

async function appJwt(env) {
  const der = fromBase64(env.GITHUB_APP_PRIVATE_KEY.replace(/-----[^-]+-----/g, '').replace(/\s/g, ''));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encodeJson({ alg: 'RS256', typ: 'JWT' })}.${encodeJson({ iat: now - 60, exp: now + TOKEN_SECONDS, iss: env.GITHUB_APP_ID })}`;
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)));
  return `${unsigned}.${base64url(signature)}`;
}

async function github(path, token, init = {}) {
  const response = await fetch(`${GITHUB}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'flowwood-cms', 'X-GitHub-Api-Version': '2022-11-28', ...init.headers },
  });
  if (!response.ok) throw new Error(`GitHub ${response.status} ${path}`);
  return response;
}

async function installationToken(env) {
  const jwt = await appJwt(env);
  const installation = await (await github(`/repos/${env.GITHUB_REPO}/installation`, jwt)).json();
  const { token } = await (await github(`/app/installations/${installation.id}/access_tokens`, jwt, { method: 'POST' })).json();
  return token;
}

async function graphql(token, query, variables) {
  const body = await (await github('/graphql', token, { method: 'POST', body: JSON.stringify({ query, variables }) })).json();
  if (body.errors) throw new Error(body.errors.map((e) => e.message).join('; '));
  return body.data;
}

const repoName = (env) => {
  const [owner, name] = env.GITHUB_REPO.split('/');
  return { owner, name };
};

async function filesAt(token, env, ref, paths) {
  const fields = paths.map((p, i) => `f${i}: object(expression: ${JSON.stringify(`${ref}:${p}`)}) { ... on Blob { text } }`).join(' ');
  const data = await graphql(token, `query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { ref(qualifiedName: "refs/heads/${BRANCH}") { target { oid } } ${fields} } }`, repoName(env));
  const repo = data.repository;
  return { head: repo.ref.target.oid, files: Object.fromEntries(paths.map((p, i) => [p, repo[`f${i}`]?.text ?? null])) };
}

async function load(token, env) {
  return json(await filesAt(token, env, BRANCH, [...CONTENT_FILES, ...Object.values(SCHEMA_FILES)]));
}

async function touchedSince(token, env, since, paths) {
  if (!paths.length) return [];
  const [before, now] = await Promise.all([filesAt(token, env, since, paths), filesAt(token, env, BRANCH, paths)]);
  return paths.filter((p) => before.files[p] !== now.files[p]);
}

const sameOrigin = (request) => request.headers.get('Origin') === new URL(request.url).origin && (request.headers.get('Content-Type') || '').startsWith('application/json');

async function save(request, token, env, email) {
  if (!sameOrigin(request)) return fail(403, 'cross-origin request refused');
  const { head, message, changes = {}, uploads = {}, deletions = [] } = await request.json();
  const bytes = Object.fromEntries(Object.entries(uploads).map(([path, b64]) => [path, fromBase64(b64)]));
  const { files, head: current } = await filesAt(token, env, BRANCH, Object.values(SCHEMA_FILES));
  const schemas = Object.fromEntries(Object.entries(SCHEMA_FILES).map(([file, schema]) => [file, JSON.parse(files[schema])]));
  const errors = checkSave({ changes, uploads: bytes, deletions }, schemas);
  if (errors.length) return fail(422, ...errors);
  if (head !== current && (await touchedSince(token, env, head, [...Object.keys(changes), ...deletions])).length) return fail(409, 'stale');
  const additions = [...Object.entries(changes).map(([path, text]) => ({ path, contents: btoa(String.fromCharCode(...new TextEncoder().encode(text))) })), ...Object.entries(uploads).map(([path, contents]) => ({ path, contents }))];
  const input = {
    branch: { repositoryNameWithOwner: env.GITHUB_REPO, branchName: BRANCH },
    message: { headline: String(message || 'content: update').slice(0, 200), body: `Co-authored-by: ${email.split('@')[0]} <${email}>` },
    expectedHeadOid: current,
    fileChanges: { additions, deletions: deletions.map((path) => ({ path })) },
  };
  const data = await graphql(token, 'mutation($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid } } }', { input });
  const commit = data.createCommitOnBranch.commit.oid;
  return json({ head: commit, commit });
}

async function status(token, env, commit) {
  if (!/^[0-9a-f]{40}$/.test(commit || '')) return json({ state: 'queued' });
  const { workflow_runs: runs } = await (await github(`/repos/${env.GITHUB_REPO}/actions/runs?head_sha=${commit}`, token)).json();
  if (!runs.length) return json({ state: 'queued' });
  if (runs.some((r) => r.conclusion && r.conclusion !== 'success')) return json({ state: 'failed' });
  if (runs.some((r) => r.status !== 'completed')) return json({ state: 'building' });
  return json({ state: 'deployed' });
}

async function media(token, env, name) {
  if (!MEDIA_NAME.test(name)) return new Response(null, { status: 404 });
  const response = await github(`/repos/${env.GITHUB_REPO}/contents/content/media/${name}?ref=${BRANCH}`, token, { headers: { Accept: 'application/vnd.github.raw' } });
  return new Response(response.body, { headers: { 'Content-Type': MEDIA_TYPES[name.split('.').pop()], 'Cache-Control': 'private, max-age=300', 'Content-Security-Policy': "default-src 'none'" } });
}

export async function onRequest({ request, env, params }) {
  const email = await accessIdentity(request, env).catch(() => null);
  if (!email) return fail(401, 'not signed in');
  const route = [].concat(params.path || []).join('/');
  try {
    const token = await installationToken(env);
    if (route === '' && request.method === 'GET') return await load(token, env);
    if (route === '' && request.method === 'POST') return await save(request, token, env, email);
    if (route === 'status') return await status(token, env, new URL(request.url).searchParams.get('commit'));
    if (route.startsWith('media/')) return await media(token, env, route.slice('media/'.length));
    return fail(404, 'unknown route');
  } catch (error) {
    return fail(502, error.message);
  }
}
