export function readCloudConfig(env) {
  const required = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SESSION_SECRET', 'APP_ORIGIN'];
  const missing = required.filter(name => !env[name]?.trim());
  if (missing.length) return {ready: false, missing};
  const url = new URL(env.SUPABASE_URL);
  const origin = new URL(env.APP_ORIGIN);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new Error('Supabase URL은 HTTPS 프로젝트 주소여야 합니다.');
  }
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') {
    throw new Error('공개 앱 주소는 경로 없는 HTTPS 주소여야 합니다.');
  }
  const secret = env.SESSION_SECRET.trim();
  if (!/^[A-Za-z0-9_-]{43}$/.test(secret) || atob(secret.replace(/-/g, '+').replace(/_/g, '/') + '=').length !== 32) {
    throw new Error('SESSION_SECRET은 32바이트 난수를 base64url로 인코딩한 값이어야 합니다.');
  }
  const publicKey = env.SUPABASE_PUBLISHABLE_KEY.trim();
  if (publicKey.startsWith('sb_secret_')) throw new Error('로그인에는 publishable 키를 사용하세요.');
  if (!publicKey.startsWith('sb_publishable_')) {
    try {
      const part = publicKey.split('.')[1];
      const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - part.length % 4) % 4)));
      if (payload.role !== 'anon') throw new Error('invalid key role');
    } catch { throw new Error('publishable 키 또는 기존 anon 키를 사용하세요. service_role 키는 사용할 수 없습니다.'); }
  }
  return {ready: true, url: url.origin, origin: origin.origin,
    key: publicKey, secret,
    google: env.GOOGLE_AUTH_ENABLED === 'true', emailSignup: env.EMAIL_SIGNUP_ENABLED === 'true'};
}
