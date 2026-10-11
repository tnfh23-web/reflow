import {useEffect} from 'react';
export function useAutoHideHeader(ref,routeKey){
 useEffect(()=>{
  const header=ref.current;if(!header)return;
  let previous=window.scrollY,accumulated=0,frame=0;header.dataset.hidden='false';
  const update=()=>{frame=0;const y=Math.max(0,window.scrollY),delta=y-previous;previous=y;if(y<30||header.contains(document.activeElement)){header.dataset.hidden='false';accumulated=0;return;}accumulated=delta*accumulated<0?delta:accumulated+delta;if(accumulated>12&&y>80){header.dataset.hidden='true';accumulated=0;}else if(accumulated<-12){header.dataset.hidden='false';accumulated=0;}};
  const scroll=()=>{if(!frame)frame=requestAnimationFrame(update);};const focus=()=>{header.dataset.hidden='false';accumulated=0;};window.addEventListener('scroll',scroll,{passive:true});header.addEventListener('focusin',focus);
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('scroll',scroll);header.removeEventListener('focusin',focus);};
 },[ref,routeKey]);
}
