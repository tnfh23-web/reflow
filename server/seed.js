import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { capture,closeBrowser } from './capture.js';
import { refs,saveRef,now } from './store.js';
for(const key of ['architecture','forest','sculpture','ceramics']) await sharp(`public/media/${key}.png`).resize({width:1600,height:1600,fit:'inside'}).webp({quality:86}).toFile(`public/media/${key}.webp`);
const samples=[['form-archive','FORM ARCHIVE',['Editorial','Minimal'],['Split Hero'],'건축과 여백을 중심으로 구성한 밝은 Architecture 예시'],['field-notes','FIELD NOTES',['Editorial','Nature'],['Full Bleed'],'숲과 자연의 사진을 중심으로 한 Forest 이야기'],['pulse-studio','PULSE STUDIO',['Bold','Blue'],['Oversized Type'],'파란 Cobalt 배경과 대형 글자가 있는 크리에이티브 스튜디오'],['flow-desk','FLOW DESK',['Product','Minimal'],['Dashboard'],'자료를 찾고 정리하는 실제 서비스 형태의 예시 화면'],['frame-atelier','FRAME ATELIER',['Dark','Minimal'],['Split Hero'],'어두운 Dark 배경에 은색 Silver 조각을 담은 포트폴리오'],['material-index','MATERIAL INDEX',['Warm','Editorial'],['Full Bleed'],'따뜻한 Warm 테라코타 Clay 소재를 다루는 매거진'],['along','ALONG',['Editorial'],['Split Hero'],'자연과 사람을 연결하는 Architecture 공간'],['studio-kin','STUDIO KIN',['Minimal'],['Split Hero'],'여백과 건축을 중심으로 한 White Minimal 디자인']];
for(const [slug,title,style,layout,description] of samples) {
  await fs.writeFile(path.join('public/samples',slug+'.html'),`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${description}"><title>${title}</title><link rel="stylesheet" href="/samples/sample.css"></head><body><script src="/samples/sample.js"></script></body></html>`);
}
try {
  for(const [slug,title,style,layout,description] of samples) {
    if(!process.argv.includes('--refresh')&&refs(null).some(r=>r.id==='sample-'+slug))continue;
    const url=`http://127.0.0.1:4182/samples/${slug}.html`;const result=await capture(url,null);
    saveRef({...result,id:'sample-'+slug,title,url,sample:true,date:now(),views:0,note:'',description,tags:{style,layout,interaction:result.motions.map(m=>m.kind)}},null);
    console.log('Prepared sample:',title);
  }
}finally{await closeBrowser();}
