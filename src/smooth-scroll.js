import {useEffect} from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import {gsap,ScrollTrigger} from './motion';

const instances=new Map();
const containers='.section-rail,.capture-viewer,.inspector-wrap,.compare-image-scroll,.board,.board-inspector,.modal,.add-picker,.preview-image,.recent-grid,.filter-popover,.guide-section-image,.guide-step-list';
const editable='input,textarea,select,[contenteditable="true"]';

export function smoothScrollTo(wrapper,top,{immediate=false}={}){
  const target=wrapper||window,instance=instances.get(target);
  if(instance){instance.scrollTo(top,{immediate,duration:.65});return;}
  target.scrollTo({top,behavior:immediate||matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}

// One clock for page, panels and image viewers; touch keeps native momentum.
export function useAppSmoothScroll(){
  useEffect(()=>{
    const preference=matchMedia('(prefers-reduced-motion: reduce)');
    let scheduled=0;
    const clear=()=>{for(const instance of instances.values())instance.destroy();instances.clear();};
    const scan=()=>{
      scheduled=0;
      if(preference.matches){clear();return;}
      const targets=[window,...document.querySelectorAll(containers)];
      for(const [target,instance] of instances){if(!targets.includes(target)){instance.destroy();instances.delete(target);}}
      for(const target of targets){
        const root=target===window;
        const style=root?null:getComputedStyle(target);
        const horizontal=!root&&(style.flexDirection==='row'&&target.matches('.section-rail,.guide-step-list')||target.matches('.board,.recent-grid'));
        const orientation=horizontal?'horizontal':'vertical';
        const previous=instances.get(target);
        if(previous?.options.orientation===orientation)continue;
        previous?.destroy();
        const instance=new Lenis({
          wrapper:target,content:root?document.documentElement:target,
          orientation,gestureOrientation:horizontal?'both':'vertical',
          lerp:.12,smoothWheel:true,syncTouch:false,autoRaf:false,
          naiveDimensions:true,autoResize:false,allowNestedScroll:true,
          prevent:node=>node.matches(editable),
          virtualScroll:({event})=>!event.target.closest?.('.cropping')&&(!root||document.body.style.overflow!=='hidden'),
        });
        instance.on('scroll',ScrollTrigger.update);
        instances.set(target,instance);
      }
    };
    const schedule=()=>{if(!scheduled)scheduled=requestAnimationFrame(scan);};
    const reset=()=>{for(const instance of instances.values())instance.reset();};
    const key=e=>{if(!e.target.closest?.(editable)&&['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','PageDown','PageUp','Home','End',' '].includes(e.key))reset();};
    const tick=time=>{if(!document.hidden)for(const instance of instances.values())instance.raf(time*1000);};
    const observer=new MutationObserver(schedule);
    observer.observe(document.getElementById('root'),{childList:true,subtree:true});
    scan();gsap.ticker.add(tick);
    preference.addEventListener('change',schedule);
    window.addEventListener('resize',schedule);
    window.addEventListener('hashchange',reset);
    document.addEventListener('load',schedule,true);
    document.addEventListener('pointerdown',reset,true);
    document.addEventListener('keydown',key,true);
    document.addEventListener('visibilitychange',reset);
    return()=>{
      observer.disconnect();cancelAnimationFrame(scheduled);gsap.ticker.remove(tick);clear();
      preference.removeEventListener('change',schedule);
      window.removeEventListener('resize',schedule);window.removeEventListener('hashchange',reset);
      document.removeEventListener('load',schedule,true);document.removeEventListener('pointerdown',reset,true);
      document.removeEventListener('keydown',key,true);document.removeEventListener('visibilitychange',reset);
    };
  },[]);
}
