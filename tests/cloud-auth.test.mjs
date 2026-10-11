import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudAuth} from '../cloud/auth.mjs';
import {readCloudConfig} from '../cloud/config.mjs';
import {createCloudStore} from '../cloud/store.mjs';

const env = {SUPABASE_URL: 'https://test-project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SESSION_SECRET: 'a'.repeat(43), APP_ORIGIN: 'https://reflow.example', GOOGLE_AUTH_ENABLED: 'true', EMAIL_SIGNUP_ENABLED: 'true'};
const user = {id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'person@example.com'};
const tokens = {access_token: 'test-access-token', refresh_token: 'test-refresh-token', expires_in: 3600, user};
const request = (action, body, cookie, origin = env.APP_ORIGIN) => new Request(`${env.APP_ORIGIN}/api/auth/${action}`, {
  method: 'POST', headers: {origin, 'Content-Type': 'application/json', ...(cookie ? {cookie} : {})}, body: JSON.stringify(body || {})});
const cookieValue = response => response.headers.getSetCookie().find(s => s.startsWith('__Host-reflow-session='))?.split(';')[0];

test('config does not treat missing credentials or a secret key as ready', () => {
  assert.equal(readCloudConfig({}).ready, false);
  assert.throws(() => readCloudConfig({...env, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_forbidden'}));
  assert.throws(() => readCloudConfig({...env, APP_ORIGIN: 'http://reflow.example'}));
  assert.throws(() => readCloudConfig({...env, SESSION_SECRET: 'short'}));
  const legacyService = `header.${Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')}.signature`;
  assert.throws(() => readCloudConfig({...env, SUPABASE_PUBLISHABLE_KEY: legacyService}));
});
test('email login verifies identity on the provider; no token is exposed in JSON', async () => {
  const calls = [];
  const auth = createCloudAuth(env, async (url, options) => {
    calls.push({url, options}); return Response.json(url.endsWith('/user') ? user : tokens);
  });
  const response = await auth.handle(request('login', {email: user.email, password: 'test-password'}));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {ok: true});
  const header = response.headers.getSetCookie()[0];
  assert.match(header, /HttpOnly; Secure; SameSite=Lax/);
  assert.ok(!header.includes(tokens.access_token) && !header.includes(tokens.refresh_token));
  const session = await auth.authenticate(new Request(env.APP_ORIGIN, {headers: {cookie: cookieValue(response)}}));
  assert.deepEqual(session.user, user);
  assert.equal(session.accessToken, tokens.access_token);
  assert.equal(calls[1].options.headers.Authorization, `Bearer ${tokens.access_token}`);
});
test('foreign-origin writes never call the provider', async () => {
  let count = 0; const auth = createCloudAuth(env, async () => {count++; return Response.json(tokens);});
  assert.equal((await auth.handle(request('login', {}, undefined, 'https://other.example'))).status, 403);
  assert.equal(count, 0);
});
test('tampered cookies cannot impersonate an account', async () => {
  let count = 0; const auth = createCloudAuth(env, async () => {count++; return Response.json(tokens);});
  const response = await auth.handle(request('login', {email: user.email, password: 'test-password'}));
  const valid = cookieValue(response), value = valid.split('=')[1];
  const [iv, data] = value.split('.');
  const forged = `__Host-reflow-session=${iv}.${data[0] === 'A' ? 'B' : 'A'}${data.slice(1)}`;
  assert.equal((await auth.authenticate(new Request(env.APP_ORIGIN, {headers: {cookie: forged}}))).user, null);
  assert.equal(count, 1);
});
test('provider outages preserve the distinction from a logged-out account', async () => {
  let down = false;
  const auth = createCloudAuth(env, async () => down ? new Response('', {status: 503}) : Response.json(tokens));
  const response = await auth.handle(request('login', {email: user.email, password: 'test-password'})); down = true;
  await assert.rejects(auth.authenticate(new Request(env.APP_ORIGIN, {headers: {cookie: cookieValue(response)}})), error => error.status === 502);
});
test('Google uses PKCE and rejects a callback without the initiating browser cookie', async () => {
  let count = 0; const auth = createCloudAuth(env, async () => {count++; return Response.json(tokens);});
  const started = await auth.handle(new Request(`${env.APP_ORIGIN}/api/auth/google`));
  const target = new URL(started.headers.get('location'));
  assert.equal(target.searchParams.get('provider'), 'google');
  assert.equal(target.searchParams.get('redirect_to'), `${env.APP_ORIGIN}/api/auth/callback`);
  assert.equal(target.searchParams.get('code_challenge_method'), 's256');
  assert.equal(target.searchParams.get('code_challenge').length, 43);
  const failed = await auth.handle(new Request(`${env.APP_ORIGIN}/api/auth/callback?code=untrusted`));
  assert.match(failed.headers.get('location'), /auth_error=google/); assert.equal(count, 0);
  const verifierCookie = started.headers.getSetCookie()[0].split(';')[0];
  const completed = await auth.handle(new Request(`${env.APP_ORIGIN}/api/auth/callback?code=valid`, {headers: {cookie: verifierCookie}}));
  assert.equal(completed.status, 303); assert.ok(cookieValue(completed)); assert.equal(count, 1);
});
test('email confirmation is a separate state and disabled public email signup makes no call', async () => {
  const auth = createCloudAuth(env, async () => Response.json({user}));
  const response = await auth.handle(request('register', {email: user.email, password: 'test-password'}));
  assert.equal((await response.json()).confirmationRequired, true); assert.equal(response.headers.getSetCookie().length, 0);
  const disabled = createCloudAuth({...env, EMAIL_SIGNUP_ENABLED: 'false'}, () => {throw new Error('must not send mail');});
  assert.equal((await disabled.handle(request('register', {email: user.email, password: 'test-password'}))).status, 503);
});
test('an expired access token refreshes before identity verification', async () => {
  const calls = [];
  const auth = createCloudAuth(env, async url => {
    calls.push(url);
    return Response.json(url.endsWith('/user') ? user : url.includes('grant_type=password') ? {...tokens, expires_in: 1} : tokens);
  });
  const response = await auth.handle(request('login', {email: user.email, password: 'test-password'}));
  const session = await auth.authenticate(new Request(env.APP_ORIGIN, {headers: {cookie: cookieValue(response)}}));
  assert.equal(session.user.id, user.id); assert.equal(session.cookies.length, 1);
  assert.ok(calls[1].includes('grant_type=refresh_token')); assert.ok(calls[2].endsWith('/user'));
});
test('stale cloud edits return a conflict instead of overwriting a newer revision', async () => {
  const calls = [];
  const store = createCloudStore(env, 'verified-user-token', async (url, options) => {calls.push({url, options}); return Response.json([]);});
  const document = {id: user.id, url: 'https://example.com', sample: false, _revision: 3};
  await assert.rejects(store.saveRef(document, user.id), error => error.status === 409);
  assert.equal(new URL(calls[0].url).searchParams.get('revision'), 'eq.3');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer verified-user-token');
  assert.equal(JSON.parse(calls[0].options.body).document._revision, undefined);
});
test('anonymous cloud sessions can read published samples but cannot write personal records', async () => {
  const calls = [];
  const store = createCloudStore(env, null, async (url, options) => {calls.push({url, options}); return Response.json([]);});
  assert.deepEqual(await store.references(), []);
  await store.samples();
  assert.equal(new URL(calls[0].url).searchParams.get('published'), 'eq.true');
  assert.equal(calls[0].options.headers.Authorization, undefined);
  await assert.rejects(store.saveRef({id: user.id}, user.id), error => error.status === 401);
});
