import {launch} from '@cloudflare/playwright';
import {referenceUrl} from './api.mjs';
import {verifyHost} from './network.mjs';
import {prepareCapture} from './capture-ready.mjs';
import {capturePageTiles} from './capture-tiles.mjs';
import {previewMedia,previewMediaHosts} from './capture-media.mjs';

const cdns = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'images.unsplash.com'];
export async function captureWebsite(env, target, session, media) {
  const url = new URL(referenceUrl(target)), hosts = new Set([url.hostname,
    url.hostname.startsWith('www.') ? url.hostname.slice(4) : 'www.' + url.hostname, ...cdns, ...previewMediaHosts]);
  await verifyHost(url.hostname);
  let browser, deadline, stage='launch';
  try {
    browser = await launch(env.BROWSER, {guardrails: {allowedDomains: [...hosts]}});
    deadline = setTimeout(() => { void browser.close().catch(() => {}); }, 50000);
    const context = await browser.newContext({viewport: {width:1440,height:900}, deviceScaleFactor:1,
      serviceWorkers:'block', acceptDownloads:false, reducedMotion:'reduce'});
    const checked = new Map([[url.hostname, Promise.resolve()]]); let mediaRequests=0;
    await context.route('**/*', async route => {
      try {
        const request = route.request(), u = new URL(referenceUrl(request.url()));
        if (!hosts.has(u.hostname) || request.method() !== 'GET' || request.resourceType() === 'websocket') return route.abort();
        if (!checked.has(u.hostname)) checked.set(u.hostname, verifyHost(u.hostname));
        await checked.get(u.hostname);
        if(request.resourceType()==='media') {
          if(!previewMediaHosts.includes(u.hostname)||++mediaRequests>4)return route.abort();
          return route.fulfill(await previewMedia(u.href,request.headers().range));
        }
        return route.continue();
      } catch { return route.abort(); }
    });
    const page = await context.newPage(); await page.bringToFront(); page.setDefaultTimeout(2500);
    page.on('popup', p => void p.close());
    stage='navigation';
    const response = await page.goto(url.href, {waitUntil:'domcontentloaded',timeout:18000});
    if (!response || response.status() >= 400) throw new Error('Page unavailable');
    stage='readiness';
    await prepareCapture(page);
    const observed = await page.evaluate(() => {
      const height = Math.min(16000, Math.max(900, document.documentElement.scrollHeight));
      const nodes = [...document.querySelectorAll('header,main>article,section,footer')]
        .filter(n => !n.parentElement?.closest('section'))
        .filter(n => {const r=n.getBoundingClientRect();return r.height>0&&(r.height>150||n.matches('header,footer'));});
      const sectionCandidates = nodes.map(n => {const rect=n.getBoundingClientRect();return {name:(n.querySelector('h1,h2')?.textContent||n.tagName).trim().slice(0,60),
        y:Math.max(0,Math.round(rect.top+scrollY)),height:Math.round(rect.height)};}).filter(n=>n.y<height);
      const sections = sectionCandidates.length>8 ? [...sectionCandidates.slice(0,7),sectionCandidates.at(-1)] : sectionCandidates;
      const rgbHex = value => {const m=value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);return m?'#'+m.slice(1,4).map(n=>(+n).toString(16).padStart(2,'0')).join(''):null;};
      const typeNodes=[document.querySelector('h1'),document.querySelector('h2'),document.querySelector('p')].filter(Boolean);
      return {title:document.title.slice(0,150)||location.hostname,description:(document.querySelector('meta[name=description]')?.content||'').slice(0,2000),height,
        truncated:document.documentElement.scrollHeight>16000,sections,
        typography:typeNodes.map(n=>{const s=getComputedStyle(n);return {role:n.tagName==='H1'?'제목':n.tagName==='H2'?'소제목':'본문',family:s.fontFamily,size:s.fontSize,weight:s.fontWeight,lineHeight:s.lineHeight};}),
        colors:[{hex:rgbHex(getComputedStyle(document.body).backgroundColor),role:'본문 배경'},...typeNodes.slice(0,2).map(n=>({hex:rgbHex(getComputedStyle(n).color),role:'글자'}))].filter(c=>c.hex)};
    });
    const sections = observed.sections.length ? observed.sections : [{name:'Hero',y:0,height:900}];
    stage='screenshot';
    const tiles = await capturePageTiles(page,{height:observed.height});
    // Screenshot pixels are assembled on a fresh blank page, never in target JS.
    stage='conversion';
    const converter = await context.newPage();
    const encoded = await converter.evaluate(async ({tiles, height, sections}) => {
      const image = document.createElement('canvas'); image.width=1440; image.height=height;
      const context=image.getContext('2d');
      for (const tile of tiles) {
        const fragment=new Image();fragment.src='data:image/jpeg;base64,'+tile.base64;
        await fragment.decode();context.drawImage(fragment,0,tile.y);
      }
      const encode = (y,h,width) => {const canvas=document.createElement('canvas');canvas.width=width;canvas.height=Math.max(1,Math.round(h*width/1440));
        canvas.getContext('2d').drawImage(image,0,y,1440,h,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/webp',0.78).split(',')[1];};
      return {full:encode(0,height,1440),thumb:encode(0,Math.min(900,height),960),
        sections:sections.map(s=>encode(s.y,Math.max(1,Math.min(s.height,height-s.y)),960))};
    }, {tiles:tiles.map(tile=>({y:tile.y,base64:Buffer.from(tile.body).toString('base64')})),height:observed.height,sections});
    await browser.close(); browser = null; clearTimeout(deadline);
    const persist = value => media.persist(Uint8Array.from(atob(value),c=>c.charCodeAt(0)), session);
    stage='storage';
    const full=await persist(encoded.full), thumb=await persist(encoded.thumb);
    const savedSections=[];
    for(let i=0;i<sections.length;i++) {
      const s=sections[i], saved=await persist(encoded.sections[i]);
      savedSections.push({...s,id:crypto.randomUUID(),x:0,width:1440,height:Math.min(s.height,observed.height-s.y),image:saved.image});
    }
    return {...observed,width:full.width,height:full.height,image:full.image,thumb:thumb.image,sections:savedSections,motions:[],
      status:'ready',error:null,captureVersion:crypto.randomUUID(),analysisSource:'브라우저 CSS·캡처'};
  } catch(error) { error.captureStage=stage; throw error; } finally { clearTimeout(deadline); if(browser)await browser.close().catch(()=>{}); }
}




