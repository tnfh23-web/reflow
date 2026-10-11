import test from 'node:test';
import assert from 'node:assert/strict';
import {previewMedia} from '../cloud/capture-media.mjs';
test('media redirects stay on verified public preview hosts and use bounded ranges',async()=>{
 const checked=[],ranges=[];
 const result=await previewMedia('https://player.vimeo.com/file.mp4','bytes=32-',{
 verify:async host=>checked.push(host),fetcher:async(url,options)=>{ranges.push(options.headers.Range);return url.includes('player.vimeo')?new Response(null,{status:302,headers:{location:'https://download-video-ak.vimeocdn.com/file.mp4'}}):new Response(new Uint8Array([1,2]),{status:206,headers:{'content-type':'video/mp4','content-range':'bytes 32-33/100'}});}});
 assert.deepEqual(checked,['player.vimeo.com','download-video-ak.vimeocdn.com']);assert.deepEqual(ranges,['bytes=32-1048607','bytes=32-1048607']);assert.equal(result.body.length,2);
});
test('unapproved redirects and responses ignoring range cannot bypass limits',async()=>{
 await assert.rejects(()=>previewMedia('https://player.vimeo.com/file.mp4','',{verify:async()=>{},fetcher:async()=>new Response(null,{status:302,headers:{location:'https://127.0.0.1/file.mp4'}})}),/host unavailable/);
 await assert.rejects(()=>previewMedia('https://player.vimeo.com/file.mp4','',{verify:async()=>{},fetcher:async()=>new Response(new Uint8Array(1024*1024+1),{headers:{'content-type':'video/mp4'}})}),/too large/);
});
