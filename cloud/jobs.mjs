import {DurableObject} from 'cloudflare:workers';
import {createCloudStore} from './store.mjs';
import {createCloudMedia} from './media.mjs';
import {enqueueCapture, reserveMedia} from './limits.mjs';
import {captureWebsite} from './capture.mjs';

const active = job => ['queued', 'working'].includes(job.state);
async function crypt(env, value, decrypt = false) {
  const raw = Uint8Array.from(atob(env.SESSION_SECRET.replace(/-/g, '+').replace(/_/g, '/') + '='), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  if (decrypt) {
    const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
    return new TextDecoder().decode(await crypto.subtle.decrypt({name: 'AES-GCM', iv: bytes.slice(0, 12)}, key, bytes.slice(12)));
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, new TextEncoder().encode(value)));
  return btoa(String.fromCharCode(...iv, ...encrypted));
}

// This object has no public HTTP endpoint. Only the authenticated Worker may
// call its binding. One global queue enforces free browser time/concurrency.
export class ReflowCoordinator extends DurableObject {
  async reserveMedia(owner, bytes) { return reserveMedia(this.ctx.storage, owner, bytes); }
  async jobs(owner) {
    const values = await this.ctx.storage.list({prefix: 'job:'});
    return [...values.values()].filter(j => j.owner === owner).map(j => ({id: j.id, ref_id: j.refId, state: j.state}));
  }
  async enqueue(ref, owner, token) {
    const job = {id: crypto.randomUUID(), refId: ref.id, owner, url: ref.url, state: 'queued', created: Date.now(),
      credential: await crypt(this.env, token)};
    const quota = await enqueueCapture(this.ctx.storage, job); if (!quota.ok) return quota;
    if (!await this.ctx.storage.getAlarm()) await this.ctx.storage.setAlarm(Date.now() + 1000);
    return {ok: true};
  }
  async alarm() {
    const values = await this.ctx.storage.list({prefix: 'job:'}), jobs = [...values.values()];
    // Never blindly retry a browser after eviction: its reserved time counts.
    for (const j of jobs.filter(j => j.state === 'working')) {
      await this.finish(j, 'failed', '캡처 작업이 중단됐어요. 다시 로그인한 뒤 재시도해 주세요.');
    }
    const next = jobs.filter(j => j.state === 'queued').sort((a,b) => a.created - b.created)[0];
    for (const j of jobs.filter(j => !active(j) && j.created < Date.now() - 86400000)) await this.ctx.storage.delete('job:' + j.id);
    if (!next) return;
    const started = Date.now(), last = await this.ctx.storage.get('browser:last') || 0;
    if (started < last + 21000) { await this.ctx.storage.setAlarm(last + 21000); return; }
    await this.ctx.storage.put('browser:last', started);
    next.state = 'working'; await this.ctx.storage.put('job:' + next.id, next);
    // Crash watchdog also schedules remaining work if the instance is evicted.
    await this.ctx.storage.setAlarm(started + 65000);
    try {
      const token = await crypt(this.env, next.credential, true);
      const session = {user: {id: next.owner}, accessToken: token};
      const store = createCloudStore(this.env, token), ref = await store.getRef(next.refId);
      if (!ref || ref.sample) { await this.finish(next, 'cancelled'); return; }
      const media = createCloudMedia(this.env, fetch, {reserve: (owner, bytes) => this.reserveMedia(owner, bytes)});
      const result = await captureWebsite(this.env, next.url, session, media);
      // Use the current revision and preserve notes/tags edited while waiting.
      for (let attempt = 0; attempt < 3; attempt++) {
        const current = await store.getRef(next.refId);
        if (!current) { await this.finish(next, 'cancelled'); return; }
        try {
          await store.saveRef({...current, ...result, title: current.title === new URL(current.url).hostname ? result.title : current.title,
            description: current.userEdited ? current.description : result.description, tags: current.tags}, next.owner);
          break;
        } catch (error) { if (error.status !== 409 || attempt === 2) throw error; }
      }
      await this.finish(next, 'complete');
    } catch(error) {
      console.warn('capture_failed',error.captureStage||'job',error.name||'Error');
      await this.finish(next, 'failed', '캡처하지 못했어요. 로그인 상태·사이트 접근·무료 한도를 확인하거나 이미지를 올려 주세요.');
    } finally {
      const remaining = [...(await this.ctx.storage.list({prefix: 'job:'})).values()].some(j => j.state === 'queued');
      if (remaining) await this.ctx.storage.setAlarm(Math.max(Date.now() + 1000, started + 21000));
      else await this.ctx.storage.deleteAlarm();
    }
  }
  async finish(job, state, error) {
    if (error && job.credential) {
      try {
        const token = await crypt(this.env, job.credential, true), store = createCloudStore(this.env, token);
        for(let attempt=0;attempt<3;attempt++) {
          const ref = await store.getRef(job.refId); if(!ref)break;
          try {await store.saveRef({...ref,status:'failed',error},job.owner);break;}
          catch(conflict) {if(conflict.status!==409||attempt===2)throw conflict;}
        }
      } catch {} // Expired/deleted references must not keep retrying the browser.
    }
    const {credential, ...safe} = job;
    await this.ctx.storage.put('job:' + job.id, {...safe, state});
  }
}

export function cloudCapture(env) {
  if (!env.COORDINATOR || !env.BROWSER) return null;
  const coordinator = env.COORDINATOR.getByName('reflow-free-limits-v1');
  return {
    jobs: session => coordinator.jobs(session.user.id),
    async enqueue(ref, session, store) {
      // Saved before enqueue so an alarm cannot race an API revision update.
      const pending = ref.status === 'queued' ? ref : await store.saveRef({...ref, status: 'queued', error: null}, session.user.id);
      const result = await coordinator.enqueue(pending, session.user.id, session.accessToken);
      return result.ok ? pending : store.saveRef({...pending, status: 'failed', error: result.error}, session.user.id);
    }
  };
}

