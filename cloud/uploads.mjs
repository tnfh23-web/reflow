import {createCloudMedia, webpDimensions} from './media.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};

async function formOf(request) {
  if(!request.headers.get('content-type')?.startsWith('multipart/form-data'))fail('이미지 요청을 확인해 주세요.',415);
  const reader=request.body.getReader(),parts=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>13*1024*1024){await reader.cancel();fail('업로드는 12MB 이하로 줄여 주세요.',413);}parts.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}
  return new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type')}}).formData();
}
async function bytesOf(form,key){const value=form.get(key);if(!(value instanceof File))fail('이미지를 선택해 주세요.');return new Uint8Array(await value.arrayBuffer());}

export function cloudUploads(env, dependencies = {}) {
  const coordinator=env.COORDINATOR?.getByName('reflow-free-limits-v1');
  const media=createCloudMedia(env,dependencies.fetcher || fetch,{reserve:(owner,bytes)=>coordinator.reserveMedia(owner,bytes)});
  return {...media,
    async upload(request,ref,session,store){
      if(['queued','working'].includes(ref.status))fail('캡처가 끝난 뒤 이미지를 올려 주세요.',409);
      const form=await formOf(request),fullBytes=await bytesOf(form,'image'),thumbBytes=await bytesOf(form,'thumb');
      const dimensions=webpDimensions(fullBytes),thumbDimensions=webpDimensions(thumbBytes);
      if(thumbDimensions.width>960||thumbDimensions.height>900)fail('미리보기 크기를 확인해 주세요.');
      const full=await media.persist(fullBytes,session),thumb=await media.persist(thumbBytes,session);
      return store.saveRef({...ref,...dimensions,image:full.image,thumb:thumb.image,sections:[],motions:[],typography:[],colors:[],
        status:'ready',error:null,analysisSource:'직접 업로드',captureVersion:crypto.randomUUID()},session.user.id);
    },
    async sections(request,ref,session,store){
      if(['queued','working'].includes(ref.status))fail('캡처가 끝난 뒤 구간을 저장해 주세요.',409);
      if((ref.sections||[]).length>=20)fail('구간은 최대 20개까지 보관할 수 있어요.');
      const form=await formOf(request);let crop;try{crop=JSON.parse(form.get('crop'));}catch{fail('구간 내용을 확인해 주세요.');}
      if(!crop||!['x','y','width','height'].every(k=>Number.isSafeInteger(crop[k]))||crop.x<0||crop.y<0||crop.width<20||crop.height<20||crop.x+crop.width>ref.width||crop.y+crop.height>ref.height)fail('이미지 안의 구간을 선택해 주세요.');
      const bytes=await bytesOf(form,'image'),dimensions=webpDimensions(bytes);
      if(dimensions.width>crop.width||dimensions.height>crop.height)fail('구간 이미지 크기를 확인해 주세요.');
      const saved=await media.persist(bytes,session);
      const next={x:crop.x,y:crop.y,width:crop.width,height:crop.height,id:crypto.randomUUID(),name:typeof crop.name==='string'?crop.name.slice(0,80)||'직접 선택':'직접 선택',image:saved.image};
      return store.saveRef({...ref,sections:[...ref.sections,next]},session.user.id);
    }
  };
}
