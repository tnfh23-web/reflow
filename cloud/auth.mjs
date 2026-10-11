import {readCloudConfig} from './config.mjs';

const SESSION = '__Host-reflow-session', VERIFIER = '__Host-reflow-pkce';
const encoder = new TextEncoder(), decoder = new TextDecoder();
const to64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const from64 = text => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - text.length % 4) % 4)), c => c.charCodeAt(0));
const cookie = (name, value, seconds) => `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
const clear = name => cookie(name, '', 0);
function cookies(request) {
  return Object.fromEntries((request.headers.get('cookie') || '').split(';').map(s => s.trim().split(/=(.*)/s)).filter(p => p.length >= 2));
}
const json = (value, status = 200) => Response.json(value, {status, headers: {'Cache-Control': 'no-store'}});
function failure(message, status) { return Object.assign(new Error(message), {status}); }

export function createCloudAuth(env, fetcher = fetch) {
  const config = readCloudConfig(env);
  if (!config.ready) throw failure('클라우드 계정 연결이 필요합니다.', 503);
  const keyPromise = crypto.subtle.importKey('raw', from64(config.secret), 'AES-GCM', false, ['encrypt', 'decrypt']);
  async function seal(value) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const body = await crypto.subtle.encrypt({name: 'AES-GCM', iv, additionalData: encoder.encode(config.origin)}, await keyPromise, encoder.encode(JSON.stringify(value)));
    const token = `${to64(iv)}.${to64(new Uint8Array(body))}`;
    if (token.length > 3800) throw failure('로그인 정보를 저장하지 못했어요.', 502);
    return token;
  }
  async function unseal(token) {
    try {
      if (!token || token.length > 3800) return null;
      const [iv, data, extra] = token.split('.');
      if (!iv || !data || extra) return null;
      const plain = await crypto.subtle.decrypt({name: 'AES-GCM', iv: from64(iv), additionalData: encoder.encode(config.origin)}, await keyPromise, from64(data));
      const result = JSON.parse(decoder.decode(plain));
      return typeof result.access === 'string' && typeof result.refresh === 'string' && Number.isFinite(result.expires) ? result : null;
    } catch { return null; }
  }
  async function provider(path, body, bearer) {
    let response;
    try {
      response = await fetcher(`${config.url}/auth/v1/${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {apikey: config.key, ...(body !== undefined ? {'Content-Type': 'application/json'} : {}), ...(bearer ? {Authorization: `Bearer ${bearer}`} : {})},
        ...(body !== undefined ? {body: JSON.stringify(body)} : {}), signal: AbortSignal.timeout(12000)
      });
    } catch { throw failure('로그인 서버에 연결하지 못했어요. 다시 시도해 주세요.', 502); }
    if (!response.ok) {
      if (response.status === 429) throw failure('로그인 요청 한도에 도달했어요. 잠시 뒤 다시 시도하세요.', 429);
      if (response.status >= 500) throw failure('로그인 서버가 응답하지 않아요. 다시 시도해 주세요.', 502);
      throw failure('로그인 정보를 확인해 주세요. 이메일 확인이 필요할 수도 있어요.', 401);
    }
    if (response.status === 204) return {};
    return response.json();
  }
  async function sessionCookie(result) {
    if (!result.access_token || !result.refresh_token || !Number.isFinite(result.expires_in) || result.expires_in <= 0) throw failure('로그인 응답을 확인하지 못했어요.', 502);
    return cookie(SESSION, await seal({access: result.access_token, refresh: result.refresh_token, expires: Date.now() + result.expires_in * 1000}), 14 * 86400);
  }
  async function authenticate(request) {
    let session = await unseal(cookies(request)[SESSION]);
    const updates = [];
    if (!session) return {user: null, accessToken: null, cookies: updates};
    if (session.expires < Date.now() + 30000) {
      try {
        const result = await provider('token?grant_type=refresh_token', {refresh_token: session.refresh});
        updates.push(await sessionCookie(result));
        session = {access: result.access_token, refresh: result.refresh_token, expires: Date.now() + result.expires_in * 1000};
      } catch (error) {
        if (error.status !== 401) throw error;
        return {user: null, accessToken: null, cookies: [clear(SESSION)]};
      }
    }
    try {
      // Identity comes from Supabase, never a browser-submitted user ID or JWT payload.
      const user = await provider('user', undefined, session.access);
      if (!user.id || !user.email) throw failure('계정 정보를 확인하지 못했어요.', 502);
      return {user: {id: user.id, email: user.email}, accessToken: session.access, cookies: updates};
    } catch (error) {
      if (error.status !== 401) throw error;
      return {user: null, accessToken: null, cookies: [clear(SESSION)]};
    }
  }
  async function handle(request) {
    const url = new URL(request.url), action = url.pathname.replace('/api/auth/', '');
    if (url.origin !== config.origin) return json({error: '앱 주소 설정을 확인해 주세요.'}, 403);
    if (request.method === 'POST' && request.headers.get('origin') !== config.origin) return json({error: '이 앱에서 다시 요청해 주세요.'}, 403);
    try {
      if (action === 'google' && request.method === 'GET') {
        if (!config.google) return json({error: 'Google 로그인이 아직 연결되지 않았어요.'}, 503);
        const verifier = to64(crypto.getRandomValues(new Uint8Array(32)));
        const challenge = to64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))));
        const target = new URL(`${config.url}/auth/v1/authorize`);
        target.search = new URLSearchParams({provider: 'google', redirect_to: `${config.origin}/api/auth/callback`, code_challenge: challenge, code_challenge_method: 's256'});
        return new Response(null, {status: 302, headers: {Location: target.href, 'Set-Cookie': cookie(VERIFIER, verifier, 600), 'Cache-Control': 'no-store'}});
      }
      if (action === 'callback' && request.method === 'GET') {
        const verifier = cookies(request)[VERIFIER], code = url.searchParams.get('code');
        if (!verifier || !/^[A-Za-z0-9_-]{43}$/.test(verifier) || !code || code.length > 1000 || url.searchParams.has('error')) throw failure('Google 로그인을 다시 시작해 주세요.', 401);
        const result = await provider('token?grant_type=pkce', {auth_code: code, code_verifier: verifier});
        const headers = new Headers({Location: `${config.origin}/#library`, 'Cache-Control': 'no-store'});
        headers.append('Set-Cookie', await sessionCookie(result)); headers.append('Set-Cookie', clear(VERIFIER));
        return new Response(null, {status: 303, headers});
      }
      if (!['login', 'register', 'logout'].includes(action) || request.method !== 'POST') return json({error: '지원하지 않는 로그인 요청이에요.'}, 404);
      if (action === 'logout') {
        const session = await unseal(cookies(request)[SESSION]);
        if (session) {
          try { await provider('logout?scope=local', {}, session.access); } catch (error) { if (error.status !== 401) throw error; }
        }
        const response = json({ok: true}); response.headers.append('Set-Cookie', clear(SESSION)); return response;
      }
      if (action === 'register' && !config.emailSignup) return json({error: '이메일 가입은 메일 발송 연결 후 사용할 수 있어요. Google 로그인을 이용해 주세요.'}, 503);
      const body = await request.json().catch(() => null);
      const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body?.password === 'string' ? body.password : '';
      if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254 || password.length < 8 || password.length > 128) return json({error: '이메일과 8~128자의 비밀번호를 입력해 주세요.'}, 400);
      const result = await provider(action === 'login' ? 'token?grant_type=password' : `signup?redirect_to=${encodeURIComponent(config.origin)}`, {email, password});
      if (!result.access_token && action === 'register') return json({confirmationRequired: true, message: '이메일의 확인 링크를 누른 뒤 로그인해 주세요.'});
      const response = json({ok: true}); response.headers.append('Set-Cookie', await sessionCookie(result)); return response;
    } catch (error) {
      if (action === 'callback') return new Response(null, {status: 303, headers: {Location: `${config.origin}/?auth_error=google#library`, 'Set-Cookie': clear(VERIFIER), 'Cache-Control': 'no-store'}});
      return json({error: error.status ? error.message : '로그인 요청을 처리하지 못했어요.'}, error.status || 502);
    }
  }
  return {authenticate, handle};
}
