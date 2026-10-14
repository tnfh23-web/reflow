import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('PWA navigations use the right public HTML and normalize static-host redirects',async()=>{
  const handlers={};let matched;
  const source=(await readFile(new URL('../public/sw.js',import.meta.url),'utf8')).replace('/*__REFLOW_PRECACHE__*/[]',JSON.stringify(['/index.html','/about.html','/guide.html']));
  vm.runInNewContext(source,{URL,Response,Headers,Set,self:{location:{origin:'https://reflow.tnfh23.workers.dev'},addEventListener:(name,fn)=>handlers[name]=fn},caches:{open:async()=>({match:async path=>{matched=path;return {body:path,status:200,statusText:'OK',headers:new Headers({'Content-Type':'text/html'}),redirected:true};}})},fetch:()=>{throw Error('Unexpected network request');}});
  for(const [path,expected] of [['/','/index.html'],['/about','/about.html'],['/about.html','/about.html'],['/guide','/guide.html'],['/guide.html','/guide.html']]){
    let pending;handlers.fetch({request:{url:'https://reflow.tnfh23.workers.dev'+path,mode:'navigate',method:'GET'},respondWith:response=>pending=response});
    const response=await pending;assert.equal(matched,expected);assert.equal(response.redirected,false);assert.equal(await response.text(),expected);
  }
  let intercepted=false;handlers.fetch({request:{url:'https://reflow.tnfh23.workers.dev/api/bootstrap',mode:'cors',method:'GET'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
});
