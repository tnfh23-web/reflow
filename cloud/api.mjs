import {createCloudAuth} from './auth.mjs';
import {createCloudStore} from './store.mjs';
import {readCloudConfig} from './config.mjs';

const text = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const fail = (message, status = 400, extra = {}) => { throw Object.assign(new Error(message), {status, ...extra}); };
const json = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}});

// URL normalization is not a substitute for the capture service's DNS/network checks.
export function referenceUrl(value) {
  if (typeof value !== 'string' || value.length > 2000) fail('웹사이트 주소를 확인해 주세요.');
  let url; try { url = new URL(value.trim()); } catch { fail('올바른 HTTPS 주소를 입력해 주세요.'); }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !host.includes('.') ||
      /^[\d.]+$/.test(host) || host.includes(':') || /(^|\.)(localhost|local|internal|lan|test|invalid|onion)$/.test(host)) {
    fail('공개 HTTPS 웹사이트 주소를 입력해 주세요.');
  }
  url.hash = ''; url.hostname = host; return url.href;
}

async function bodyOf(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) fail('JSON 요청이 필요합니다.', 415);
  // Read a bounded stream, rather than buffering an arbitrarily large request first.
  const reader = request.body?.getReader(); if (!reader) fail('요청 내용이 필요합니다.');
  const parts = []; let size = 0;
  try {
    while (true) { const {done, value} = await reader.read(); if (done) break; size += value.length;
      if (size > 1024 * 1024) { await reader.cancel(); fail('요청 내용이 너무 큽니다.', 413); } parts.push(value); }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  let body; try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { fail('요청 내용을 읽지 못했어요.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('요청 내용을 확인해 주세요.');
  return body;
}

function snapshot(ref, crop) {
  if (!ref.image || !ref.thumb) fail('이미지가 준비된 뒤 프로젝트에 담아 주세요.');
  return {sourceId: ref.id, version: ref.captureVersion, title: ref.title, url: ref.url,
    image: crop?.image || ref.thumb, width: crop?.width || ref.width,
    height: crop?.height || Math.min(ref.height, 900), cropName: crop?.name || '전체 사이트', cropId: crop?.id || null,
    tags: structuredClone(ref.tags || {}), colors: structuredClone(ref.colors || []),
    typography: structuredClone(ref.typography || []), motions: structuredClone(ref.motions || [])};
}

export function createCloudApi(env, dependencies = {}) {
  const config = readCloudConfig(env);
  if (!config.ready) return async () => json({error: '서비스 연결 설정을 준비 중입니다.'}, 503);
  const auth = dependencies.auth || createCloudAuth(env);
  const storeFor = dependencies.storeFor || (session => createCloudStore(env, session.accessToken));
  const capture = dependencies.capture;
  return async request => {
    const url = new URL(request.url), path = url.pathname, method = request.method;
    if (url.origin !== config.origin || (!['GET', 'HEAD'].includes(method) && request.headers.get('origin') !== config.origin)) {
      return json({error: '이 앱에서 다시 요청해 주세요.'}, 403);
    }
    if (path.startsWith('/api/auth/')) return auth.handle(request);
    let session;
    try {
      session = await auth.authenticate(request);
      const store = storeFor(session);
      const owner = () => session.user?.id || fail('로그인 후 사용할 수 있어요.', 401);
      const ref = async (key, own = false) => {
        if (own) owner(); const value = await store.getRef(key);
        if (!value) fail('레퍼런스를 찾을 수 없어요.', 404);
        if (own && value.sample) fail('예시를 내 라이브러리로 복사한 뒤 수정해 주세요.', 403);
        return value;
      };
      const project = async key => { owner(); const value = await store.getProject(key); if (!value) fail('프로젝트를 찾을 수 없어요.', 404); return value; };
      const checkRevision = (body, current) => { if (body._revision !== undefined && body._revision !== current._revision) fail('다른 창에서 변경된 자료예요. 최신 내용을 확인해 주세요.', 409); };
      const respond = (value, status = 200) => { const response = json(value, status); for (const cookie of session.cookies || []) response.headers.append('Set-Cookie', cookie); return response; };
      if (path === '/api/bootstrap' && method === 'GET') {
        const [references, samples, projects] = await Promise.all([session.user ? store.references() : [], store.samples(), session.user ? store.projects() : []]);
        return respond({user: session.user, references, samples, projects, capabilities: {
          cloud: true, google: config.google, emailSignup: config.emailSignup, capture: Boolean(capture), media: Boolean(dependencies.media), ai: false,
          storage: 'Supabase 비공개 저장소'}});
      }
      if (path === '/api/jobs' && method === 'GET') { owner(); return respond(capture?.jobs ? await capture.jobs(session) : await store.jobs()); }
      if (path === '/api/search' && method === 'POST') {
        const body = await bodyOf(request), query = text(body.query, 300).toLowerCase().trim();
        const source = body.samples || !session.user ? await store.samples() : await store.references();
        const words = query.split(/\s+/).filter(Boolean);
        const results = source.map(r => { const content = [r.title, r.description, r.note, ...Object.values(r.tags || {}).flat(), ...(r.sections || []).map(s => s.name), ...(r.colors || []).map(c => c.hex)].join(' ').toLowerCase();
          const matches = words.filter(word => content.includes(word)); return {id: r.id, score: matches.length,
            reason: words.some(word => r.note?.toLowerCase().includes(word)) ? '내 메모에서 찾았어요' : matches.length ? `저장된 내용과 일치: ${matches.slice(0, 3).join(', ')}` : ''};
        }).filter(r => !query || r.score).sort((a, b) => b.score - a.score);
        return respond({results, mode: 'keyword'});
      }
      const parts = path.split('/').filter(Boolean), key = parts[2], action = parts[3];
      if (parts[1] === 'references') {
        if (parts.length === 2 && method === 'POST') {
          owner(); const body = await bodyOf(request), target = referenceUrl(body.url), all = await store.references();
          const existing = all.find(r => r.url === target); if (existing) fail('이미 저장한 웹사이트예요.', 409, {existingId: existing.id});
          if (all.length >= 150) fail('저장 한도 150개에 도달했어요.', 429);
          let value = await store.saveRef({id: id(), title: new URL(target).hostname, url: target, date: now(), views: 0, note: '',
            tags: {style: [], layout: [], interaction: []}, sections: [], colors: [], typography: [], motions: [],
            status: capture ? 'queued' : 'failed', error: capture ? null : '캡처 연결을 준비 중입니다. URL은 저장됐어요.', sample: false}, owner());
          if (capture) value = await capture.enqueue(value, session, store);
          return respond(value, 201);
        }
        if (parts.length === 3 && method === 'GET') return respond(await ref(key));
        if (parts.length === 3 && method === 'PATCH') {
          const r = await ref(key, true), body = await bodyOf(request); checkRevision(body, r);
          if (body.note !== undefined) r.note = text(body.note, 12000);
          if (body.title !== undefined) r.title = text(body.title, 150).trim() || r.title;
          if (body.description !== undefined) { r.description = text(body.description, 2000); r.userEdited = true; }
          if (body.tags && typeof body.tags === 'object') r.tags = Object.fromEntries(['style', 'layout', 'interaction'].map(k => [k, Array.isArray(body.tags[k]) ? body.tags[k].filter(s => typeof s === 'string').map(s => s.slice(0, 50)).slice(0, 12) : r.tags[k] || []]));
          if (Array.isArray(body.sections)) r.sections = r.sections.map(s => { const update = body.sections.find(v => v.id === s.id); return update ? {...s, name: text(update.name, 80) || s.name} : s; });
          if (Array.isArray(body.motions)) r.motions = r.motions.map(m => { const update = body.motions.find(v => v.id === m.id); return update ? {...m, behavior: text(update.behavior, 1200), userEdited: true} : m; });
          return respond(await store.saveRef(r, owner()));
        }
        if (parts.length === 3 && method === 'DELETE') { await ref(key, true); await store.removeRef(key); return respond({ok: true}); }
        if (parts.length === 4 && action === 'view' && method === 'POST') { const r = await ref(key); if (!r.sample) { owner(); await store.saveRef({...r, views: (r.views || 0) + 1}, owner()); } return respond({ok: true}); }
        if (parts.length === 4 && action === 'recapture' && method === 'POST') { const r = await ref(key, true); if (!capture) fail('캡처 연결을 준비 중입니다.', 503); return respond(await capture.enqueue(r, session, store)); }
        if (parts.length === 5 && action === 'sections' && method === 'DELETE') { const r = await ref(key, true); r.sections = r.sections.filter(s => s.id !== parts[4]); return respond(await store.saveRef(r, owner())); }
        if (['upload', 'sections'].includes(action) && method === 'POST' && parts.length === 4) {
          const r = await ref(key, true); if (!dependencies.media) fail('이미지 저장 연결을 준비 중입니다.', 503);
          return respond(await dependencies.media[action](request, r, session, store));
        }
      }
      if (parts[1] === 'samples' && action === 'copy' && method === 'POST' && parts.length === 4) {
        owner(); const sample = await ref(key); if (!sample.sample) fail('예시를 찾을 수 없어요.', 404);
        const all = await store.references(), existing = all.find(r => r.sampleSource === sample.id || r.url === sample.url);
        if (existing) return respond(existing); if (all.length >= 150) fail('저장 한도 150개에 도달했어요.', 429);
        const {_revision, ...copy} = structuredClone(sample);
        return respond(await store.saveRef({...copy, id: id(), sample: false, sampleSource: sample.id, date: now(), views: 0, note: ''}, owner()));
      }
      if (parts[1] === 'projects') {
        if (parts.length === 2 && method === 'POST') {
          owner(); const body = await bodyOf(request), title = text(body.title, 100).trim(); if (!title) fail('프로젝트 이름을 입력해 주세요.');
          if ((await store.projects()).length >= 40) fail('프로젝트 한도 40개에 도달했어요.', 429);
          return respond(await store.saveProject({id: id(), title, description: text(body.description, 300), updated: now(),
            sections: ['Hero', '콘텐츠', '인터랙션', 'Footer'].map(name => ({id: id(), name, items: []})), direction: null}, owner()), 201);
        }
        if (parts.length === 3 && method === 'GET') return respond(await project(key));
        if (parts.length === 3 && method === 'DELETE') { await project(key); await store.removeProject(key); return respond({ok: true}); }
        if (parts.length === 3 && method === 'PATCH') {
          const p = await project(key), body = await bodyOf(request); checkRevision(body, p);
          if (body.title !== undefined) p.title = text(body.title, 100).trim() || p.title;
          if (body.description !== undefined) p.description = text(body.description, 300);
          if (Array.isArray(body.sections)) {
            if (body.sections.length > 30) fail('프로젝트는 최대 30개 섹션으로 구성할 수 있어요.');
            const items = new Map(p.sections.flatMap(s => s.items).map(item => [item.id, item])), used = new Set();
            p.sections = body.sections.map(s => { if (!s || typeof s !== 'object') fail('섹션 내용을 확인해 주세요.');
              const sectionId = p.sections.some(v => v.id === s.id) ? s.id : id(); if (used.has(sectionId)) fail('같은 섹션을 중복할 수 없어요.'); used.add(sectionId);
              const picked = new Set(); return {id: sectionId, name: text(s.name, 80) || '섹션', items: (Array.isArray(s.items) ? s.items : []).filter(i => i && items.has(i.id) && !picked.has(i.id) && picked.add(i.id)).map(i => structuredClone(items.get(i.id)))};
            });
          }
          return respond(await store.saveProject(p, owner()));
        }
        if (action === 'items' && method === 'POST' && parts.length === 4) {
          const p = await project(key), body = await bodyOf(request); checkRevision(body, p); const r = await ref(body.refId, true);
          const s = p.sections.find(s => s.id === body.sectionId); if (!s) fail('담을 섹션을 선택해 주세요.');
          if (p.sections.flatMap(s => s.items).length >= 300) fail('프로젝트 자료 한도 300개에 도달했어요.', 429);
          const crop = body.cropId ? r.sections.find(s => s.id === body.cropId) : null; if (body.cropId && !crop) fail('선택한 구간을 찾을 수 없어요.');
          s.items.push({id: id(), ...snapshot(r, crop)}); return respond(await store.saveProject(p, owner()));
        }
        if (action === 'items' && parts.length === 6 && parts[5] === 'update' && method === 'POST') {
          const p = await project(key), item = p.sections.flatMap(s => s.items).find(i => i.id === parts[4]); if (!item) fail('자료를 찾을 수 없어요.', 404);
          const r = await ref(item.sourceId, true), crop = r.sections.find(s => s.id === item.cropId) || r.sections.find(s => s.name === item.cropName);
          Object.assign(item, snapshot(r, crop)); return respond(await store.saveProject(p, owner()));
        }
      }
      if (path.startsWith('/api/media/') && method === 'GET' && dependencies.media) {
        const response = await dependencies.media.read(request, session);
        for (const cookie of session.cookies || []) response.headers.append('Set-Cookie', cookie);
        return response;
      }
      if (['analyze', 'direction', 'draft'].includes(action)) fail('AI 연결 후 사용할 수 있어요.', 503);
      return respond({error: '지원하지 않는 요청입니다.'}, 404);
    } catch (error) {
      const response = json({error: error.status ? error.message : '요청을 처리하지 못했어요. 다시 시도해 주세요.', ...(error.existingId ? {existingId: error.existingId} : {})}, error.status || 502);
      for (const cookie of session?.cookies || []) response.headers.append('Set-Cookie', cookie);
      return response;
    }
  };
}
