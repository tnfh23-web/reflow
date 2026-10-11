import test from 'node:test';
import assert from 'node:assert/strict';
import {webpDimensions, createCloudMedia} from '../cloud/media.mjs';

const env = {SUPABASE_URL: 'https://test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SESSION_SECRET: 'a'.repeat(43), APP_ORIGIN: 'https://reflow.example'};
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const name = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc.webp';
const session = {user: {id: owner}, accessToken: 'verified-user-token'};
function frame(width, height) {
  const bytes = new Uint8Array(30), view = new DataView(bytes.buffer);
  bytes.set(Buffer.from('RIFF')); view.setUint32(4, 22, true); bytes.set(Buffer.from('WEBPVP8 '), 8);
  view.setUint32(16, 10, true); bytes.set([0x9d, 0x01, 0x2a], 23); view.setUint16(26, width, true); view.setUint16(28, height, true);
  return bytes;
}
test('frame validation rejects arbitrary MIME payloads, huge dimensions and inconsistent extended headers', () => {
  assert.deepEqual(webpDimensions(frame(960, 600)), {width: 960, height: 600});
  assert.throws(() => webpDimensions(new Uint8Array(Buffer.from('<svg onload="alert(1)"/>'))));
  assert.throws(() => webpDimensions(frame(2000, 600)));
  const forged = new Uint8Array(48), view = new DataView(forged.buffer);
  forged.set(frame(960, 600).subarray(0, 12)); view.setUint32(4, 40, true); forged.set(Buffer.from('VP8X'), 12); view.setUint32(16, 10, true);
  forged[24] = 1; forged[27] = 1; forged.set(frame(960, 600).subarray(12), 30);
  assert.throws(() => webpDimensions(forged));
});
test('media read rejects another owner, malformed paths and anonymous personal access without contacting storage', async () => {
  const media = createCloudMedia(env, () => assert.fail('must not contact storage'));
  for (const [path, auth] of [[`/private/${other}/${name}`, session], [`/private/${owner}/${name}`, null], ['/private/../../object', session]]) {
    const response = await media.read(new Request(env.APP_ORIGIN + '/api/media' + path), auth); assert.equal(response.status, 404);
  }
});
test('personal media always uses the user token and disables shared and browser caches', async () => {
  const calls = [], media = createCloudMedia(env, async (url, options) => {calls.push({url, options}); return new Response(frame(960, 600));});
  const response = await media.read(new Request(`${env.APP_ORIGIN}/api/media/private/${owner}/${name}`), session);
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer verified-user-token');
});
test('uploads get fresh immutable file names under the authenticated owner folder', async () => {
  const calls = [], media = createCloudMedia(env, async (url, options) => {calls.push({url, options}); return Response.json({ok: true});});
  const first = await media.persist(frame(960, 600), session), second = await media.persist(frame(960, 600), session);
  assert.notEqual(first.image, second.image); assert.ok(first.image.startsWith(`/api/media/private/${owner}/`));
  for (const call of calls) { assert.match(call.url, new RegExp(`/reflow-private/${owner}/`)); assert.equal(call.options.headers['x-upsert'], 'false'); assert.equal(call.options.headers.Authorization, 'Bearer verified-user-token'); }
});
