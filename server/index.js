import express from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { db,uid,now,mediaDir,refs,getRef,saveRef,projects,getProject,saveProject } from './store.js';
import { capture,safeUrl,imageFile,imageAnalysis,closeBrowser } from './capture.js';
import { aiReady,generateJson } from './ai.js';

const app=express();
const port=Number(process.env.PORT||4183);
const appOrigin=process.env.APP_ORIGIN||'http://127.0.0.1:4182';
app.disable('x-powered-by');
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin'); if(req.path.startsWith('/api')) res.setHeader('Cache-Control','no-store'); next();});
app.use(express.json({limit:'1mb'})); app.use(cookieParser());
app.use('/api',(req,res,next)=>{
  if(!['GET','HEAD','OPTIONS'].includes(req.method)) {
    const origin=req.headers.origin;
    const own=`${req.protocol}://${req.get('host')}`;
    if(!origin||![appOrigin,own].includes(origin)) return res.status(403).json({error:'이 앱에서 다시 요청해 주세요.'});
  }
  const token=req.cookies.reflow_session;
  if(token) { const session=db.prepare('SELECT users.id,users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token=? AND expires>?').get(crypto.createHash('sha256').update(token).digest('hex'),Date.now()); req.user=session||null; }
  next();
});
const auth=(req,res,next)=>req.user?next():res.status(401).json({error:'로그인 후 사용할 수 있어요.'});
function requireRef(req) { const r=getRef(req.params.id,req.user?.id); if(!r) throw Object.assign(new Error('레퍼런스를 찾을 수 없어요.'),{status:404}); return r; }
function ownRef(req) { const r=requireRef(req); if(r.sample) throw Object.assign(new Error('예시를 내 라이브러리로 복사한 뒤 수정해 주세요.'),{status:403}); return r; }
function requireProject(req) { const p=getProject(req.params.id,req.user.id); if(!p) throw Object.assign(new Error('프로젝트를 찾을 수 없어요.'),{status:404}); return p; }
function text(value,max=3000) { return typeof value==='string'?value.slice(0,max):''; }
function sessionCookie(req,res,id) { const token=crypto.randomBytes(32).toString('base64url'); db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(crypto.createHash('sha256').update(token).digest('hex'),id,Date.now()+14*86400000); res.cookie('reflow_session',token,{httpOnly:true,sameSite:'strict',secure:req.secure,maxAge:14*86400000,path:'/'}); }
const loginAttempts=new Map();
app.post('/api/auth/:action',async(req,res)=>{
  const action=req.params.action;
  if(action==='logout') { const t=req.cookies.reflow_session; if(t)db.prepare('DELETE FROM sessions WHERE token=?').run(crypto.createHash('sha256').update(t).digest('hex')); res.clearCookie('reflow_session'); return res.json({ok:true}); }
  if(!['login','register'].includes(action)) return res.status(404).json({error:'지원하지 않는 로그인 방식이에요.'});
  const email=text(req.body.email,254).trim().toLowerCase(),password=text(req.body.password,256);
  if(!/^\S+@\S+\.\S+$/.test(email)||password.length<8) return res.status(400).json({error:'이메일과 8자 이상의 비밀번호를 입력해 주세요.'});
  const attempts=loginAttempts.get(req.ip)||[]; const recent=attempts.filter(t=>Date.now()-t<600000); loginAttempts.set(req.ip,[...recent,Date.now()]);
  if(recent.length>=20) return res.status(429).json({error:'시도가 많아요. 10분 뒤 다시 시도해 주세요.'});
  let user=db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if(action==='register') {
    if(user) return res.status(409).json({error:'이미 등록된 이메일이에요. 로그인해 주세요.'});
    const salt=crypto.randomBytes(16).toString('hex'); const key=await new Promise((resolve,reject)=>crypto.scrypt(password,salt,64,(e,k)=>e?reject(e):resolve(k.toString('hex'))));
    user={id:uid(),email,password:`${salt}:${key}`,created:now()}; db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(user.id,email,user.password,user.created);
  } else {
    if(!user) return res.status(401).json({error:'이메일 또는 비밀번호를 확인해 주세요.'});
    const [salt,hash]=user.password.split(':'); const actual=await new Promise((resolve,reject)=>crypto.scrypt(password,salt,64,(e,k)=>e?reject(e):resolve(k)));
    if(!crypto.timingSafeEqual(actual,Buffer.from(hash,'hex'))) return res.status(401).json({error:'이메일 또는 비밀번호를 확인해 주세요.'});
  }
  sessionCookie(req,res,user.id); res.json({user:{id:user.id,email}});
});
app.get('/api/bootstrap',(req,res)=>res.json({user:req.user||null,references:req.user?refs(req.user.id):[],samples:refs(null),projects:req.user?projects(req.user.id):[],capabilities:{capture:true,ai:aiReady(),google:false,cloud:false,storage:'이 PC의 SQLite 개발 서버'}}));
app.get('/api/media/:name',(req,res)=>{
  if(!/^[a-zA-Z0-9-]+\.webp$/.test(req.params.name)) return res.sendStatus(404);
  const m=db.prepare('SELECT owner FROM media WHERE name=?').get(req.params.name);
  if(!m||(m.owner&&m.owner!==req.user?.id)) return res.sendStatus(404);
  res.setHeader('Cache-Control',m.owner?'private, max-age=86400':'public, max-age=86400'); res.sendFile(path.join(mediaDir,req.params.name));
});
app.get('/api/jobs',auth,(req,res)=>res.json(db.prepare('SELECT id,ref_id,state FROM jobs WHERE owner=?').all(req.user.id)));
app.get('/api/references/:id',(req,res)=>res.json(requireRef(req)));
app.post('/api/references/:id/view',(req,res)=>{const r=requireRef(req);if(!r.sample&&req.user){r.views=(r.views||0)+1;saveRef(r,req.user.id);}res.json({ok:true});});
app.post('/api/samples/:id/copy',auth,(req,res)=>{
  const sample=getRef(req.params.id,null); if(!sample?.sample)return res.status(404).json({error:'예시를 찾을 수 없어요.'});
  const existing=refs(req.user.id).find(r=>r.sampleSource===sample.id||r.url===sample.url); if(existing)return res.json(existing);
  const copy={...structuredClone(sample),id:uid(),sample:false,sampleSource:sample.id,date:now(),views:0,note:''}; saveRef(copy,req.user.id);res.json(copy);
});

let working=false;
async function processJobs() {
  if(working)return; working=true;
  try {
    let job;
    while((job=db.prepare("SELECT * FROM jobs WHERE state='queued' ORDER BY rowid LIMIT 1").get())) {
      db.prepare("UPDATE jobs SET state='working' WHERE id=?").run(job.id);
      const ref=getRef(job.ref_id,job.owner); if(!ref) { db.prepare("UPDATE jobs SET state='cancelled' WHERE id=?").run(job.id); continue; }
      try {
        let result,lastError;
        for(let attempt=0;attempt<2;attempt++) { try{ result=await capture(ref.url,job.owner); break;}catch(e){lastError=e;} }
        if(!result)throw lastError;
        const latest=getRef(ref.id,job.owner); if(latest)saveRef({...latest,...result,id:ref.id,note:latest.note,oldVersions:[...(latest.oldVersions||[]),...(latest.image?[{image:latest.image,version:latest.captureVersion,date:latest.date}]:[])].slice(-5)},job.owner);
        db.prepare("UPDATE jobs SET state='complete' WHERE id=?").run(job.id);
      } catch(e) {
        const latest=getRef(ref.id,job.owner);if(latest)saveRef({...latest,status:'failed',error:'캡처하지 못했어요. 접근 차단·시간 초과 또는 브라우저 설정을 확인하고 재시도하거나 이미지를 업로드해 주세요.'},job.owner);
        db.prepare("UPDATE jobs SET state='failed' WHERE id=?").run(job.id);
        console.error('Capture failed:',e.message.slice(0,180));
      }
    }
  } finally {working=false;}
}
function enqueue(ref,owner) { const active=db.prepare("SELECT id FROM jobs WHERE ref_id=? AND state IN ('queued','working')").get(ref.id);if(active)return;saveRef({...ref,status:'queued',error:null},owner);db.prepare('INSERT INTO jobs VALUES(?,?,?,?)').run(uid(),ref.id,owner,'queued');void processJobs(); }
app.post('/api/references',auth,async(req,res)=>{
  const url=await safeUrl(text(req.body.url,2000),true);
  const existing=refs(req.user.id).find(r=>r.url===url); if(existing)return res.status(409).json({error:'이미 저장한 웹사이트예요.',existingId:existing.id});
  if(refs(req.user.id).length>=150)return res.status(429).json({error:'개발 환경 저장 한도 150개에 도달했어요.'});
  const ref={id:uid(),title:new URL(url).hostname,url,date:now(),views:0,note:'',tags:{style:[],layout:[],interaction:[]},sections:[],colors:[],typography:[],motions:[],status:'queued',sample:false};
  saveRef(ref,req.user.id);enqueue(ref,req.user.id);res.status(201).json(ref);
});
app.post('/api/references/:id/recapture',auth,(req,res)=>{const r=ownRef(req);enqueue(r,req.user.id);res.json({...r,status:'queued'});});
app.patch('/api/references/:id',auth,(req,res)=>{
  const r=ownRef(req);if(req.body.note!==undefined)r.note=text(req.body.note,12000); if(req.body.title!==undefined)r.title=text(req.body.title,150).trim()||r.title;
  if(req.body.tags)r.tags=Object.fromEntries(['style','layout','interaction'].map(k=>[k,Array.isArray(req.body.tags[k])?req.body.tags[k].filter(s=>typeof s==='string').map(s=>s.slice(0,50)).slice(0,12):r.tags[k]||[]]));
  if(req.body.description!==undefined){r.description=text(req.body.description,2000);r.userEdited=true;}
  if(Array.isArray(req.body.motions)){r.motions=r.motions.map(m=>{const changed=req.body.motions.find(v=>v.id===m.id);return changed?{...m,behavior:text(changed.behavior,1200),userEdited:true}:m;});}
  if(Array.isArray(req.body.sections))r.sections=r.sections.map(s=>{const update=req.body.sections.find(v=>v.id===s.id);return update?{...s,name:text(update.name,80)||s.name}:s;});
  saveRef(r,req.user.id);res.json(r);
});
app.delete('/api/references/:id',auth,(req,res)=>{ownRef(req);db.prepare('DELETE FROM refs WHERE id=? AND owner=?').run(req.params.id,req.user.id);res.json({ok:true});});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:12*1024*1024},fileFilter:(req,file,cb)=>cb(null,['image/png','image/jpeg','image/webp'].includes(file.mimetype))});
app.post('/api/references/:id/upload',auth,upload.single('image'),async(req,res)=>{
  const r=ownRef(req);if(!req.file)return res.status(400).json({error:'12MB 이하의 PNG, JPEG, WebP 이미지를 선택해 주세요.'});
  const normalized=await sharp(req.file.buffer,{limitInputPixels:40e6}).rotate().resize({width:1440,height:16000,fit:'inside',withoutEnlargement:true}).webp().toBuffer();const meta=await sharp(normalized).metadata();
  const image=await imageFile(normalized,req.user.id);const thumb=await imageFile(await sharp(normalized).extract({left:0,top:0,width:meta.width,height:Math.min(meta.height,Math.round(meta.width*.625))}).resize({width:960,withoutEnlargement:true}).toBuffer(),req.user.id,'thumb');
  const updated={...r,image,thumb,width:meta.width,height:meta.height,status:'ready',error:null,captureVersion:uid(),typography:[],motions:[],sections:[{id:uid(),name:'업로드 이미지',x:0,y:0,width:meta.width,height:meta.height,image}],colors:await imageAnalysis(normalized),analysisSource:'직접 업로드 · 정적 이미지'};saveRef(updated,req.user.id);res.json(updated);
});
app.post('/api/references/:id/sections',auth,async(req,res)=>{
  const r=ownRef(req);if(!r.image)throw new Error('이미지가 준비된 뒤 구간을 선택해 주세요.');
  const bounds={left:Math.floor(Number(req.body.x)||0),top:Math.floor(Number(req.body.y)||0),width:Math.floor(Number(req.body.width)),height:Math.floor(Number(req.body.height))};
  if(bounds.left<0||bounds.top<0||bounds.width<20||bounds.height<20||bounds.left+bounds.width>r.width||bounds.top+bounds.height>r.height)throw new Error('이미지 안에서 충분한 크기의 구간을 선택해 주세요.');
  const file=path.basename(r.image); const image=await imageFile(await sharp(path.join(mediaDir,file)).extract(bounds).resize({width:960,withoutEnlargement:true}).toBuffer(),req.user.id,'section');
  r.sections.push({id:uid(),name:text(req.body.name,80)||'직접 선택한 구간',x:bounds.left,y:bounds.top,width:bounds.width,height:bounds.height,image});saveRef(r,req.user.id);res.json(r);
});
app.delete('/api/references/:id/sections/:sectionId',auth,(req,res)=>{const r=ownRef(req);r.sections=r.sections.filter(s=>s.id!==req.params.sectionId);saveRef(r,req.user.id);res.json(r);});
app.post('/api/references/:id/analyze',auth,async(req,res)=>{
  const r=ownRef(req);if(!r.thumb)throw new Error('이미지가 준비된 뒤 분석해 주세요.');
  const img=await fs.readFile(path.join(mediaDir,path.basename(r.thumb)));
  const result=await generateJson(`Analyze the screenshot visually for Korean web makers. Return JSON {description: Korean short factual visual description,tags:{style: English tag array,layout: English tag array,interaction: []}}. Never infer CSS font names, JS libraries or unseen motion from image. Observed CSS and motion: ${JSON.stringify({typography:r.typography,motions:r.motions.map(m=>({kind:m.kind,behavior:m.behavior}))})}`,[img.toString('base64')]);
  r.description=text(result.description,2000);r.tags={style:(result.tags?.style||[]).slice(0,10),layout:(result.tags?.layout||[]).slice(0,10),interaction:r.motions.map(m=>m.kind)};r.aiAnalyzed=true;saveRef(r,req.user.id);res.json(r);
});
app.post('/api/search',async(req,res)=>{
  const q=text(req.body.query,300).toLowerCase().trim();const source=req.body.samples||!req.user?refs(null):refs(req.user.id);
  if(req.body.semantic&&aiReady()&&q) {
    const inventory=source.slice(0,100).map(r=>({id:r.id,title:r.title,description:r.description,note:r.note?.slice(0,1500),tags:r.tags,sections:r.sections.map(s=>({id:s.id,name:s.name}))}));
    const result=await generateJson(`Find visual website references relevant to this Korean natural-language request: ${q}. Return JSON {results:[{id:matching reference id,score:integer 1-100,reason:concise Korean explanation based on evidence}]}. Only include genuinely relevant references from inventory, order by relevance. Do not invent facts or ids. Inventory: ${JSON.stringify(inventory)}`);
    const results=(result.results||[]).filter(r=>source.some(s=>s.id===r.id)).map(r=>({id:r.id,score:Number(r.score)||1,reason:text(r.reason,300)}));return res.json({results,mode:'semantic'});
  }
  const words=q.split(/\s+/).filter(Boolean);const aliases={'건축':'architecture form stone','자연':'nature forest field','파란':'blue cobalt pulse','서비스':'dashboard flow desk','어두운':'dark frame silver','따뜻':'warm material clay','여백':'white minimal editorial','스크롤':'scroll'};
  const expanded=[...words,...Object.entries(aliases).filter(([k])=>q.includes(k)).flatMap(([,v])=>v.split(' '))];
  const results=source.map(r=>{const content=[r.title,r.description,r.note,...Object.values(r.tags).flat(),...r.sections.map(s=>s.name),...r.colors.map(c=>c.hex)].join(' ').toLowerCase(); const matches=expanded.filter(w=>content.includes(w));return {id:r.id,score:matches.length,reason:words.some(w=>r.note?.toLowerCase().includes(w))?'내 메모에서 찾았어요':matches.length?`저장된 내용과 일치: ${matches.slice(0,3).join(', ')}`:''};}).filter(r=>!q||r.score).sort((a,b)=>b.score-a.score);
  res.json({results,mode:'keyword'});
});
app.post('/api/projects',auth,(req,res)=>{
  const title=text(req.body.title,100).trim();if(!title)throw new Error('프로젝트 이름을 입력해 주세요.');
  const p={id:uid(),title,description:text(req.body.description,300),updated:now(),sections:['Hero','콘텐츠','인터랙션','Footer'].map(name=>({id:uid(),name,items:[]})),direction:null};saveProject(p,req.user.id);res.status(201).json(p);
});
app.patch('/api/projects/:id',auth,(req,res)=>{
  const p=requireProject(req);if(req.body.title!==undefined)p.title=text(req.body.title,100).trim()||p.title;if(req.body.description!==undefined)p.description=text(req.body.description,300);
  if(Array.isArray(req.body.sections)) {
    if(req.body.sections.length>30)throw new Error('프로젝트는 최대 30개 섹션으로 구성할 수 있어요.');
    const oldItems=new Map(p.sections.flatMap(s=>s.items).map(i=>[i.id,i]));
    p.sections=req.body.sections.map(s=>({id:p.sections.some(v=>v.id===s.id)?s.id:uid(),name:text(s.name,80)||'섹션',items:(s.items||[]).map(i=>oldItems.get(i.id)).filter(Boolean)}));
  }saveProject(p,req.user.id);res.json(p);
});
app.delete('/api/projects/:id',auth,(req,res)=>{requireProject(req);db.prepare('DELETE FROM projects WHERE id=? AND owner=?').run(req.params.id,req.user.id);res.json({ok:true});});
app.post('/api/projects/:id/items',auth,(req,res)=>{
  const p=requireProject(req);const r=getRef(req.body.refId,req.user.id);if(!r||r.sample)throw new Error('내 라이브러리에 저장한 자료를 선택해 주세요.');
  const s=p.sections.find(s=>s.id===req.body.sectionId);if(!s)throw new Error('담을 섹션을 선택해 주세요.');
  const selected=r.sections.find(v=>v.id===req.body.cropId);if(!r.image)throw new Error('캡처가 준비된 뒤 프로젝트에 담아 주세요.');
  s.items.push({id:uid(),sourceId:r.id,version:r.captureVersion,title:r.title,url:r.url,image:selected?.image||r.thumb,width:selected?.width||r.width,height:selected?.height||Math.min(r.height,900),cropName:selected?.name||'전체 사이트',cropId:selected?.id||null,tags:structuredClone(r.tags),colors:structuredClone(r.colors),typography:structuredClone(r.typography),motions:structuredClone(r.motions)});saveProject(p,req.user.id);res.json(p);
});
app.post('/api/projects/:id/items/:itemId/update',auth,(req,res)=>{
  const p=requireProject(req);const item=p.sections.flatMap(s=>s.items).find(i=>i.id===req.params.itemId);if(!item)throw new Error('자료를 찾을 수 없어요.');
  const r=getRef(item.sourceId,req.user.id);if(!r)throw new Error('원본이 라이브러리에서 삭제되어 기존 스냅샷을 유지합니다.');const crop=r.sections.find(s=>s.id===item.cropId)||r.sections.find(s=>s.name===item.cropName);
  Object.assign(item,{image:crop?.image||r.thumb,version:r.captureVersion,tags:r.tags,colors:r.colors,typography:r.typography,motions:r.motions});saveProject(p,req.user.id);res.json(p);
});
app.post('/api/projects/:id/direction',auth,async(req,res)=>{
  const p=requireProject(req);const items=p.sections.flatMap(s=>s.items.map(i=>({...i,section:s.name})));if(!items.length)throw new Error('프로젝트에 레퍼런스를 먼저 담아 주세요.');
  const source=items.map(({id,title,section,colors,typography,tags,motions})=>({id,title,section,colors,typography,tags,motions:motions.map(m=>({kind:m.kind,behavior:m.behavior}))}));
  const result=await generateJson(`You advise a Korean web designer. Project ${p.title}: ${p.description}. Based only on source evidence, return JSON {blocks:[{title:색상|타이포그래피|레이아웃|인터랙션,proposal:concrete Korean application suggestion,sourceIds:array of source item ids}]}. Include all four blocks. Do not invent fonts, motion or source evidence; say unknown where absent. Sources: ${JSON.stringify(source)}`);
  if(!Array.isArray(result.blocks))throw new Error('분석 형식이 올바르지 않아요.');
  p.direction={created:now(),blocks:result.blocks.slice(0,4).map(b=>({title:text(b.title,30),proposal:text(b.proposal,1600),sourceIds:(b.sourceIds||[]).filter(id=>items.some(i=>i.id===id))}))};saveProject(p,req.user.id);res.json(p);
});
app.post('/api/projects/:id/draft',auth,async(req,res)=>{
  const p=requireProject(req);if(p.sections.some(s=>s.items.length))throw new Error('자료가 없는 프로젝트에서만 섹션 초안을 바꿀 수 있어요.');const r=await generateJson(`Suggest 4-7 website section names for ${p.title}: ${p.description}. JSON {sections: array of short Korean/English section names}. No timelines or statuses.`);if(!Array.isArray(r.sections))throw new Error('섹션 초안을 읽지 못했어요.');p.sections=r.sections.slice(0,10).map(name=>({id:uid(),name:text(name,80),items:[]}));saveProject(p,req.user.id);res.json(p);
});
app.use(express.static('dist'));
app.use((err,req,res,next)=>{console.error('API:',err.message.slice(0,180));res.status(err.status||400).json({error:err.code==='LIMIT_FILE_SIZE'?'이미지는 최대 12MB까지 올릴 수 있어요.':err.message||'요청을 처리하지 못했어요.'});});
db.prepare("UPDATE jobs SET state='queued' WHERE state='working'").run();
const server=app.listen(port,'127.0.0.1',()=>{console.log(`REFLOW API http://127.0.0.1:${port}`);void processJobs();});
process.on('SIGINT',()=>{server.close();void closeBrowser().finally(()=>process.exit(0));});
