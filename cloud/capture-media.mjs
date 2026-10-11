import {verifyHost} from './network.mjs';

export const previewMediaHosts = ['player.vimeo.com','download-video-ak.vimeocdn.com'];
const chunkBytes=1024*1024;
// One screenshot needs a frame, not the full movie. Validate every redirect and
// cap the response stream even when a server ignores the Range request.
export async function previewMedia(url, range, {fetcher=fetch,verify=verifyHost}={}) {
 let current=new URL(url);const match=/^bytes=(\d+)-/.exec(range||'');
 const start=match?Number(match[1]):0;
 if(!Number.isSafeInteger(start)||start<0)throw new Error('Invalid media range');
 for(let redirects=0;redirects<4;redirects++) {
  if(current.protocol!=='https:'||current.username||current.password||current.port||!previewMediaHosts.includes(current.hostname))throw new Error('Media host unavailable');
  await verify(current.hostname);
  const response=await fetcher(current.href,{redirect:'manual',headers:{Range:`bytes=${start}-${start+chunkBytes-1}`},signal:AbortSignal.timeout(5000)});
  if(response.status>=300&&response.status<400){const location=response.headers.get('location');await response.body?.cancel();if(!location)throw new Error('Media redirect unavailable');current=new URL(location,current);continue;}
  if(![200,206].includes(response.status)||!/^video\/|^application\/octet-stream/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();throw new Error('Media unavailable');}
  const reader=response.body.getReader(),chunks=[];let size=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>chunkBytes)throw new Error('Media chunk too large');chunks.push(value);}}
  finally{await reader.cancel().catch(()=>{});}
  const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}
  const headers=Object.fromEntries(response.headers);delete headers['content-encoding'];delete headers['transfer-encoding'];headers['content-length']=String(size);
  return {status:response.status,headers,body:Buffer.from(body)};
 }
 throw new Error('Too many media redirects');
}
