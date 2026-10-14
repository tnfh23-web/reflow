import {useLayoutEffect,useRef} from 'react';
import {Icon} from './UI';
import {useIntroMotion} from './use-intro-motion';
import {CaptureProcess,IntroMarquee,IntroCompare,IntroFind,useIntroLoop} from './IntroExtras';
import {smoothScrollTo} from './smooth-scroll';
import './intro.css';
import {useCases} from './service-content';

const heroImage=r=>r?.sections?.find(s=>s.name==='Hero')?.image||r?.thumb||r?.image;
export default function Intro({capabilities={},samples}){
  const root=useRef(null),memoGraphic=useRef(null),boardGraphic=useRef(null);
  const examples=samples.slice(0,3),example=samples.find(r=>r.id==='sample-form-archive')||samples[0];
  const hero=example?.sections?.find(s=>s.name==='Hero'),projects=example?.sections?.find(s=>s.name==='Projects');
  useLayoutEffect(()=>{smoothScrollTo(window,0,{immediate:true});},[]);
  useIntroMotion(root);useIntroLoop(memoGraphic);useIntroLoop(boardGraphic);
  return <div ref={root} className="intro-page intro-readonly">
    <section className="intro-hero" aria-labelledby="intro-title">
      <div className="intro-hero-heading"><div className="intro-headline-block"><h1 id="intro-title" data-split>웹 디자인 레퍼런스를<br/>{' '}수집하고 정리하세요.</h1></div><div className="intro-hero-copy"><p>리플로우(REFLOW)는 웹사이트 주소와 이미지를 저장하고,<br className="intro-wide-break"/> 전체 페이지와 필요한 구간을 캡처하는 개인 레퍼런스 서비스입니다.</p><p>캡처에 메모와 태그를 남기고 두 자료를 비교하며,<br className="intro-wide-break"/> 프로젝트별로 정리해 웹 디자인 작업에 활용하세요.</p></div></div>
      <div className="intro-gallery"><figure className="intro-selected-site"><div className="intro-site-image">{example&&<img src={heroImage(example)} alt="FORM ARCHIVE 웹사이트 캡처 예시"/>}</div><figcaption className="intro-site-label"><Icon name="window"/><strong>{example?.title||'사이트 캡처'}</strong></figcaption></figure><div className="intro-site-options">{examples.map(r=><figure className="intro-passive-preview" key={r.id}><img src={heroImage(r)} alt={`${r.title} 캡처 예시`}/><figcaption><Icon name="window"/>{r.title}</figcaption></figure>)}</div></div>
      <div className="intro-gallery-footer"><p>리플로우에서 보관하고 활용할 수 있는 자료입니다.</p><ul>{[['capture','캡처'],['note','메모'],['compare','비교'],['folder','프로젝트']].map(([icon,label])=><li key={icon}><Icon name={icon}/>{label}</li>)}</ul></div>
    </section>
    <CaptureProcess example={example}/><IntroMarquee/>
    <section className="intro-workspace" aria-labelledby="intro-memo-title"><div className="intro-section-heading"><span className="intro-heading-icon"><Icon name="note"/></span><h2 id="intro-memo-title" data-split>필요한 구간과,<br/>{' '}참고할 이유를 함께.</h2></div><p className="intro-feature-description" data-intro-reveal>전체 페이지를 다시 훑지 않아도 필요한 부분을 확인할 수 있습니다.<br/>구간에 메모를 남기면 사진 비율, 여백, 구성처럼 참고할 내용을 다시 찾기 쉽습니다.</p><div ref={memoGraphic} className="intro-memo-workspace intro-loop" data-intro-reveal><figure className="intro-section-browser"><div className="intro-static-labels"><span>Header</span><strong>Hero</strong><span>Projects</span></div><div className="intro-section-image">{hero&&<img src={hero.image} alt="메모를 기록할 Hero 구간 예시"/>}</div><figcaption>전체 캡처에서 선택한 Hero 구간</figcaption></figure><div className="intro-memo-editor intro-note-example"><h3><Icon name="note"/>개인 메모</h3><div className="intro-note-sheet">{['사진과 텍스트의 비율','제목 주변의 넓은 여백','콘텐츠 사이의 간격'].map((line,i)=><p className="intro-note-line" style={{'--line-index':i}} key={line}><span>{String(i+1).padStart(2,'0')}</span>{line}</p>)}</div><p>구간과 메모를 함께 보관합니다.</p></div></div></section>
    <IntroCompare samples={samples}/><IntroMarquee reverse/>
    <section className="intro-project" aria-labelledby="intro-board-title"><div className="intro-section-heading"><span className="intro-heading-icon"><Icon name="project"/></span><h2 id="intro-board-title" data-split>자료를 프로젝트별로<br/>{' '}정리하세요.</h2></div><p className="intro-feature-description" data-intro-reveal>전체 화면이나 특정 구간을 프로젝트의 필요한 분류에 모읍니다.<br/>같은 작업에 쓰는 자료를 함께 놓고, 참고할 내용과 구성을 정리할 수 있습니다.</p><div ref={boardGraphic} className="intro-practice-board intro-loop" data-intro-reveal><div className="intro-board-source"><h3>보관한 구간</h3>{hero&&<img src={hero.image} alt="프로젝트에 활용하는 Hero 캡처"/>}<p>{example?.title} · Hero</p><p>사이트 전체가 아닌 필요한 구간을 작업 자료로 활용합니다.</p></div><div className="intro-board-content"><div className="intro-board-heading"><h3>문화 공간 웹사이트</h3><span>프로젝트 자료</span></div><div className="intro-board-columns"><div><h4><Icon name="folder"/>Hero</h4>{hero&&<figure className="intro-board-item intro-board-repeat"><img src={hero.image} alt="Hero 분류에 보관한 이미지"/><figcaption>첫 화면의 구성</figcaption></figure>}</div><div><h4><Icon name="folder"/>콘텐츠</h4>{projects&&<figure className="intro-board-item intro-board-repeat"><img src={projects.image} alt="콘텐츠 분류에 보관한 이미지"/><figcaption>목록과 이미지 배치</figcaption></figure>}</div></div><p className="intro-board-note">레퍼런스를 목적에 맞는 분류에 모아 둡니다.</p></div></div></section>
    <section className="intro-use-cases" aria-labelledby="intro-use-cases-title"><div className="intro-section-heading"><span className="intro-heading-icon"><Icon name="folder"/></span><h2 id="intro-use-cases-title" data-split>수집한 레퍼런스는<br/>{' '}이렇게 활용하세요.</h2></div><p className="intro-feature-description" data-intro-reveal>아래는 리플로우의 캡처·메모·비교·프로젝트 기능을 사용하는 예시입니다.</p><dl className="intro-use-case-list" data-intro-group>{useCases.map(item=><div key={item.title}><dt>{item.title}</dt><dd>{item.text}</dd></div>)}</dl></section>
    <IntroFind cloud={capabilities.cloud} samples={samples}/>
    <footer className="intro-legal-footer"><span>REFLOW · 리플로우</span><nav aria-label="서비스 문서"><a href="/guide">사용법</a><a href="/terms.html">이용약관</a><a href="/privacy.html">개인정보처리방침</a><a href="mailto:tnfh23@gmail.com">문의</a></nav></footer>
  </div>;
}
