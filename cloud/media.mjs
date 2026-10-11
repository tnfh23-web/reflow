import {readCloudConfig} from './config.mjs';

const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ownerPattern = new RegExp(`^${uuid}$`, 'i');
const privatePath = new RegExp(`^/api/media/private/(${uuid})/(${uuid}\\.webp)$`, 'i');
const samplePath = new RegExp(`^/api/media/sample/(${uuid}\\.webp)$`, 'i');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), {status}); };
const string = (bytes, offset, count) => String.fromCharCode(...bytes.subarray(offset, offset + count));
const word24 = (bytes, offset) => bytes[offset] | bytes[offset + 1] << 8 | bytes[offset + 2] << 16;

// The server checks actual WebP frame headers rather than trusting MIME or client dimensions.
export function webpDimensions(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 20 || bytes.length > 12 * 1024 * 1024 ||
      string(bytes, 0, 4) !== 'RIFF' || string(bytes, 8, 4) !== 'WEBP') fail('12MB 이하의 WebP 이미지를 사용해 주세요.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) + 8 !== bytes.length) fail('이미지 파일이 손상됐어요.');
  let frame, declared, offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = string(bytes, offset, 4), size = view.getUint32(offset + 4, true), start = offset + 8;
    if (start + size > bytes.length) fail('이미지 파일이 손상됐어요.');
    if (type === 'ANIM' || type === 'ANMF') fail('정적 이미지를 사용해 주세요.');
    if (type === 'VP8X') {
      if (size < 10 || bytes[start] & 2) fail('정적 이미지를 사용해 주세요.');
      declared = {width: word24(bytes, start + 4) + 1, height: word24(bytes, start + 7) + 1};
    }
    if (type === 'VP8 ') {
      if (frame || size < 10 || (bytes[start] & 1) || string(bytes, start + 3, 3) !== '\x9d\x01\x2a') fail('이미지 내용을 확인하지 못했어요.');
      frame = {width: view.getUint16(start + 6, true) & 0x3fff, height: view.getUint16(start + 8, true) & 0x3fff};
    }
    if (type === 'VP8L') {
      if (frame || size < 5 || bytes[start] !== 0x2f) fail('이미지 내용을 확인하지 못했어요.');
      const packed = view.getUint32(start + 1, true); if (packed >>> 29) fail('지원하지 않는 이미지입니다.');
      frame = {width: (packed & 0x3fff) + 1, height: (packed >>> 14 & 0x3fff) + 1};
    }
    offset = start + size + (size & 1);
  }
  if (offset !== bytes.length || !frame || (declared && (declared.width !== frame.width || declared.height !== frame.height)) ||
      frame.width < 1 || frame.height < 1 || frame.width > 1440 || frame.height > 16000 || frame.width * frame.height > 24e6) {
    fail('이미지 크기는 최대 1440×16000이어야 합니다.');
  }
  return frame;
}

export function createCloudMedia(env, fetcher = fetch, dependencies = {}) {
  const config = readCloudConfig(env);
  const headers = token => ({apikey: config.key, Authorization: `Bearer ${token}`});
  function identity(session) {
    if (!session?.accessToken || !ownerPattern.test(session.user?.id || '')) fail('로그인 후 사용할 수 있어요.', 401);
    return session.user.id;
  }
  async function persist(bytes, session) {
    const owner = identity(session), dimensions = webpDimensions(bytes), name = `${crypto.randomUUID()}.webp`;
    if (dependencies.reserve) {
      const quota = await dependencies.reserve(owner, bytes.length);
      if (!quota.ok) fail(quota.error, 429);
    }
    const response = await fetcher(`${config.url}/storage/v1/object/reflow-private/${owner}/${name}`, {
      method: 'POST', headers: {...headers(session.accessToken), 'Content-Type': 'image/webp', 'x-upsert': 'false'},
      body: bytes, signal: AbortSignal.timeout(15000)});
    if (!response.ok) fail(response.status === 413 ? '이미지 저장 한도에 도달했어요.' : '이미지를 저장하지 못했어요. 다시 시도해 주세요.', response.status === 413 ? 413 : 502);
    return {image: `/api/media/private/${owner}/${name}`, ...dimensions};
  }
  return {
    persist,
    async read(request, session) {
      const path = new URL(request.url).pathname, privateMatch = path.match(privatePath), sampleMatch = path.match(samplePath);
      let target, token;
      if (privateMatch) {
        // Return the same response for nonexistent and another owner's media.
        if (!session?.user || privateMatch[1] !== session.user.id || !session.accessToken) return new Response(null, {status: 404, headers: {'Cache-Control': 'no-store'}});
        target = `${config.url}/storage/v1/object/authenticated/reflow-private/${privateMatch[1]}/${privateMatch[2]}`; token = session.accessToken;
      } else if (sampleMatch) target = `${config.url}/storage/v1/object/public/reflow-samples/${sampleMatch[1]}`;
      else return new Response(null, {status: 404, headers: {'Cache-Control': 'no-store'}});
      const response = await fetcher(target, {headers: token ? headers(token) : {apikey: config.key}, signal: AbortSignal.timeout(15000)});
      if (!response.ok) return new Response(null, {status: response.status >= 500 ? 502 : 404, headers: {'Cache-Control': 'no-store'}});
      // API media is never a public/CDN cache of personal images, including after logout.
      return new Response(response.body, {headers: {'Content-Type': 'image/webp', 'Cache-Control': token ? 'no-store' : 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin'}});
    }
  };
}
