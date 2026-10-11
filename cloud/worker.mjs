import {createCloudApi} from './api.mjs';
import {createCloudStore} from './store.mjs';
import {cloudCapture} from './jobs.mjs';
import {cloudUploads} from './uploads.mjs';
export {ReflowCoordinator} from './jobs.mjs';

let samplesPromise;
function publishedStore(env, session) {
  const store = createCloudStore(env, session.accessToken);
  samplesPromise ||= env.ASSETS.fetch(new Request('https://assets.local/cloud-samples.json')).then(r => {
    if (!r.ok) throw new Error('Samples unavailable'); return r.json();
  }).catch(error => {samplesPromise=null;throw error;});
  return {...store, samples: () => samplesPromise,
    async getRef(id) {
      const sample = (await samplesPromise).find(s => s.id === id);
      return sample || store.getRef(id);
    }};
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try { return await createCloudApi(env, {storeFor: session => publishedStore(env, session),
        capture: cloudCapture(env), media: env.COORDINATOR ? cloudUploads(env) : null})(request); }
      catch { return Response.json({error:'서비스 연결을 확인하고 있어요. 잠시 뒤 다시 시도해 주세요.'},{status:503,headers:{'Cache-Control':'no-store'}}); }
    }
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'same-origin');
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    return new Response(response.body, {status: response.status, statusText: response.statusText, headers});
  }
};
