import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudApi, referenceUrl} from '../cloud/api.mjs';

const env = {SUPABASE_URL: 'https://test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SESSION_SECRET: 'a'.repeat(43), APP_ORIGIN: 'https://reflow.example', GOOGLE_AUTH_ENABLED: 'true'};
const user = {id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'test@example.com'};
const referenceId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const reference = {id: referenceId, url: 'https://example.com/', title: 'Reference', note: '', sample: false,
  sections: [], colors: [], tags: {style: [], layout: [], interaction: []}, typography: [], motions: [], image: '/api/media/original.webp',
  thumb: '/api/media/thumb.webp', width: 1440, height: 2000, captureVersion: 'version-one', _revision: 1};
function setup() {
  const refs = new Map([[referenceId, structuredClone(reference)]]), projects = new Map();
  const store = {references: async () => [...refs.values()].map(structuredCloneSafe), samples: async () => [],
    projects: async () => [...projects.values()].map(structuredCloneSafe), jobs: async () => [],
    getRef: async key => structuredCloneSafe(refs.get(key)), getProject: async key => structuredCloneSafe(projects.get(key)),
    saveRef: async doc => save(refs, doc), saveProject: async doc => save(projects, doc),
    removeRef: async key => refs.delete(key), removeProject: async key => projects.delete(key)};
  const auth = {authenticate: async request => ({user: request.headers.has('x-test-anonymous') ? null : user,
    accessToken: 'verified-test-token', cookies: ['refreshed=1; HttpOnly; Secure']}), handle: async () => Response.json({ok: true})};
  const api = createCloudApi(env, {auth, storeFor: () => store});
  const call = (path, method = 'GET', body, extraHeaders = {}) => api(new Request(env.APP_ORIGIN + '/api' + path, {
    method, headers: {origin: env.APP_ORIGIN, 'Content-Type': 'application/json', ...extraHeaders}, ...(body === undefined ? {} : {body: JSON.stringify(body)})}));
  return {call, refs, projects};
}
function structuredCloneSafe(value) { return value === undefined ? null : structuredClone(value); }
function save(map, doc) {
  const current = map.get(doc.id);
  if (current && current._revision !== doc._revision) throw Object.assign(new Error('stale'), {status: 409});
  const next = {...structuredClone(doc), _revision: (current?._revision || 0) + 1}; map.set(doc.id, next); return structuredClone(next);
}

test('HTTPS URL rejects local addresses, credentials, nonstandard ports and normalized numeric IPs', () => {
  assert.equal(referenceUrl('https://EXAMPLE.com/a#section'), 'https://example.com/a');
  for (const value of ['http://example.com', 'https://127.1', 'https://0x7f000001', 'https://[::1]', 'https://user:pass@example.com',
    'https://example.com:8443', 'https://localhost.', 'https://host.internal', 'file:///etc/passwd']) assert.throws(() => referenceUrl(value));
});
test('unauthenticated writes and cross-origin reads/writes are denied before data operations', async () => {
  const {call, refs} = setup();
  assert.equal((await call('/references', 'POST', {url: 'https://new.example.com'}, {'x-test-anonymous': '1'})).status, 401);
  assert.equal((await call('/projects', 'POST', {title: 'Project'}, {origin: 'https://other.example'})).status, 403);
  const api = createCloudApi(env, {auth: {authenticate: () => assert.fail('must not authenticate foreign host')}});
  assert.equal((await api(new Request('https://other.example/api/bootstrap'))).status, 403);
  assert.equal(refs.size, 1);
});
test('reference edits reject stale versions and do not accept image/source changes', async () => {
  const {call, refs} = setup();
  const updated = await call('/references/' + referenceId, 'PATCH', {note: '건축 메모', _revision: 1, image: 'https://untrusted.example/tracker.png', owner: 'other'});
  assert.equal(updated.status, 200); const doc = await updated.json(); assert.equal(doc._revision, 2); assert.equal(doc.image, reference.image);
  assert.match(updated.headers.get('set-cookie'), /refreshed=1/);
  assert.equal((await call('/references/' + referenceId, 'PATCH', {note: 'old edit', _revision: 1})).status, 409);
  assert.equal(refs.get(referenceId).note, '건축 메모');
  const result = await (await call('/search', 'POST', {query: '건축'})).json(); assert.equal(result.results[0].id, referenceId);
});
test('duplicate normalized URL returns the existing item; missing capture never claims a completed capture', async () => {
  const {call} = setup();
  const duplicate = await call('/references', 'POST', {url: 'https://example.com/#different'});
  assert.equal(duplicate.status, 409); assert.equal((await duplicate.json()).existingId, referenceId);
  const created = await (await call('/references', 'POST', {url: 'https://new.example.com/'})).json();
  assert.equal(created.status, 'failed'); assert.ok(created.error); assert.equal(created.image, undefined);
});
test('board uses server snapshots, rejects forged items, and keeps its images after library deletion', async () => {
  const {call, projects} = setup();
  let p = await (await call('/projects', 'POST', {title: 'Board'})).json();
  p = await (await call(`/projects/${p.id}/items`, 'POST', {refId: referenceId, sectionId: p.sections[0].id, image: 'https://evil.example'})).json();
  const item = p.sections[0].items[0]; assert.equal(item.image, reference.thumb);
  const renamed = await call(`/projects/${p.id}`, 'PATCH', {sections: [{id: p.sections[0].id, name: 'Renamed',
    items: [{...item, image: 'https://evil.example'}, {id: 'forged'}]}]});
  assert.equal(renamed.status, 200); p = await renamed.json(); assert.equal(p.sections[0].items.length, 1);
  assert.equal(p.sections[0].items[0].image, reference.thumb);
  assert.equal((await call('/references/' + referenceId, 'DELETE')).status, 200);
  assert.equal(projects.get(p.id).sections[0].items[0].image, reference.thumb);
  assert.equal((await call(`/projects/${p.id}/items/${item.id}/update`, 'POST', {})).status, 404);
});
test('invalid JSON and oversized request streams fail before storage', async () => {
  const {call} = setup();
  assert.equal((await call('/projects', 'POST', Array(2).fill('bad'))).status, 400);
  assert.equal((await call('/projects', 'POST', {title: 'a'.repeat(1024 * 1024)})).status, 413);
});

test('anonymous bootstrap never reads personal stores, and raw media responses keep refreshed sessions', async () => {
  const auth = {authenticate: async () => ({user: null, accessToken: null, cookies: ['new-session=1; HttpOnly; Secure']})};
  const api = createCloudApi(env, {auth, storeFor: () => ({references: () => assert.fail('anonymous personal read'),
    projects: () => assert.fail('anonymous project read'), samples: async () => []}), media: {read: async () => new Response('image', {headers: {'Cache-Control': 'no-store'}})}});
  const bootstrap = await (await api(new Request(env.APP_ORIGIN + '/api/bootstrap'))).json();
  assert.deepEqual(bootstrap.references, []); assert.deepEqual(bootstrap.projects, []);
  const response = await api(new Request(env.APP_ORIGIN + '/api/media/sample/test.webp'));
  assert.match(response.headers.get('set-cookie'), /new-session=1/); assert.equal(response.headers.get('cache-control'), 'no-store');
});
