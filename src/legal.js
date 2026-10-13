import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

const toc=document.querySelector('.legal-toc');
const links=[...toc.querySelectorAll('ol a')];
const sections=links.map(link=>document.getElementById(link.hash.slice(1)));
const article=document.querySelector('.legal-content');
const header=document.querySelector('.legal-topbar');
const position=document.querySelector('[data-reading-position]');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let lenis=null,frame=0,lastY=scrollY;

function configureScroll(){
  lenis?.destroy();lenis=null;
  if(!reduced.matches)lenis=new Lenis({lerp:.12,smoothWheel:true,syncTouch:false,autoRaf:true,stopInertiaOnNavigate:true,anchors:{duration:.65}});
}
configureScroll();
reduced.addEventListener('change',configureScroll);

function updateReading(){
  frame=0;
  const y=scrollY,atBottom=y+innerHeight>=document.documentElement.scrollHeight-4;
  const focusY=y+innerHeight*.25;
  let current=0;
  sections.forEach((section,index)=>{if(section.getBoundingClientRect().top+y<=focusY)current=index;});
  if(atBottom)current=sections.length-1;
  links.forEach((link,index)=>{
    const active=index===current;
    link.classList.toggle('active',active);
    if(active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');
  });
  position.textContent=`${String(current+1).padStart(2,'0')} / ${String(sections.length).padStart(2,'0')}`;
  const start=article.getBoundingClientRect().top+y;
  const end=Math.max(1,document.documentElement.scrollHeight-innerHeight-start);
  const progress=atBottom?1:Math.min(1,Math.max(0,(y-start)/end));
  toc.style.setProperty('--reading-progress',progress);
  if(y<80)header.dataset.hidden='false';
  else if(Math.abs(y-lastY)>3)header.dataset.hidden=String(y>lastY&&!header.contains(document.activeElement));
  lastY=y;
}
const schedule=()=>{if(!frame)frame=requestAnimationFrame(updateReading);};
window.addEventListener('scroll',schedule,{passive:true});
window.addEventListener('resize',schedule);
window.addEventListener('hashchange',schedule);
document.fonts.ready.then(schedule);
updateReading();

const toggle=document.querySelector('.toc-toggle');
const list=document.getElementById('document-toc');
toggle.hidden=false;
toggle.addEventListener('click',()=>{
  list.hidden=!list.hidden;
  toggle.setAttribute('aria-expanded',String(!list.hidden));
  toggle.textContent=list.hidden?'펼치기':'접기';
  lenis?.resize();schedule();
});

const themeButtons=[...document.querySelectorAll('[data-theme-toggle]')];
themeButtons.forEach(button=>{button.hidden=false;});
document.querySelector('.reading-position').hidden=false;
function syncTheme(){
  const dark=document.documentElement.dataset.theme==='dark';
  themeButtons.forEach(button=>button.setAttribute('aria-label',dark?'라이트 테마로 변경':'다크 테마로 변경'));
  document.querySelector('meta[name=theme-color]').content=dark?'#15171b':'#ffffff';
}
themeButtons.forEach(button=>button.addEventListener('click',()=>{
  const next=document.documentElement.dataset.theme==='dark'?'light':'dark';
  document.documentElement.dataset.theme=next;
  try{localStorage.setItem('reflow-theme',next);}catch{}
  syncTheme();
}));
window.addEventListener('storage',event=>{
  if(event.key==='reflow-theme'){document.documentElement.dataset.theme=event.newValue||'light';syncTheme();}
});
syncTheme();

header.addEventListener('focusin',()=>{header.dataset.hidden='false';});
document.addEventListener('keydown',event=>{
  if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)&&!event.target.closest('input,textarea,select,[contenteditable]'))lenis?.reset();
});
window.addEventListener('pagehide',()=>{lenis?.destroy();lenis=null;cancelAnimationFrame(frame);frame=0;});
window.addEventListener('pageshow',event=>{if(event.persisted){configureScroll();schedule();}});
