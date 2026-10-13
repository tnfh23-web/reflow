import { chromium } from 'playwright';
import {prepareCapture} from '../cloud/capture-ready.mjs';
import {capturePageTiles} from '../cloud/capture-tiles.mjs';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { mediaDir, registerMedia, uid } from './store.js';

let browserPromise;
const checkedHosts=new Map();
const sampleOrigin='http://127.0.0.1:'+Number(process.env.PORT||4183);
const sampleOrigins=new Set(['http://127.0.0.1:4182',sampleOrigin]);
const isSampleUrl=u=>sampleOrigins.has(u.origin)&&/^\/samples\/[a-z-]+\.html$/.test(u.pathname);
function privateAddress(address) {
  const a=address.toLowerCase();
  if (isIP(a)===6) return a==='::1'||a==='::'||a.startsWith('fc')||a.startsWith('fd')||a.startsWith('fe80:')||a.startsWith('::ffff:');
  const [x,y]=a.split('.').map(Number);
  return x===0||x===10||x===127||x>=224||(x===169&&y===254)||(x===172&&y>=16&&y<=31)||(x===192&&y===168)||(x===100&&y>=64&&y<=127)||(x===198&&(y===18||y===19));
}
export async function safeUrl(value, allowSamples=false) {
  let u; try { u=new URL(value); } catch { throw new Error('올바른 웹사이트 URL을 입력해 주세요.'); }
  if (!['http:','https:'].includes(u.protocol)||u.username||u.password) throw new Error('http 또는 https 웹사이트만 저장할 수 있어요.');
  u.hash='';
  const sample=allowSamples&&isSampleUrl(u);
  if (sample) return u.href;
  if ((u.port&&!['80','443'].includes(u.port))||u.hostname==='localhost'||u.hostname.endsWith('.local')||u.hostname.endsWith('.internal')) throw new Error('공개 웹사이트만 캡처할 수 있어요.');
  const host=u.hostname.replace(/^\[|\]$/g,'');
  const cached=checkedHosts.get(host);
  if (!cached||Date.now()-cached>10000) {
    const addresses=isIP(host)?[{address:host}]:await lookup(host,{all:true});
    if (!addresses.length||addresses.some(({address})=>privateAddress(address))) throw new Error('내부 네트워크 주소는 캡처할 수 없어요.');
    checkedHosts.set(host,Date.now());
  }
  return u.href;
}
async function browser() {
  if (!browserPromise) browserPromise=chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})}).catch(e=>{browserPromise=null; throw e;});
  return browserPromise;
}
export async function closeBrowser() { if(browserPromise) { const b=await browserPromise.catch(()=>null); await b?.close(); browserPromise=null; } }
export async function imageFile(buffer,owner,prefix='capture') {
  const name=`${prefix}-${uid()}.webp`;
  await sharp(buffer).webp({quality:85}).toFile(path.join(mediaDir,name));
  return registerMedia(name,owner);
}
export async function imageAnalysis(buffer) {
  const {data}=await sharp(buffer).resize(80,80,{fit:'inside'}).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const buckets=new Map();
  for(let i=0;i<data.length;i+=3) { const rgb=[data[i],data[i+1],data[i+2]].map(c=>Math.round(c/32)*32).map(c=>Math.min(255,c)); const key='#'+rgb.map(c=>c.toString(16).padStart(2,'0')).join('').toUpperCase(); buckets.set(key,(buckets.get(key)||0)+1); }
  return [...buckets].sort((a,b)=>b[1]-a[1]).slice(0,4).map(([hex],i)=>({hex,role:i===0?'이미지 주요색':'이미지 보조색'}));
}
export async function capture(url,owner) {
  // Personal copies of built-in examples work without a separate Vite server.
  const source=new URL(url);
  if(owner&&isSampleUrl(source))url=new URL(source.pathname,sampleOrigin).href;
  await safeUrl(url,true);
  const b=await browser(); const context=await b.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,colorScheme:'light',serviceWorkers:'block'});
  const page=await context.newPage();
  const timeLimit=setTimeout(()=>context.close().catch(()=>{}),60000);
  let requests=0;
  try {
    await context.route('**/*',async route=>{
      if(++requests>300) return route.abort();
      const request=route.request();
      if(request.method()!=='GET') return route.abort();
      try {
        const u=new URL(request.url());
        if(['data:','blob:'].includes(u.protocol)) return route.continue();
        const source=new URL(url);const isSample=isSampleUrl(source);
        if(isSample&&u.origin===source.origin&&/^\/(samples|media|fonts)\//.test(u.pathname)) return route.continue();
        await safeUrl(u.href); return route.continue();
      } catch { return route.abort(); }
    });
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
    await prepareCapture(page);
    const originalHeight=await page.evaluate(()=>document.documentElement.scrollHeight);
    const total=Math.min(originalHeight,16000);
    const observed=await page.evaluate(()=>{
      const rgbHex=c=>{const v=c.match(/[\d.]+/g);return v&&v.length>=3?'#'+v.slice(0,3).map(n=>Math.round(Number(n)).toString(16).padStart(2,'0')).join('').toUpperCase():null;};
      const nodes=[...document.querySelectorAll('header, main > article, section, footer')]
        .filter(n=>!n.parentElement?.closest('section'))
        .filter(n=>{const r=n.getBoundingClientRect();return r.height>0&&(r.height>150||n.matches('header,footer'));});
      const sectionCandidates=nodes.map((n,i)=>{const r=n.getBoundingClientRect();return {name:n.dataset.section||n.getAttribute('aria-label')||n.querySelector('h1,h2')?.textContent?.trim().slice(0,40)|| (n.tagName==='FOOTER'?'Footer':n.tagName==='HEADER'?'Header':`섹션 ${i+1}`),y:Math.max(0,Math.round(r.top+scrollY)),height:Math.round(r.height)};}).filter(n=>n.y<16000);
      const sections=sectionCandidates.length>14?[...sectionCandidates.slice(0,13),sectionCandidates.at(-1)]:sectionCandidates;
      const typeNodes=[document.querySelector('h1'),document.querySelector('h2'),document.querySelector('p')].filter(Boolean);
      const typography=typeNodes.map(n=>{const s=getComputedStyle(n);return {role:n.tagName==='H1'?'제목':n.tagName==='H2'?'소제목':'본문',family:s.fontFamily,size:s.fontSize,weight:s.fontWeight,lineHeight:s.lineHeight};});
      const colors=[{hex:rgbHex(getComputedStyle(document.body).backgroundColor),role:'본문 배경'},{hex:typeNodes[0]?rgbHex(getComputedStyle(typeNodes[0]).color):null,role:'제목 글자'},{hex:typeNodes[2]?rgbHex(getComputedStyle(typeNodes[2]).color):null,role:'본문 글자'}].filter(c=>c.hex);
      const descriptions=[...document.querySelectorAll('meta[name=description]')].map(m=>m.content).join(' ');
      const title=document.querySelector('meta[property="og:title"]')?.content||document.title||location.hostname;
      const layout={display:getComputedStyle(document.querySelector('main')||document.body).display,columns:getComputedStyle(document.querySelector('main')||document.body).gridTemplateColumns};
      return {title,description:descriptions,sections,typography,colors,layout};
    });
    const tiles=await capturePageTiles(page,{height:Math.max(1,total)});
    const rawBuffer=await sharp({create:{width:1440,height:Math.max(1,total),channels:4,background:'#fff'}})
      .composite(tiles.map(tile=>({input:tile.body,left:0,top:tile.y}))).png().toBuffer();
    const rawMeta=await sharp(rawBuffer).metadata();
    const capturedHeight=Math.min(rawMeta.height,16000);
    const capturedWidth=Math.min(rawMeta.width,1440);
    const fullBuffer=await sharp(rawBuffer).extract({left:0,top:0,width:capturedWidth,height:capturedHeight}).toBuffer();
    const image=await imageFile(fullBuffer,owner);
    const thumb=await imageFile(await sharp(fullBuffer).extract({left:0,top:0,width:capturedWidth,height:Math.min(900,capturedHeight)}).resize(960).toBuffer(),owner,'thumb');
    let sections=observed.sections.filter(s=>s.y<capturedHeight);
    if(!sections.length) sections=Array.from({length:Math.ceil(total/900)},(_,i)=>({name:i===0?'Hero':`섹션 ${i+1}`,y:i*900,height:Math.min(900,total-i*900)})).slice(0,14);
    for(const s of sections) { s.height=Math.max(1,Math.min(s.height,capturedHeight-s.y)); s.id=uid(); s.x=0; s.width=capturedWidth; s.image=await imageFile(await sharp(fullBuffer).extract({left:0,top:s.y,width:capturedWidth,height:s.height}).resize({width:960,withoutEnlargement:true}).toBuffer(),owner,'section'); }
    const motions=[];
    const hover=page.locator('a,button:not([type=submit]),[data-observe-hover]').filter({hasNot:page.locator('form')}).first();
    if(await hover.count()) {
      const beforeStyle=await hover.evaluate(n=>{const s=getComputedStyle(n);return [s.color,s.backgroundColor,s.transform,s.opacity,s.boxShadow].join('|');});
      const before=await page.screenshot(); await hover.hover({timeout:2000}).catch(()=>{}); await page.waitForTimeout(350);
      const afterStyle=await hover.evaluate(n=>{const s=getComputedStyle(n);return [s.color,s.backgroundColor,s.transform,s.opacity,s.boxShadow].join('|');});
      if(beforeStyle!==afterStyle) motions.push({id:uid(),kind:'Hover',trigger:'첫 조작 요소에 포인터 진입',behavior:'브라우저에서 색상·배경·변형 스타일 변화가 관찰됐습니다.',before:await imageFile(before,owner,'before'),after:await imageFile(await page.screenshot(),owner,'after')});
    }
    await page.mouse.move(1430,890);
    for(const [kind,selector] of [['Menu','button[aria-expanded="false"][aria-controls]:not([type="submit"])'],['Tab','[role="tab"][aria-selected="false"]']]) {
      const control=page.locator(selector).first();
      if(await control.count()&&await control.isVisible()&&!(await control.evaluate(n=>Boolean(n.closest('form'))))) {
        const before=await page.screenshot();
        const previous=await control.getAttribute(kind==='Menu'?'aria-expanded':'aria-selected');
        await control.click({timeout:2000}).catch(()=>{}); await page.waitForTimeout(250);
        const after=await control.getAttribute(kind==='Menu'?'aria-expanded':'aria-selected');
        if(previous!==after)motions.push({id:uid(),kind,trigger:kind==='Menu'?'메뉴 열기 버튼 클릭':'탭 선택',behavior:kind==='Menu'?'메뉴의 aria-expanded 상태가 실제로 변경됐습니다.':'탭의 aria-selected 상태가 실제로 변경됐습니다.',before:await imageFile(before,owner,'before'),after:await imageFile(await page.screenshot(),owner,'after')});
        if(kind==='Menu'&&after==='true')await control.click({timeout:1000}).catch(()=>{});
      }
    }
    const candidates=await page.locator('main img, main h1, main h2, [data-motion]').all();
    const firstStyles=await Promise.all(candidates.slice(0,20).map(n=>n.evaluate(el=>{const s=getComputedStyle(el);return [s.transform,s.opacity].join('|');}).catch(()=>'')));
    const before=await page.screenshot();
    await page.evaluate(()=>window.scrollTo(0,350)); await page.waitForTimeout(400);
    const secondStyles=await Promise.all(candidates.slice(0,20).map(n=>n.evaluate(el=>{const s=getComputedStyle(el);return [s.transform,s.opacity].join('|');}).catch(()=>'')));
    if(firstStyles.some((s,i)=>s!==secondStyles[i])) motions.push({id:uid(),kind:'Scroll',trigger:'페이지를 아래로 350px 이동',behavior:'스크롤 전후 요소의 transform 또는 opacity 변화가 관찰됐습니다.',before:await imageFile(before,owner,'before'),after:await imageFile(await page.screenshot(),owner,'after')});
    return {...observed,image,thumb,width:capturedWidth,height:capturedHeight,sections,motions,colors:observed.colors.length?observed.colors:await imageAnalysis(fullBuffer),status:'ready',analysisSource:'브라우저 CSS·직접 관찰',captureVersion:uid(),truncated:originalHeight>16000,tags:{style:[],layout:[],interaction:motions.map(m=>m.kind)}};
  } finally { clearTimeout(timeLimit); await context.close().catch(()=>{}); }
}

