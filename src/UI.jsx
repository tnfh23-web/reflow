import {useEffect,useLayoutEffect,useRef} from 'react';
import {gsap} from './motion';
import {reduced} from './api';
export function Icon({name}) {
  const paths={info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r=".5"/></>,capture:<path d="M8 3H4a1 1 0 0 0-1 1v4M16 3h4a1 1 0 0 1 1 1v4M21 16v4a1 1 0 0 1-1 1h-4M8 21H4a1 1 0 0 1-1-1v-4"/>,note:<><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></>,compare:<><rect x="3" y="5" width="7" height="14" rx="1"/><rect x="14" y="5" width="7" height="14" rx="1"/></>,folder:<path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z"/>,help:<><circle cx="12" cy="12" r="9"/><path d="M9.5 8.5a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4"/><circle cx="12" cy="16.5" r=".6"/></>,window:<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h1M11 6.5h1"/></>,search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.2 15.2 4.5 4.5"/></>,library:<><rect x="5" y="4" width="12" height="16" rx="1"/><path d="M9 8h4M9 12h4M9 16h4M2 7v14h11"/></>,project:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15h2m2 0h2m2 0h2"/></>,settings:<><circle cx="12" cy="12" r="3"/><path d="m9 3 6 0 1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z"/></>,moon:<path d="M20 15A8 8 0 0 1 9 4a8 8 0 1 0 11 11Z"/>,close:<path d="m6 6 12 12M18 6 6 18"/>};
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]||paths.project}</svg>;
}
export function Brand(){return <span className="brand">REFLOW<span className="brand-mark"/></span>;}
export function Button({children,primary=false,className='',type='button',...props}){return <button type={type} className={`button ${primary?'primary':''} ${className}`} {...props}>{children}</button>;}
export function Empty({title,children,action}){return <div className="empty"><div className="empty-grid" aria-hidden="true"><span/><span/><span/></div><h2>{title}</h2><p>{children}</p>{action}</div>;}
export function Modal({title,children,onClose,wide=false}){
  const ref=useRef(null),closeRef=useRef(onClose); closeRef.current=onClose;
  useLayoutEffect(()=>{if(!reduced()){gsap.fromTo(ref.current,{opacity:0,y:12,scale:.98},{opacity:1,y:0,scale:1,duration:.25,ease:'power2.out'});}},[]);
  useEffect(()=>{
    const previous=document.activeElement;const old=document.body.style.overflow;document.body.style.overflow='hidden';
    const panel=ref.current;const focusable=()=>[...panel.querySelectorAll('button,a,input,textarea,select,[tabindex="0"]')].filter(e=>!e.disabled&&e.offsetParent!==null);
    const initial=panel.querySelector('[data-autofocus]')||focusable()[0];initial?.focus();
    const key=e=>{if(e.key==='Escape'){e.preventDefault();closeRef.current();}if(e.key==='Tab'){const list=focusable();if(!list.length)return;const first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
    document.addEventListener('keydown',key);return()=>{document.body.style.overflow=old;document.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus();};
  },[]);
  return <div className="modal-scrim" onPointerDown={e=>{if(e.target===e.currentTarget)onClose();}}><section ref={ref} className={`modal ${wide?'wide':''}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header className="modal-head"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label="닫기" onClick={onClose}><Icon name="close"/></button></header>{children}</section></div>;
}
export function Media({reference,full=false,className='',...props}){return reference.image?<img className={`media ${className}`} src={full?reference.image:reference.thumb||reference.image} alt={`${reference.title} ${full?'전체 페이지':'미리보기'}`} loading="lazy" decoding="async" {...props}/>:<div className="media-placeholder"><span>{reference.status==='failed'?'캡처를 확인해 주세요':'캡처를 준비하고 있어요'}</span></div>;}
export function Tags({tags}){return <div className="tags">{tags.filter(Boolean).map((t,i)=><span key={t+i}>{t}</span>)}</div>;}
export function ErrorText({error}){return error?<p className="form-error" role="alert">{error}</p>:null;}
