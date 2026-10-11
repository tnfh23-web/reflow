import {readCloudConfig} from './config.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fault(message, status) { return Object.assign(new Error(message), {status}); }
function identity(value) { if (!uuid.test(value || '')) throw fault('자료 ID가 올바르지 않아요.', 400); return value; }
const unpack = row => row ? {...row.document, _revision: row.revision} : null;

// All personal reads/writes use the verified user's JWT. Do not substitute a service key.
export function createCloudStore(env, accessToken, fetcher = fetch) {
  const config = readCloudConfig(env);
  if (!config.ready) throw fault('클라우드 저장 연결이 필요합니다.', 503);
  async function request(table, query = {}, options = {}) {
    const url = new URL(`${config.url}/rest/v1/${table}`);
    url.search = new URLSearchParams(query);
    let response;
    try {
      response = await fetcher(url.href, {method: options.method || 'GET',
        headers: {apikey: config.key, ...(accessToken ? {Authorization: `Bearer ${accessToken}`} : {}),
          ...(options.body ? {'Content-Type': 'application/json', Prefer: 'return=representation'} : {})},
        ...(options.body ? {body: JSON.stringify(options.body)} : {}), signal: AbortSignal.timeout(15000)});
    } catch { throw fault('저장 서버에 연결하지 못했어요. 다시 시도해 주세요.', 502); }
    if (!response.ok) {
      if (response.status === 409) throw fault('이미 저장한 주소이거나 자료가 변경됐어요. 최신 내용을 확인해 주세요.', 409);
      if ([401, 403].includes(response.status)) throw fault('로그인 상태와 자료 접근 권한을 확인해 주세요.', response.status);
      throw fault('자료를 저장하거나 읽지 못했어요. 다시 시도해 주세요.', 502);
    }
    return response.status === 204 ? [] : response.json();
  }
  const requireToken = () => { if (!accessToken) throw fault('로그인 후 사용할 수 있어요.', 401); };
  async function save(table, document, owner, isReference) {
    requireToken(); identity(document.id); identity(owner);
    const {_revision, ...clean} = document;
    const body = {id: clean.id, owner, document: clean, ...(isReference ? {url: clean.url} : {})};
    if (_revision === undefined) {
      const rows = await request(table, {}, {method: 'POST', body});
      if (!rows[0]) throw fault('자료를 저장하지 못했어요.', 502);
      return unpack(rows[0]);
    }
    if (!Number.isSafeInteger(_revision) || _revision < 1) throw fault('자료 버전을 확인해 주세요.', 400);
    const rows = await request(table, {id: `eq.${clean.id}`, revision: `eq.${_revision}`}, {method: 'PATCH', body});
    if (!rows[0]) throw fault('다른 창이나 기기에서 변경된 자료예요. 최신 내용을 확인한 뒤 다시 저장해 주세요.', 409);
    return unpack(rows[0]);
  }
  return {
    async references() { if (!accessToken) return []; return (await request('reflow_references', {select: 'document,revision', order: 'created_at.desc'})).map(unpack); },
    async samples() { return (await request('reflow_samples', {select: 'document', published: 'eq.true', order: 'id.asc'})).map(row => row.document); },
    async projects() { if (!accessToken) return []; return (await request('reflow_projects', {select: 'document,revision', order: 'updated_at.desc'})).map(unpack); },
    async getRef(id) {
      identity(id);
      if (accessToken) { const rows = await request('reflow_references', {id: `eq.${id}`, select: 'document,revision', limit: '1'}); if (rows[0]) return unpack(rows[0]); }
      const samples = await request('reflow_samples', {id: `eq.${id}`, select: 'document', published: 'eq.true', limit: '1'});
      return samples[0]?.document || null;
    },
    async getProject(id) { requireToken(); identity(id); return unpack((await request('reflow_projects', {id: `eq.${id}`, select: 'document,revision', limit: '1'}))[0]); },
    saveRef(document, owner) { return save('reflow_references', document, owner, true); },
    saveProject(document, owner) { return save('reflow_projects', {...document, updated: new Date().toISOString()}, owner, false); },
    async removeRef(id) { requireToken(); identity(id); await request('reflow_references', {id: `eq.${id}`}, {method: 'DELETE'}); },
    async removeProject(id) { requireToken(); identity(id); await request('reflow_projects', {id: `eq.${id}`}, {method: 'DELETE'}); },
    async jobs() { requireToken(); return request('reflow_capture_jobs', {select: 'id,ref_id,state', order: 'created_at.desc', limit: '100'}); }
  };
}
