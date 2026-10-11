import {useEffect,useMemo,useRef,useState} from 'react';
import {Button,Empty,Media,Tags} from './UI';
import {allTags} from './api';
import {useReveal} from './motion';
function ReferenceTile({r,onOpen,onPreview,onAdd,compare,selected,onSelect,reason,index,recent=false}) {
  return <article className={`reference-tile ${selected?'selected':''} ${recent?'recent-tile':''}`} data-reveal>
    <div className={`tile-media aspect-${index%4}`} onPointerEnter={e=>{if(recent)return;const image=e.currentTarget.querySelector("img");if(image){const distance=Math.min(Math.max(0,image.clientHeight-e.currentTarget.clientHeight),e.currentTarget.clientHeight*.65);e.currentTarget.style.setProperty("--preview-shift",`-${distance}px`);}}}>
      <button className="image-open" onClick={()=>compare?onSelect(r.id):onOpen(r.id)} aria-label={`${r.title} ${compare?'비교 선택':'상세 보기'}`} aria-pressed={compare?selected:undefined}><Media reference={r} full={!recent}/></button>
      {compare?<button className="select-dot" aria-label={`${r.title} 비교 선택`} aria-pressed={selected} onClick={()=>onSelect(r.id)}>{selected?'선택됨':'선택'}</button>:<div className="hover-actions"><Tags tags={allTags(r).slice(0,2)}/><div><button onClick={()=>onPreview(r.id)}>미리보기</button><button className="primary" onClick={()=>onAdd(r)}>프로젝트에 추가</button></div></div>}
    </div><div className="tile-caption"><button onClick={()=>onOpen(r.id)}>{r.title}</button>{!compare&&<button className="mobile-more" aria-label={`${r.title} 미리보기`} onClick={()=>onPreview(r.id)}>···</button>}</div>{reason&&<p className="match-reason">{reason}</p>}
  </article>;
}
export default function Library({references,samples,user,mode,setMode,query,search,onOpen,onPreview,onAdd,onSave,onCompare}){
  const [columns,setColumns]=useState(()=>innerWidth<=900?2:innerWidth<=1200?3:4);
  useEffect(()=>{const resize=()=>setColumns(innerWidth<=900?2:innerWidth<=1200?3:4);addEventListener('resize',resize);return()=>removeEventListener('resize',resize);},[]);
  const [sort,setSort]=useState('latest'),[filter,setFilter]=useState({kind:'',tag:''}),[activeFilter,setActiveFilter]=useState(''),[compare,setCompare]=useState(false),[selection,setSelection]=useState([]);const root=useRef(null);
  const source=mode==='samples'?samples:references;
  const displayed=useMemo(()=>{let list=source;if(query.trim())list=list.filter(r=>search.results.some(v=>v.id===r.id));if(filter.kind)list=list.filter(r=>r.tags[filter.kind]?.includes(filter.tag));return [...list].sort((a,b)=>query?(search.results.find(r=>r.id===b.id)?.score||0)-(search.results.find(r=>r.id===a.id)?.score||0):sort==='views'?(b.views||0)-(a.views||0):mode==='samples'?0:b.date.localeCompare(a.date));},[source,sort,filter,query,search]);
  const options=activeFilter?[...new Set(source.flatMap(r=>r.tags[activeFilter]||[]))]:[];
  const select=id=>setSelection(prev=>prev.includes(id)?prev.filter(x=>x!==id):prev.length<2?[...prev,id]:[prev[1],id]);
  useReveal(root,`${mode}:${query}:${filter.kind}:${filter.tag}`);
  const common={onOpen,onPreview,onAdd,compare,selected:false,onSelect:select};
  return <div ref={root} className="library-page">
    <div className="page-title"><div><h1>라이브러리</h1><p>저장한 레퍼런스를 검색하고 정리하세요.</p></div>{user&&<div className="segmented"><button className={mode==='mine'?'active':''} onClick={()=>{setMode('mine');setFilter({kind:'',tag:''});}}>내 라이브러리</button><button className={mode==='samples'?'active':''} onClick={()=>{setMode('samples');setFilter({kind:'',tag:''});}}>예시 사이트</button></div>}</div>
    {!query&&!filter.kind&&source.length>0&&<section className="recent-section"><div className="section-heading"><h2>{sort==='views'?'많이 본 항목':'최근 저장'}</h2>{!user&&<span className="quiet">직접 만든 예시 사이트를 둘러보세요.</span>}</div><div className="recent-grid">{[...source].sort((a,b)=>sort==='views'?(b.views||0)-(a.views||0):mode==='samples'?0:b.date.localeCompare(a.date)).slice(0,3).map((r,i)=><ReferenceTile key={r.id} r={r} index={i} {...common} selected={selection.includes(r.id)} recent/>)}</div></section>}
    <section className="all-section"><div className="library-toolbar"><h2>{query?'검색 결과':'전체 레퍼런스'}</h2><div className="filter-controls">{[['style','Style'],['layout','Layout'],['interaction','Interaction']].map(([kind,label])=><div className="filter-wrap" key={kind}><Button className={filter.kind===kind||activeFilter===kind?'active':''} onClick={()=>setActiveFilter(activeFilter===kind?'':kind)} aria-expanded={activeFilter===kind}>{label}{filter.kind===kind?` · ${filter.tag}`:''}</Button>{activeFilter===kind&&<div className="filter-popover"><button onClick={()=>{setFilter({kind:'',tag:''});setActiveFilter('');}}>전체</button>{options.map(t=><button key={t} onClick={()=>{setFilter({kind,tag:t});setActiveFilter('');}}>{t}</button>)}{!options.length&&<span className="quiet">아직 태그가 없어요.</span>}</div>}</div>)}<Button onClick={()=>setSort(sort==='latest'?'views':'latest')}>{sort==='latest'?'최신순':'조회수순'}</Button><Button className={compare?'active':''} onClick={()=>{setCompare(!compare);setSelection([]);}}>{compare?'선택 취소':'비교 선택'}</Button></div></div>
    {query&&<p className="search-mode">{search.loading?'찾는 중…':`${displayed.length}개의 레퍼런스 · ${search.mode==='semantic'?'의미 검색':'키워드·태그·메모 검색'}`}</p>}
    {!source.length?<Empty title="첫 레퍼런스를 저장하세요." action={<><Button primary onClick={onSave}>새 레퍼런스</Button><Button onClick={()=>setMode('samples')}>예시 둘러보기</Button></>}>저장한 웹사이트가 여기에 표시됩니다.</Empty>:!displayed.length&&search.loading?<p className="quiet" role="status">저장된 레퍼런스를 검색하고 있어요.</p>:!displayed.length?<Empty title="아직 찾지 못했어요." action={<Button onClick={()=>{setFilter({kind:'',tag:''});setActiveFilter('');}}>필터 초기화</Button>}>다른 검색어 또는 태그로 다시 찾아보세요.</Empty>:<div className="masonry">{Array.from({length:columns},(_,col)=><div className="masonry-column" key={col}>{displayed.filter((_,i)=>i%columns===col).map((r,i)=><ReferenceTile key={r.id} r={r} index={col+i} {...common} selected={selection.includes(r.id)} reason={query?search.results.find(v=>v.id===r.id)?.reason:null}/>)}</div>)}</div>}
    </section>{compare&&<div className="compare-bar"><span>{selection.length===2?'두 레퍼런스를 선택했어요.':`비교할 레퍼런스 두 개를 선택하세요. (${selection.length}/2)`}</span><Button primary disabled={selection.length!==2} onClick={()=>onCompare(selection)}>나란히 비교</Button></div>}
  </div>;
}

