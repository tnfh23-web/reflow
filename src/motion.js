import {useLayoutEffect} from 'react';
import gsap from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import {reduced} from './api';
gsap.registerPlugin(ScrollTrigger);
export {gsap,ScrollTrigger};
export function useReveal(ref,key) {
  useLayoutEffect(()=>{
    if(!ref.current||reduced())return;
    const context=gsap.context(()=>{
      gsap.utils.toArray('[data-reveal]').forEach((el,i)=>gsap.fromTo(el,{opacity:0,y:18},{opacity:1,y:0,duration:.48,delay:(i%4)*.045,ease:'power2.out',scrollTrigger:{trigger:el,start:'top 98%',once:true}}));
    },ref);return ()=>context.revert();
  },[key]);
}
