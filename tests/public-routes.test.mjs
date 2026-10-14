import test from 'node:test';
import assert from 'node:assert/strict';
import {readRoute,routeHref} from '../src/routes.js';
const origin='https://reflow.tnfh23.workers.dev';
test('public introduction and guide keep their screen after direct navigation',()=>{
  for(const path of ['/about','/about.html','/guide','/guide.html'])assert.equal(readRoute(new URL(origin+path)).page,path.includes('about')?'about':'guide');
});
test('shared legacy links and guide step links still open the intended screen',()=>{
  assert.equal(readRoute(new URL(origin+'/#about')).page,'about');
  assert.deepEqual(readRoute(new URL(origin+'/#guide/3')),{page:'guide',id:'3'});
  assert.deepEqual(readRoute(new URL(origin+'/guide#guide/5')),{page:'guide',id:'5'});
  assert.equal(readRoute(new URL(origin+'/guide#main-content')).page,'guide');
});
test('leaving a public page creates a root app link for saved references',()=>{
  assert.equal(routeHref('about'),'/about');assert.equal(routeHref('guide'),'/guide');
  assert.equal(routeHref('reference','saved-id'),'/#reference/saved-id');
  assert.deepEqual(readRoute(new URL(origin+routeHref('reference','saved-id'))),{page:'reference',id:'saved-id'});
});
