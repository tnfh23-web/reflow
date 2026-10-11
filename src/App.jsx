import {useCallback,useEffect,useRef,useState} from 'react';
import {api} from './api';
import {Brand,Icon,Button,Modal,Empty} from './UI';
import Library from './Library';
import Detail from './Detail';
import Compare from './Compare';
import Guide from './Guide';
import InstallDialog from './Install';
import Intro from './Intro';
import {useAutoHideHeader} from './use-auto-hide-header';
import {usePwa} from './pwa';
import {useAppSmoothScroll,smoothScrollTo} from './smooth-scroll';
import ProjectBoard,{ProjectList} from './Projects';
import {AuthDialog,SaveDialog,CreateProjectDialog,AddProjectDialog,PreviewDialog,SettingsDialog} from './Dialogs';
const readRoute=()=>{const [page,id]=location.hash.replace(/^#\/?/,'').split('/');return {page:page||'library',id};};
export default function App(){
  useAppSmoothScroll();
  const pwa=usePwa();
  const [online,setOnline]=useState(navigator.onLine);
  const [data,setData]=useState({user:null,references:[],samples:[],projects:[],capabilities:{}}),[ready,setReady]=useState(false),[failure,setFailure]=useState(''),[route,setRoute]=useState(readRoute),[modal,setModal]=useState(null),[query,setQuery]=useState(''),[search,setSearch]=useState({results:[],loading:false}),[mode,setMode]=useState('samples'),[compareIds,setCompareIds]=useState([]),[theme,setTheme]=useState(()=>localStorage.getItem('reflow-theme')||'light'),[toasts,setToasts]=useState([]);
  const topbar=useRef(null);
  useAutoHideHeader(topbar,route.page);
  const pending=useRef(null),searchInput=useRef(null),scrollPositions=useRef(new Map()),routeRef=useRef(route),seenJobs=useRef(new Map());
  const toast=useCallback(message=>{const id=crypto.randomUUID();setToasts(t=>[...t.slice(-2),{id,message}]);setTimeout(()=>setToasts(t=>t.filter(v=>v.id!==id)),5000);},[]);
  const refresh=useCallback(async()=>{const next=await api('/bootstrap');setData(next);setReady(true);setFailure('');return next;},[]);
  useEffect(()=>{refresh().then(async next=>{
    setMode(next.user&&next.references.length?'mine':'samples');
    const error=new URL(location.href).searchParams.get('auth_error');
    if(error){toast('Google 로그인을 완료하지 못했어요. 다시 시도해 주세요.');history.replaceState(null,'',location.pathname+location.hash);}
    const saved=sessionStorage.getItem('reflow-auth-return');
    if(saved&&next.user){
      sessionStorage.removeItem('reflow-auth-return');
      try{
        const info=JSON.parse(saved);
        if(/^#(?:library|reference|project|projects|about|guide)(?:\/[\w,-]+)?$/.test(info.hash)){
          history.replaceState(null,'',location.pathname+info.hash);const restored=readRoute();routeRef.current=restored;setRoute(restored);
        }
        if(['save','project'].includes(info.intent))setModal({type:info.intent});
        else if(info.intent?.type==='copy'){
          const copied=await api(`/samples/${info.intent.id}/copy`,{method:'POST'});await refresh();setMode('mine');location.hash='reference/'+copied.id;toast('내 라이브러리에 복사했어요.');
        }else if(info.intent?.type==='add'){
          const reference=[...next.references,...next.samples].find(r=>r.id===info.intent.referenceId);
          if(reference)setModal({type:'add',data:{...info.intent,reference}});
        }
      }catch{toast('로그인됐어요. 원래 작업을 다시 선택해 주세요.');}
    }
  }).catch(e=>{setFailure(e.message);setReady(true);});},[refresh,toast]);
  useEffect(()=>{
    let stopped=false,timer;
    const attempt=async remaining=>{if(stopped||!navigator.onLine)return;try{await refresh();}catch(e){if(stopped)return;setFailure(e.message);if(remaining>0)timer=setTimeout(()=>attempt(remaining-1),900);}};
    const reconnect=()=>{setOnline(true);clearTimeout(timer);timer=setTimeout(()=>attempt(2),150);},disconnect=()=>{clearTimeout(timer);setOnline(false);};
    window.addEventListener('online',reconnect);window.addEventListener('offline',disconnect);
    return()=>{stopped=true;clearTimeout(timer);window.removeEventListener('online',reconnect);window.removeEventListener('offline',disconnect);};
  },[refresh]);
  useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem('reflow-theme',theme);document.querySelector('meta[name=theme-color]')?.setAttribute('content',theme==='dark'?'#15171B':'#ffffff');},[theme]);
  useEffect(()=>{const change=()=>{const previous=routeRef.current;scrollPositions.current.set(previous.page+'/'+(previous.id||''),window.scrollY);const next=readRoute();routeRef.current=next;setRoute(next);setModal(null);requestAnimationFrame(()=>smoothScrollTo(window,next.page==='about'?0:scrollPositions.current.get(next.page+'/'+(next.id||''))||0,{immediate:true}));};window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);
  useEffect(()=>{const key=e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();searchInput.current?.focus();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
  useEffect(()=>{
    if(!data.user||!data.references.some(r=>['queued','working'].includes(r.status)))return;let stopped=false,running=false;
    const poll=async()=>{if(running||document.hidden)return;running=true;try{const jobs=await api('/jobs');let update=false;for(const job of jobs){const before=seenJobs.current.get(job.id);seenJobs.current.set(job.id,job.state);if(before&&before!==job.state){update=true;if(job.state==='complete')toast('웹페이지 캡처를 저장했어요.');if(job.state==='failed')toast('캡처하지 못했어요. 상세에서 재시도하거나 이미지를 올려 주세요.');}}if(jobs.length)update=true;if(update&&!stopped)await refresh();}catch{}finally{running=false;}};
    void poll();const timer=setInterval(poll,2000);return()=>{stopped=true;clearInterval(timer);};
  },[data.user?.id,data.references.map(r=>r.status).join(','),refresh,toast]);
  useEffect(()=>{
    const controller=new AbortController();if(!query.trim()){setSearch({results:[],loading:false});return;}
    setSearch(s=>({...s,loading:true}));const timer=setTimeout(()=>api('/search',{method:'POST',body:{query,samples:mode==='samples'},signal:controller.signal}).then(s=>setSearch({...s,loading:false})).catch(e=>{if(e.name!=='AbortError')setSearch({results:[],loading:false});}),220);
    return()=>{clearTimeout(timer);controller.abort();};
  },[query,mode,data.references,data.samples]);
  const navigate=(page,id)=>{location.hash=page+(id?'/'+id:'');};
  const requireLogin=(action,intent)=>{if(data.user){action();return;}pending.current=action;setModal({type:'auth',intent});};
  const updateRef=r=>setData(d=>({...d,references:d.references.some(v=>v.id===r.id)?d.references.map(v=>v.id===r.id?r:v):[r,...d.references]}));
  const updateProject=p=>setData(d=>({...d,projects:d.projects.some(v=>v.id===p.id)?d.projects.map(v=>v.id===p.id?p:v):[p,...d.projects]}));
  const openRef=id=>{navigate('reference',id);api(`/references/${id}/view`,{method:'POST'}).then(()=>setData(d=>({...d,references:d.references.map(r=>r.id===id?{...r,views:(r.views||0)+1}:r)}))).catch(()=>{});};
  const copy=async r=>{if(!data.user)return new Promise((resolve,reject)=>{pending.current=async()=>{try{const next=await api(`/samples/${r.id}/copy`,{method:'POST'});updateRef(next);resolve(next);}catch(e){reject(e);}};setModal({type:'auth'});});const next=await api(`/samples/${r.id}/copy`,{method:'POST'});updateRef(next);return next;};
  const copyOpen=r=>requireLogin(async()=>{try{const next=await api(`/samples/${r.id}/copy`,{method:'POST'});updateRef(next);setMode('mine');openRef(next.id);toast('내 라이브러리에 복사했어요.');}catch(e){toast(e.message);}},{type:'copy',id:r.id});
  const add=(reference,cropId=null,projectId=null,sectionId=null)=>requireLogin(()=>setModal({type:'add',data:{reference,cropId,projectId,sectionId}}),{type:'add',referenceId:reference.id,cropId,projectId,sectionId});
  const newSave=()=>{if(!online||failure){toast('서버에 연결한 뒤 레퍼런스를 저장해 주세요.');return;}requireLogin(()=>setModal({type:'save'}),'save');};
  const newProject=()=>{if(!online||failure){toast('서버에 연결한 뒤 프로젝트를 만들어 주세요.');return;}requireLogin(()=>setModal({type:'project'}),'project');};
  const source=mode==='samples'?data.samples:data.references;const all=[...data.references,...data.samples];const reference=all.find(r=>r.id===route.id);const project=data.projects.find(p=>p.id===route.id);const compare=data.references.concat(data.samples).filter(r=>(route.id?.split(',')||compareIds).includes(r.id));
  const preview=id=>{const index=source.findIndex(r=>r.id===id);setModal({type:'preview',index:Math.max(0,index),references:source});};
  const onAuth=async()=>{const next=await refresh();setModal(null);setMode(next.references.length?'mine':'samples');const action=pending.current;pending.current=null;if(action)action();};
  const deleteRef=()=>setModal({type:'confirm',title:'라이브러리에서 삭제할까요?',message:'프로젝트에 담은 이미지와 구간은 그대로 남습니다.',action:async()=>{await api(`/references/${reference.id}`,{method:'DELETE'});setData(d=>({...d,references:d.references.filter(r=>r.id!==reference.id)}));setModal(null);navigate('library');toast('라이브러리에서 삭제했어요.');}});
  const deleteProject=()=>setModal({type:'confirm',title:'프로젝트를 삭제할까요?',message:'프로젝트 보드가 삭제됩니다. 라이브러리 원본은 유지됩니다.',action:async()=>{await api(`/projects/${project.id}`,{method:'DELETE'});setData(d=>({...d,projects:d.projects.filter(p=>p.id!==project.id)}));setModal(null);navigate('projects');}});
  const navActive=route.page==='about'?'about':route.page==='guide'?'guide':route.page==='project'||route.page==='projects'?'projects':'library';
  const guide=<Guide samples={data.samples} stepId={route.id} onStep={id=>navigate('guide',String(id))} onLibrary={()=>{setMode('samples');setQuery('');navigate('library');}} onSave={newSave} onOpen={openRef} onCompare={ids=>navigate('compare',ids.join(','))} onProjects={()=>navigate('projects')} onInstall={()=>setModal({type:'install'})} pwa={pwa} connected={ready&&!failure&&online}/>;
  return <><a className="skip-link" href="#main-content" onClick={e=>{e.preventDefault();document.getElementById('main-content')?.focus();}}>본문으로 이동</a><aside className="sidebar"><button className="brand-button" onClick={()=>navigate('library')} aria-label="REFLOW 라이브러리"><Brand/></button><Button primary className="new-reference" onClick={newSave}>새 레퍼런스</Button><nav aria-label="주 메뉴"><button className={navActive==='library'?'active':''} onClick={()=>navigate('library')}><Icon name="library"/>라이브러리</button><button className={navActive==='projects'?'active':''} onClick={()=>navigate('projects')}><Icon name="project"/>프로젝트</button></nav><div className="sidebar-bottom"><button className={navActive==='about'?'active':''} onClick={()=>navigate('about')}><Icon name="info"/>리플로우 소개</button><button className={navActive==='guide'?'active':''} onClick={()=>navigate('guide')}><Icon name="help"/>사용법</button><button onClick={()=>setModal({type:'install'})}><Icon name="window"/>{pwa.installed?'앱 사용 안내':'앱 설치'}</button><button onClick={()=>setModal({type:'settings'})}><Icon name="settings"/>설정</button><button onClick={()=>setTheme(theme==='light'?'dark':'light')}><Icon name="moon"/>라이트 / 다크</button></div></aside>
  <div className="app-shell"><header ref={topbar} className="topbar"><div className="mobile-brand"><button className="brand-button" onClick={()=>navigate('library')}><Brand/></button><Button primary onClick={newSave}>새 레퍼런스</Button></div><div className="global-search"><Icon name="search"/><input ref={searchInput} aria-label="레퍼런스 검색" value={query} placeholder="어떤 레퍼런스를 찾고 있나요?" onChange={e=>setQuery(e.target.value)} onKeyDown={async e=>{if(e.key==='Enter'&&query.trim()&&data.capabilities.ai){setSearch(s=>({...s,loading:true}));try{setSearch({...await api('/search',{method:'POST',body:{query,samples:mode==='samples',semantic:true}}),loading:false});}catch(error){toast(error.message);setSearch(s=>({...s,loading:false}));}}}}/>{query?<button className="icon-button" aria-label="검색 지우기" onClick={()=>setQuery('')}><Icon name="close"/></button>:<kbd>⌘ K</kbd>}</div><button className="account-control" onClick={()=>setModal({type:data.user?'settings':'auth'})}>{data.user?data.user.email.split('@')[0]:'로그인'}</button></header>
  <main id="main-content" tabIndex="-1">{(failure||!online)&&<div className="connection-notice" role="status"><span>서버에 연결되지 않았어요. 사용법은 읽을 수 있지만 자료 저장·편집에는 연결이 필요해요.</span><Button onClick={()=>refresh().catch(e=>setFailure(e.message))}>다시 연결</Button></div>}{pwa.waiting&&<p className="app-update-notice" role="status">새 버전이 준비됐어요. 작업을 마치고 리플로우 창을 모두 닫았다가 다시 열면 적용됩니다.</p>}{route.page==='about'?<Intro capabilities={data.capabilities} samples={data.samples}/>:route.page==='guide'?guide:!ready?<div className="app-loading"><span className="capture-orbit"/><p>라이브러리를 불러오는 중입니다.</p></div>:(failure||!online)?<Empty title="서버에 연결하지 못했어요." action={<Button onClick={()=>refresh().catch(e=>setFailure(e.message))}>다시 연결</Button>}>{failure||'인터넷 연결을 확인해 주세요.'}<button className="text-button" onClick={()=>navigate('guide')}>사용법 열기</button></Empty>:route.page==='library'?<Library references={data.references} samples={data.samples} user={data.user} mode={mode} setMode={setMode} query={query} search={search} onOpen={openRef} onPreview={preview} onAdd={add} onSave={newSave} onCompare={ids=>{setCompareIds(ids);navigate('compare',ids.join(','));}}/>:route.page==='reference'&&reference?<Detail capabilities={data.capabilities} r={reference} onBack={()=>navigate('library')} onAdd={add} onUpdate={updateRef} onCopy={()=>copyOpen(reference)} onToast={toast} onDelete={deleteRef} ai={data.capabilities.ai}/>:route.page==='compare'&&compare.length===2?<Compare references={compare} onBack={()=>navigate('library')} onAdd={add}/>:route.page==='project'&&project?<ProjectBoard project={project} references={data.references} query={query} onBack={()=>navigate('projects')} onUpdate={updateProject} onAdd={add} onSnapshot={snapshot=>setModal({type:'snapshot',snapshot})} onToast={toast} onDelete={deleteProject} ai={data.capabilities.ai}/>:route.page==='projects'?<ProjectList projects={data.projects} user={data.user} onOpen={id=>navigate('project',id)} onCreate={newProject}/>:<Empty title="이 화면을 찾을 수 없어요." action={<Button onClick={()=>navigate('library')}>라이브러리로 돌아가기</Button>}>저장한 레퍼런스를 다시 확인해 주세요.</Empty>}</main></div>
  <nav className="mobile-nav" aria-label="모바일 메뉴"><button className={navActive==='library'?'active':''} onClick={()=>navigate('library')}><Icon name="library"/>라이브러리</button><button className={navActive==='projects'?'active':''} onClick={()=>navigate('projects')}><Icon name="project"/>프로젝트</button><button className={navActive==='guide'?'active':''} onClick={()=>navigate('guide')}><Icon name="help"/>사용법</button><button onClick={()=>setModal({type:'install'})}><Icon name="window"/>앱 설치</button><button onClick={()=>setModal({type:'settings'})}><Icon name="settings"/>설정</button></nav>
  {modal?.type==='auth'&&<AuthDialog capabilities={data.capabilities} intent={modal.intent} onClose={()=>{setModal(null);pending.current=null;}} onSuccess={onAuth}/>}{modal?.type==='save'&&<SaveDialog onClose={()=>setModal(null)} onSaved={r=>{updateRef(r);setMode('mine');setModal(null);openRef(r.id);toast('URL을 저장했어요. 캡처가 이어집니다.');}} onOpen={id=>{setModal(null);openRef(id);}}/>}{modal?.type==='project'&&<CreateProjectDialog onClose={()=>setModal(modal.afterAdd?{type:'add',data:modal.afterAdd}:null)} onCreated={p=>{updateProject(p);if(modal.afterAdd)setModal({type:'add',data:{...modal.afterAdd,projectId:p.id,sectionId:p.sections[0]?.id}});else{setModal(null);navigate('project',p.id);}toast('프로젝트를 만들었어요.');}}/>}{modal?.type==='add'&&<AddProjectDialog data={modal.data} projects={data.projects} references={data.references} samples={data.samples} onClose={()=>setModal(null)} onCopy={copy} onCreate={data=>setModal({type:'project',afterAdd:data})} onAdded={p=>{updateProject(p);setModal(null);toast('프로젝트에 담았어요.');}}/>}
  {modal?.type==='preview'&&<PreviewDialog references={modal.references} index={modal.index} onChange={index=>setModal({...modal,index})} onClose={()=>setModal(null)} onAdd={add} onDetail={id=>{setModal(null);openRef(id);}}/>}{modal?.type==='snapshot'&&<PreviewDialog snapshot={modal.snapshot} onClose={()=>setModal(null)}/>}{modal?.type==='settings'&&<SettingsDialog capabilities={data.capabilities} onAbout={()=>{setModal(null);navigate('about');}} onClose={()=>setModal(null)} user={data.user} theme={theme} onTheme={setTheme} onLogin={()=>setModal({type:'auth'})} onLogout={async()=>{await api('/auth/logout',{method:'POST'});seenJobs.current.clear();await refresh();setMode('samples');setModal(null);navigate('library');toast('로그아웃했어요.');}}/>}
  {modal?.type==='install'&&<InstallDialog capabilities={data.capabilities} pwa={pwa} onClose={()=>setModal(null)} onGuide={()=>{setModal(null);navigate('guide','5');}}/>}
  {modal?.type==='confirm'&&<Modal title={modal.title} onClose={()=>setModal(null)}><p className="modal-description">{modal.message}</p><div className="form-actions"><Button onClick={()=>setModal(null)}>취소</Button><Button primary onClick={()=>modal.action().catch(e=>toast(e.message))}>삭제</Button></div></Modal>}
  <div className="toast-stack" aria-live="polite" role="status">{toasts.map(t=><div className="toast" key={t.id}>{t.message}<button aria-label="알림 닫기" onClick={()=>setToasts(v=>v.filter(x=>x.id!==t.id))}><Icon name="close"/></button></div>)}</div></>;
}
