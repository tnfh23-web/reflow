import test from 'node:test';
import assert from 'node:assert/strict';
import {limits,reserveMedia,reserveCapture,enqueueCapture} from '../cloud/limits.mjs';
class Storage {
  data=new Map(); tail=Promise.resolve();
  async get(k){return structuredClone(this.data.get(k));}
  async put(k,v){if(typeof k==='object')for(const [key,value] of Object.entries(k))this.data.set(key,structuredClone(value));else this.data.set(k,structuredClone(v));}
  async list({prefix}){return new Map([...this.data].filter(([k])=>k.startsWith(prefix)).map(([k,v])=>[k,structuredClone(v)]));}
  transaction(fn){const operation=this.tail.then(async()=>{const snapshot=new Map(this.data);try{return await fn(this);}catch(e){this.data=snapshot;throw e;}});this.tail=operation.catch(()=>{});return operation;}
}
test('concurrent owners never exceed daily shared capture limit; one owner is capped separately',async()=>{
 const storage=new Storage();const results=await Promise.all(Array.from({length:25},(_,i)=>reserveCapture(storage,'owner'+i)));
 assert.equal(results.filter(r=>r.ok).length,limits.captureDaily);
 const single=new Storage();assert.deepEqual((await Promise.all(Array.from({length:5},()=>reserveCapture(single,'same')))).map(r=>r.ok),[true,true,true,false,false]);
});
test('concurrent duplicate jobs reserve once and enqueue once; completed jobs allow a new capture',async()=>{
 const storage=new Storage(),job={id:'first',owner:'owner',refId:'ref',state:'queued'};
 const results=await Promise.all(Array.from({length:20},(_,i)=>enqueueCapture(storage,{...job,id:'job'+i})));
 assert.ok(results.every(r=>r.ok));assert.equal((await storage.list({prefix:'job:'})).size,1);
 const key=[...(await storage.list({prefix:'job:'})).keys()][0];await storage.put(key,{...job,state:'complete'});
 assert.equal((await enqueueCapture(storage,{...job,id:'again'})).ok,true);
 assert.equal((await storage.get('captures:'+new Date().toISOString().slice(0,10))).total,2);
});
test('storage quota rejects oversized uploads and concurrent capacity overruns without updating totals',async()=>{
 const storage=new Storage();await storage.put('media:total',limits.totalBytes-100);
 const results=await Promise.all([reserveMedia(storage,'a',60),reserveMedia(storage,'b',60)]);
 assert.deepEqual(results.map(r=>r.ok),[true,false]);assert.equal(await storage.get('media:total'),limits.totalBytes-40);
 assert.equal((await reserveMedia(storage,'a',0)).ok,false);assert.equal((await reserveMedia(storage,'a',13*1024*1024)).ok,false);
 const owner=new Storage();await owner.put('media:owner',limits.ownerBytes);assert.equal((await reserveMedia(owner,'owner',1)).ok,false);
 const count=new Storage();const uploads=await Promise.all(Array.from({length:35},()=>reserveMedia(count,'owner',1)));assert.equal(uploads.filter(r=>r.ok).length,limits.uploadDaily);
});
