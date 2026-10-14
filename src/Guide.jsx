import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Button} from './UI';
import {gsap,useReveal} from './motion';
import {reduced} from './api';

import {guideSteps as steps,guideQuestions} from './service-content';

function PracticeFrame({children}){return <div className="guide-practice"><header><strong>기능 미리보기</strong><span>실제 저장되지 않는 연습 화면</span></header>{children}</div>;}
function SampleImage({sample,section,className=''}){return <img className={className} src={section?.image||sample?.thumb||'/media/architecture.webp'} alt={sample?`${sample.title} ${section?.name||'실제 캡처 예시'}`:'건축 이미지 예시'} decoding="async"/>;}
function SavePractice({sample}){
  const [phase,setPhase]=useState(0),[run,setRun]=useState(false);
  useEffect(()=>{if(!run)return;const timers=[0,1,2].map((v,i)=>setTimeout(()=>setPhase(v+1),i*650));timers.push(setTimeout(()=>setRun(false),1950));return()=>timers.forEach(clearTimeout);},[run]);
  return <PracticeFrame><div className="guide-save-layout"><div className="guide-sample-browser"><div className="guide-browser-bar"><i/><i/><i/><span>{sample?'FORM ARCHIVE · 예시 사이트':'이미지 예시 · 오프라인 안내'}</span></div><SampleImage sample={sample}/></div><div className="guide-save-form"><label>웹사이트 주소<input value="https://example.com" readOnly aria-label="연습용 웹사이트 주소"/></label><Button primary disabled={run} onClick={()=>{setPhase(0);setRun(true);}}>{run?'과정을 살펴보고 있어요':'저장 과정 보기'}</Button><ol className="guide-save-stages" aria-label="저장 과정 예시">{['주소 확인','전체 페이지 캡처','구간과 관찰 내용 정리'].map((s,i)=><li className={phase>i?'done':''} key={s}><span>{String(i+1).padStart(2,'0')}</span><div><strong>{s}</strong><small>{['입력한 주소를 확인합니다.','실제 브라우저가 화면을 캡처합니다.','보관한 캡처를 확인하고 기록합니다.'][i]}</small></div></li>)}</ol><p role="status" className="practice-status">{phase===3?'과정 예시가 끝났어요. 아래 버튼에서 실제 저장을 시작하세요.':'이 미리보기는 캡처를 실행하지 않아요.'}</p></div></div></PracticeFrame>;
}
function InspectPractice({sample}){
  const [section,setSection]=useState(''),[memo,setMemo]=useState('여백과 사진의 비율을 다음 작업에 참고하기.');
  const sections=(sample?.sections||[]).slice(0,3),selected=sections.find(s=>s.id===section);
  return <PracticeFrame><div className="guide-inspect-layout"><div><div className="guide-section-tabs" aria-label="연습 구간 선택"><button className={!section?'active':''} aria-pressed={!section} onClick={()=>setSection('')}>전체</button>{sections.map(s=><button key={s.id} className={section===s.id?'active':''} aria-pressed={section===s.id} onClick={()=>setSection(s.id)}>{s.name}</button>)}</div><div className="guide-section-image"><SampleImage sample={sample} section={selected}/></div></div><div className="guide-note-demo"><strong>개인 메모</strong><p>좋았던 이유를 한 문장으로 남겨 보세요.</p><textarea aria-label="연습용 개인 메모" value={memo} onChange={e=>setMemo(e.target.value)} maxLength={500}/><small>연습 메모는 이 화면에서만 유지돼요.</small><div className="guide-colors" aria-label="예시 이미지의 색 분위기">{['#CEC4B5','#A2927B','#F3F0E9'].map(c=><span key={c} style={{background:c}} title={c}/>)}</div><p>실제 색상과 타이포 값은 상세의 분석 패널에서 확인하세요.</p></div></div></PracticeFrame>;
}
function ComparePractice({samples}){
  const [fit,setFit]=useState(false);
  return <PracticeFrame><div className="guide-demo-toolbar"><span>두 레퍼런스의 이미지 비율을 비교하세요.</span><button className="text-button" aria-pressed={fit} onClick={()=>setFit(v=>!v)}>{fit?'첫 화면으로 맞추기':'전체 비율 보기'}</button></div><div className={`guide-compare-demo ${fit?'fit':''}`}>{[samples[0],samples[1]].map((s,i)=><figure key={i}><SampleImage sample={s}/><figcaption>{s?.title||['건축 예시','두 번째 예시'][i]}</figcaption></figure>)}</div></PracticeFrame>;
}
function BoardPractice({sample}){
  const [target,setTarget]=useState('Hero');
  return <PracticeFrame><div className="guide-demo-toolbar"><span>자료를 배치할 섹션을 선택하세요.</span><span className="quiet">배치 연습</span></div><div className="guide-board-demo">{['Hero','Contents','Footer'].map(name=><div className={target===name?'selected':''} key={name}><button aria-pressed={target===name} onClick={()=>setTarget(name)}>{name}</button>{target===name?<><SampleImage sample={sample}/><small>FORM ARCHIVE</small></>:<p>이 구간에 배치</p>}</div>)}</div></PracticeFrame>;
}
function AppPractice({pwa,onInstall}){return <PracticeFrame><div className="guide-app-demo"><div className="guide-window"><header><span>REFLOW</span><span>별도 앱 창</span></header><div><img src="/icons/icon-192.png" alt="리플로우 앱 아이콘" width="80" height="80"/><h3>작업 공간에서 바로 열기</h3><p>브라우저 탭과 분리된 창으로 같은 자료를 사용하세요.</p><Button primary onClick={onInstall}>{pwa.installed?'앱 사용 안내':'앱 설치 안내'}</Button></div></div><ul><li><strong>PC · Mac</strong><span>Chrome·Edge에서 설치</span></li><li><strong>Android</strong><span>Chrome 메뉴에서 앱 설치</span></li><li><strong>iPhone · iPad</strong><span>Safari 공유 메뉴에서 홈 화면에 추가</span></li></ul></div></PracticeFrame>;}

export default function Guide({samples,cloud=false,stepId,onStep,onLibrary,onSave,onOpen,onCompare,onProjects,onInstall,pwa,connected}){
  const index=Math.max(0,Math.min(4,(Number(stepId)||1)-1)),step=steps[index],root=useRef(null),panel=useRef(null),tabRefs=useRef([]);
  useReveal(root,'guide');
  useLayoutEffect(()=>{if(reduced())return;const ctx=gsap.context(()=>gsap.fromTo(panel.current,{opacity:0,y:8},{opacity:1,y:0,duration:.24,ease:'power2.out'}),root);return()=>ctx.revert();},[index]);
  const sample=samples[0];
  const questions=guideQuestions(cloud);
  const key=(event,i)=>{const keys={ArrowDown:1,ArrowRight:1,ArrowUp:-1,ArrowLeft:-1};let n;if(event.key in keys)n=(i+keys[event.key]+steps.length)%steps.length;else if(event.key==='Home')n=0;else if(event.key==='End')n=4;else return;event.preventDefault();onStep(n+1);tabRefs.current[n]?.focus();};
  return <div className="guide-page" ref={root}><div className="page-title" data-reveal><div><h1>리플로우 사용법</h1><p>웹사이트 캡처부터 구간 메모·비교·프로젝트 정리까지 확인하세요.</p></div><Button disabled={!connected} onClick={onLibrary}>예시 라이브러리 열기</Button></div>
    <div className="guide-progress" aria-hidden="true"><span style={{width:`${(index+1)*20}%`}}/></div>
    <div className="guide-layout"><div className="guide-step-list" role="tablist" aria-label="사용법 단계">{steps.map((s,i)=><button ref={el=>{tabRefs.current[i]=el;}} id={`guide-tab-${i}`} role="tab" tabIndex={index===i?0:-1} aria-selected={index===i} aria-controls="guide-panel" className={index===i?'active':''} key={s.name} onClick={()=>onStep(i+1)} onKeyDown={e=>key(e,i)}><span>{String(i+1).padStart(2,'0')}</span><div><strong>{s.name}</strong><p>{s.hint}</p></div></button>)}</div>
      <section className="guide-panel" id="guide-panel" ref={panel} role="tabpanel" aria-labelledby={`guide-tab-${index}`} tabIndex={0}><h2>{step.title}</h2><p className="guide-description">{step.description}</p>
        <div key={index}>{index===0?<SavePractice sample={sample}/>:index===1?<InspectPractice sample={sample}/>:index===2?<ComparePractice samples={samples}/>:index===3?<BoardPractice sample={sample}/>:<AppPractice pwa={pwa} onInstall={onInstall}/>}</div>
        <p className="guide-tip">{index===4&&!cloud?'로컬 버전의 저장·캡처에는 이 PC에서 실행 중인 서버가 필요합니다.':step.tip}</p><div className="guide-actions">{index===0?<><Button primary onClick={onSave} disabled={!connected}>새 레퍼런스 저장</Button><Button disabled={!sample||!connected} onClick={()=>onOpen(sample.id)}>샘플 상세 보기</Button></>:index===1?<Button primary disabled={!sample||!connected} onClick={()=>onOpen(sample.id)}>샘플에서 직접 살펴보기</Button>:index===2?<Button primary disabled={samples.length<2||!connected} onClick={()=>onCompare(samples.slice(0,2).map(s=>s.id))}>샘플 두 개 비교하기</Button>:index===3?<Button primary disabled={!connected} onClick={onProjects}>프로젝트 열기</Button>:<Button primary onClick={onInstall}>{pwa.installed?'앱 사용 안내':'앱 설치'}</Button>}{index>0&&<Button onClick={()=>onStep(index)}>이전 단계</Button>}{index<4&&<Button onClick={()=>onStep(index+2)}>다음 단계</Button>}</div>
        <div className="guide-utilities"><div className="guide-shortcuts"><h3>알아두면 좋아요</h3><span><kbd>Ctrl / ⌘ K</kbd>검색</span><span><kbd>Esc</kbd>닫기</span><span><kbd>Tab</kbd>다음 항목</span></div><div className="guide-faq">{questions.map(([q,a])=><details key={q}><summary>{q}<span className="faq-open">열기</span><span className="faq-close">닫기</span></summary><p>{a}</p></details>)}</div></div>
      </section></div>
    <section className="guide-workflow" aria-labelledby="guide-workflow-title"><h2 id="guide-workflow-title">저장부터 프로젝트 활용까지</h2><p>처음 사용하는 경우 아래 순서대로 진행하세요. 예시는 사용 방법을 설명하는 자료입니다.</p><ol>{steps.map((item,i)=><li key={item.name}><span className="guide-workflow-number">{String(i+1).padStart(2,'0')}</span><div><h3>{item.title}</h3><p>{item.instructions}</p><p className="guide-workflow-example"><strong>사용 예시</strong>{item.example}</p></div></li>)}</ol></section>
  </div>;
}
