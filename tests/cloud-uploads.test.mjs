import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudUploads} from '../cloud/uploads.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const session={user:{id:owner},accessToken:'verified-token'};
const ref={id:'reference',status:'ready',width:1440,height:2000,sections:[],note:'preserve'};
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SESSION_SECRET:'a'.repeat(43),APP_ORIGIN:'https://reflow.example',COORDINATOR:{getByName:()=>({reserveMedia:async()=>({ok:true})})}};
function frame(width,height){const b=new Uint8Array(30),v=new DataView(b.buffer);b.set(Buffer.from('RIFF'));v.setUint32(4,22,true);b.set(Buffer.from('WEBPVP8 '),8);v.setUint32(16,10,true);b.set([0x9d,1,0x2a],23);v.setUint16(26,width,true);v.setUint16(28,height,true);return b;}
function request(form){return new Request(env.APP_ORIGIN+'/api/upload',{method:'POST',body:form});}
test('cloud upload rejects invalid frames before storage and preserves metadata on replacement',async()=>{
 let writes=0;const upload=cloudUploads(env,{fetcher:async()=>{writes++;return Response.json({ok:true});}});
 const bad=new FormData();bad.set('image',new File(['bad'],'bad.webp'));bad.set('thumb',new File([frame(960,600)],'thumb.webp'));
 await assert.rejects(()=>upload.upload(request(bad),ref,session,{}));assert.equal(writes,0);
 const good=new FormData();good.set('image',new File([frame(1440,2000)],'full.webp'));good.set('thumb',new File([frame(960,600)],'thumb.webp'));
 const saved=await upload.upload(request(good),ref,session,{saveRef:async value=>value});
 assert.equal(writes,2);assert.equal(saved.note,'preserve');assert.equal(saved.height,2000);assert.equal(saved.analysisSource,'직접 업로드');assert.match(saved.image,new RegExp(owner));
});
test('cloud crops reject out-of-image selection and copy only supported coordinates and name',async()=>{
 let writes=0;const upload=cloudUploads(env,{fetcher:async()=>{writes++;return Response.json({ok:true});}});
 const form=new FormData();form.set('image',new File([frame(100,100)],'crop.webp'));form.set('crop',JSON.stringify({x:1400,y:0,width:100,height:100}));
 await assert.rejects(()=>upload.sections(request(form),ref,session,{}));assert.equal(writes,0);
 form.set('crop',JSON.stringify({x:10,y:20,width:100,height:100,name:'구간',owner:'forged',extra:'discard'}));
 const saved=await upload.sections(request(form),ref,session,{saveRef:async value=>value});assert.equal(writes,1);assert.equal(saved.note,'preserve');assert.equal(saved.sections[0].owner,undefined);assert.equal(saved.sections[0].extra,undefined);assert.equal(saved.sections[0].name,'구간');
});
test('quota-denied uploads never call storage; busy captures reject edits',async()=>{
 const limited={...env,COORDINATOR:{getByName:()=>({reserveMedia:async()=>({ok:false,error:'limit'})})}};
 const upload=cloudUploads(limited,{fetcher:()=>assert.fail('must not store')});
 const form=new FormData();form.set('image',new File([frame(1440,2000)],'full.webp'));form.set('thumb',new File([frame(960,600)],'thumb.webp'));
 await assert.rejects(()=>upload.upload(request(form),ref,session,{}),e=>e.status===429);
 await assert.rejects(()=>upload.upload(request(form),{...ref,status:'queued'},session,{}),e=>e.status===409);
});
