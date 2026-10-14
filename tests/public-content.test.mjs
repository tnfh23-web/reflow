import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pageMetadata,guideSteps,useCases,serviceOrigin} from '../src/service-content.js';

test('public HTML exposes the same complete explanations before JavaScript runs',async()=>{
  for(const page of ['about','guide']){
    const html=await readFile(new URL(`../dist/${page}.html`,import.meta.url),'utf8');
    assert.ok(!html.includes('<!--REFLOW_PUBLIC_'));
    assert.ok(html.includes(`<title>${pageMetadata[page].title}</title>`));
    assert.ok(html.includes(`rel="canonical" href="${serviceOrigin}/${page}"`));
    const samples=JSON.parse(html.match(/id="reflow-public-data" type="application\/json">(.*?)<\/script>/s)[1]);
    assert.ok(samples.length>0&&samples.every(sample=>sample.sample===true));
    if(page==='guide')for(const step of guideSteps){assert.ok(html.includes(step.instructions));assert.ok(html.includes(step.example));}
    else for(const example of useCases)assert.ok(html.includes(example.text));
  }
});
