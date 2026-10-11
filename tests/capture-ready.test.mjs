import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {waitForCaptureReady,prepareCapture} from '../cloud/capture-ready.mjs';

test('capture waits for a splash without loading text, including its exit animation', async () => {
 const browser=await chromium.launch({headless:true});
 try {const page=await browser.newPage();
  await page.setContent(`<div id="splash-dimd" style="position:fixed;inset:0;background:white"><p>We didn't forget the Flash</p></div><main style="opacity:0"><h1>Ready content</h1></main><script>setTimeout(()=>{document.querySelector('#splash-dimd').remove();document.querySelector('main').style.opacity=1},2200)</script>`);
  const started=Date.now();await waitForCaptureReady(page,{timeout:5000,minimum:100});
  assert.ok(Date.now()-started>=2200);assert.equal(await page.locator('#splash-dimd').count(),0);
 } finally {await browser.close();}
});
test('stuck loading and hidden content fail instead of producing a successful capture',async()=>{
 const browser=await chromium.launch({headless:true});
 try {const page=await browser.newPage();
  await page.setContent('<div class="loading-screen" style="position:fixed;inset:0">Loading...</div>');
  await assert.rejects(()=>waitForCaptureReady(page,{timeout:700,minimum:100}),/로딩이 끝나지/);
  await page.setContent('<main style="opacity:0"><h1>Still hidden</h1></main>');
  await assert.rejects(()=>waitForCaptureReady(page,{timeout:700,minimum:100}),/로딩이 끝나지/);
 } finally {await browser.close();}
});
test('small progress controls do not block an otherwise ready page; scroll reveals run',async()=>{
 const browser=await chromium.launch({headless:true});
 try {const page=await browser.newPage();
  await page.setContent('<main><h1>Content ready</h1><p>'+'Description '.repeat(40)+'</p><div role="progressbar" style="width:20px;height:20px"></div><section style="height:1800px"></section><div id="lazy">Waiting</div></main><script>addEventListener("scroll",()=>{if(scrollY>500)document.querySelector("#lazy").textContent="Revealed content"})</script>');
  await prepareCapture(page);assert.equal(await page.locator('#lazy').textContent(),'Revealed content');
  assert.equal(await page.evaluate(()=>scrollY),0);
 } finally {await browser.close();}
});
test('a ready page with an animated counter does not wait for its text to stop changing',async()=>{
 const browser=await chromium.launch({headless:true});
 try {const page=await browser.newPage();
  await page.setContent('<main><h1>Ready site</h1><p id="counter">0</p></main><script>let i=0;setInterval(()=>document.querySelector("#counter").textContent=String(++i),80)</script>');
  await waitForCaptureReady(page,{timeout:2500,minimum:100});
  assert.ok(Number(await page.locator('#counter').textContent())>0);
 }finally{await browser.close();}
});
