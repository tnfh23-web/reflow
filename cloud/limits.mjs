export const limits = {captureDaily: 10, ownerDaily: 3, uploadDaily: 30, ownerBytes: 25 * 1024 * 1024, totalBytes: 700 * 1024 * 1024};
const day = () => new Date().toISOString().slice(0, 10);

// Every reservation is atomic and shared by all Worker instances. Failed uploads
// remain reserved: conservative accounting cannot silently exceed the free plan.
export async function reserveMedia(storage, owner, bytes) {
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > 12 * 1024 * 1024) return {ok: false, error: '이미지 크기를 확인해 주세요.'};
  return storage.transaction(async tx => {
    const global = await tx.get('media:total') || 0, used = await tx.get('media:' + owner) || 0;
    const key = `uploads:${day()}:${owner}`, count = await tx.get(key) || 0;
    if (global + bytes > limits.totalBytes || used + bytes > limits.ownerBytes || count >= limits.uploadDaily) {
      return {ok: false, error: '무료 이미지 저장 한도에 도달했어요. URL과 기존 자료는 유지됩니다.'};
    }
    await tx.put({'media:total': global + bytes, ['media:' + owner]: used + bytes, [key]: count + 1});
    return {ok: true};
  });
}

export async function reserveCapture(storage, owner) {
  return storage.transaction(async tx => {
    return captureQuota(tx, owner);
  });
}

async function captureQuota(tx, owner) {
    const key = 'captures:' + day(), counts = await tx.get(key) || {total: 0, owners: {}};
    if (counts.total >= limits.captureDaily || (counts.owners[owner] || 0) >= limits.ownerDaily) return {ok: false,
      error: '오늘의 무료 캡처 한도에 도달했어요. URL을 보관하거나 이미지를 직접 올려 주세요.'};
    counts.total++; counts.owners[owner] = (counts.owners[owner] || 0) + 1;
    await tx.put(key, counts); return {ok: true};
}

export async function enqueueCapture(storage, job) {
  return storage.transaction(async tx => {
    const jobs = [...(await tx.list({prefix: 'job:'})).values()];
    const active = j => ['queued', 'working'].includes(j.state);
    if (jobs.some(j => active(j) && j.owner === job.owner && j.refId === job.refId)) return {ok:true};
    if (jobs.filter(active).length >= 10) return {ok:false,error:'캡처 대기열이 가득 찼어요. 잠시 뒤 재시도해 주세요.'};
    const quota = await captureQuota(tx, job.owner);
    if (quota.ok) await tx.put('job:' + job.id, job);
    return quota;
  });
}
