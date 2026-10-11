import {useSyncExternalStore} from 'react';

const listeners=new Set();
let promptEvent=null,registration=null;
const display=window.matchMedia('(display-mode: standalone)');
let state={available:false,installed:display.matches||navigator.standalone===true,busy:false,waiting:false,error:''};
const emit=patch=>{state={...state,...patch};listeners.forEach(fn=>fn());};
const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;emit({available:true,error:''});});
window.addEventListener('appinstalled',()=>{promptEvent=null;emit({installed:true,available:false,busy:false});});
display.addEventListener('change',()=>emit({installed:display.matches||navigator.standalone===true}));

export async function installApp(){
  if(!promptEvent||state.busy)return;
  const event=promptEvent;promptEvent=null;emit({busy:true,available:false,error:''});
  try{await event.prompt();await event.userChoice;}catch{emit({error:'설치 창을 열지 못했어요. 아래의 브라우저 메뉴를 이용해 주세요.'});}
  finally{emit({busy:false});}
}
export function usePwa(){return useSyncExternalStore(subscribe,()=>state);}

export function registerPwa(){
  if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
  navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(reg=>{
    registration=reg;
    const check=()=>emit({waiting:Boolean(reg.waiting&&navigator.serviceWorker.controller)});
    check();reg.addEventListener('updatefound',()=>reg.installing?.addEventListener('statechange',check));
    // Waiting workers activate when all app windows close; never interrupt unsaved input.
    window.addEventListener('online',()=>registration?.update().catch(()=>{}));
  }).catch(()=>emit({error:'앱 준비를 완료하지 못했어요. 연결을 확인하고 다시 열어 주세요.'}));
}
