export async function api(path,options={}) {
  const {body,...rest}=options;
  const response=await fetch('/api'+path,{credentials:'same-origin',...rest,...(body instanceof FormData?{body}:body!==undefined?{headers:{'Content-Type':'application/json',...rest.headers},body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>({error:'서버 응답을 읽지 못했어요.'}));
  if(!response.ok)throw Object.assign(new Error(data.error||'요청을 처리하지 못했어요.'),data);
  return data;
}
export const formatDate=d=>new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d));
export const allTags=r=>Object.values(r.tags||{}).flat();
export const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
