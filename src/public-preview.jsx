import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Brand,Icon} from './UI';
import Intro from './Intro';
import Guide from './Guide';

const noop=()=>{};
export function renderPublicPage(page,samples){return renderToStaticMarkup(<>
  <a className="skip-link" href="#main-content">본문으로 이동</a>
  <aside className="sidebar"><a className="brand-button" href="/" aria-label="REFLOW 라이브러리"><Brand/></a><nav aria-label="주 메뉴"><a href="/"><Icon name="library"/>라이브러리</a><a href="/about" className={page==='about'?'active':''}>리플로우 소개</a><a href="/guide" className={page==='guide'?'active':''}>사용법</a></nav></aside>
  <div className="app-shell"><header className="topbar public-preview-topbar"><span>웹 디자인 레퍼런스 수집·캡처·정리</span><a href="/">라이브러리 열기</a></header><main id="main-content" tabIndex="-1">{page==='about'?<Intro samples={samples} capabilities={{cloud:true}}/>:<Guide samples={samples} cloud stepId="1" onStep={noop} onLibrary={noop} onSave={noop} onOpen={noop} onCompare={noop} onProjects={noop} onInstall={noop} pwa={{installed:false}} connected={false}/>}</main>{page==='guide'&&<footer className="app-legal-footer"><span>REFLOW · 리플로우</span><nav aria-label="서비스 문서"><a href="/about">리플로우 소개</a><a href="/terms">이용약관</a><a href="/privacy">개인정보처리방침</a></nav></footer>}</div>
</>);}
