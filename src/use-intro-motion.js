import {useLayoutEffect} from 'react';
import {gsap,ScrollTrigger} from './motion';
import {SplitText} from 'gsap/SplitText';
gsap.registerPlugin(SplitText);
export function useIntroMotion(root){
  useLayoutEffect(()=>{
    const mm=gsap.matchMedia();let alive=true,refreshFrame=0;
    mm.add('(prefers-reduced-motion: no-preference)',()=>{
      const splits=[],cleanups=[],splitCleanup=new Map(),tracked=new Set(),targetsToClear=new Set();
      // Arm outside the viewport, enter in a consistent reading band, and only
      // re-arm after the element has completely cleared the screen.
      const watch=(el,targets,tween,from,forceFirst=false)=>{
        tracked.add(el);(Array.isArray(targets)?targets:[targets]).forEach(node=>targetsToClear.add(node));const rect=el.getBoundingClientRect();
        const inBand=rect.bottom>innerHeight*.12&&rect.top<innerHeight*.86;
        const preserve=inBand&&(el.dataset.introState==='shown'||(!forceFirst&&!el.dataset.introState));
        let armed=!preserve;
        if(preserve){tween.progress(1).pause();el.dataset.introState='shown';}
        else{gsap.set(targets,from);el.dataset.introState='waiting';}
        const start=()=>{if(!armed)return;armed=false;el.dataset.introState='animating';gsap.set(targets,from);tween.restart();};
        const entry=new IntersectionObserver(([record])=>{if(record.isIntersecting)start();},{rootMargin:'-12% 0px -14% 0px'});
        const exit=new IntersectionObserver(([record])=>{if(!record.isIntersecting){armed=true;tween.pause(0);gsap.set(targets,from);el.dataset.introState='waiting';}},{rootMargin:'120px 0px 120px 0px'});
        entry.observe(el);exit.observe(el);
        return()=>{entry.disconnect();exit.disconnect();};
      };
      const shown=el=>()=>{el.dataset.introState='shown';el.dispatchEvent(new Event('intro:shown',{bubbles:true}));};
      root.current.querySelectorAll('[data-split]').forEach(el=>{
        splits.push(SplitText.create(el,{type:'lines,chars',autoSplit:true,mask:'lines',aria:'auto',charsClass:'intro-title-char',onSplit:self=>{
          splitCleanup.get(el)?.();const from={yPercent:65,opacity:0};
          const tween=gsap.fromTo(self.chars,from,{yPercent:0,opacity:1,duration:.72,stagger:.085,ease:'power2.out',paused:true,immediateRender:false,onComplete:shown(el)});
          splitCleanup.set(el,watch(el,self.chars,tween,from,true));return tween;
        }}));
      });
      const reveal=(el,targets,from,to)=>{const tween=gsap.fromTo(targets,from,{...to,paused:true,immediateRender:false,onComplete:shown(el)});cleanups.push(watch(el,targets,tween,from));};
      root.current.querySelectorAll('[data-intro-reveal]').forEach(el=>{
        const graphic=el.tagName==='FIGURE'||el.querySelector('img')||el.classList.contains('intro-install-copy')||el.classList.contains('intro-loop');
        reveal(el,el,{opacity:0,y:22},{opacity:1,y:0,duration:graphic?2:1.8,delay:graphic?.25:.12,ease:'power2.out'});
      });
      root.current.querySelectorAll('[data-intro-group]').forEach(el=>el.children.length&&reveal(el,[...el.children],{opacity:0,y:16},{opacity:1,y:0,duration:1.35,stagger:.18,delay:.2,ease:'power2.out'}));
      root.current.querySelectorAll('.intro-heading-icon').forEach(el=>reveal(el,el,{opacity:0,y:12},{opacity:1,y:0,duration:1.5,ease:'power2.out'}));
      return()=>{cleanups.forEach(fn=>fn());splitCleanup.forEach(fn=>fn());splits.forEach(s=>s.revert());targetsToClear.forEach(node=>{node.style.removeProperty('opacity');node.style.removeProperty('transform');});tracked.forEach(el=>{delete el.dataset.introState;el.dispatchEvent(new Event('intro:shown',{bubbles:true}));});};
    },root);
    const refresh=()=>{if(alive&&!refreshFrame)refreshFrame=requestAnimationFrame(()=>{refreshFrame=0;if(alive)ScrollTrigger.refresh();});};
    document.fonts?.ready.then(refresh);const observer=new ResizeObserver(refresh);observer.observe(root.current);
    return()=>{alive=false;cancelAnimationFrame(refreshFrame);observer.disconnect();mm.revert();};
  },[root]);
}
