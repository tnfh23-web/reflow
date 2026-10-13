import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {capturePageTiles} from '../cloud/capture-tiles.mjs';

test('captures reversible scroll reveals in their visible state', async () => {
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:800,height:600}});
    await page.setContent(`<style>
      body{margin:0} section{height:600px;opacity:0;transition:opacity .12s}
      #first{background:#e33} #second{background:#3c3} #third{background:#33e}
      nav{position:fixed;top:0;left:0;width:100px;height:40px;background:#111}
    </style><nav></nav><section id="first"></section><section id="second"></section>
      <section id="third"></section><script>
      const sections=[...document.querySelectorAll('section')];
      function update(){for(const node of sections){const r=node.getBoundingClientRect();
        node.style.opacity=r.top<innerHeight&&r.bottom>0?'1':'0'}}
      addEventListener('scroll',update);update();
    </script>`);
    const tiles=await capturePageTiles(page,{height:1800,width:800,viewportHeight:600});
    const buffer=await sharp({create:{width:800,height:1800,channels:4,background:'#fff'}})
      .composite(tiles.map(tile=>({input:tile.body,left:0,top:tile.y}))).png().toBuffer();
    async function pixel(x,y){const {data}=await sharp(buffer).extract({left:x,top:y,width:1,height:1})
      .removeAlpha().raw().toBuffer({resolveWithObject:true});return [...data];}
    const red=await pixel(400,300),green=await pixel(400,900),blue=await pixel(400,1500);
    assert.ok(red[0]>red[1]*2 && red[0]>red[2]*2);
    assert.ok(green[1]>green[0]*2 && green[1]>green[2]*2);
    assert.ok(blue[2]>blue[0]*2 && blue[2]>blue[1]*2);
    const repeatedNav=await pixel(30,470);
    assert.ok(repeatedNav[0]>repeatedNav[1]*2,'fixed navigation is not repeated');
  } finally {await browser.close();}
});
