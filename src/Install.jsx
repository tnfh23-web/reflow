import {useState} from 'react';
import {Button,Modal} from './UI';
import {installApp} from './pwa';

const platforms=[{id:'desktop',name:'PC · Mac',steps:['Chrome 또는 Edge에서 리플로우를 엽니다.','브라우저 메뉴의 앱 설치 항목을 선택합니다.','앱 이름을 확인하고 설치하면 별도 창으로 열립니다.']},{id:'android',name:'Android',steps:['Chrome에서 리플로우를 엽니다.','브라우저 메뉴에서 앱 설치 또는 홈 화면에 추가를 선택합니다.','설치를 확인하면 홈 화면에 REFLOW가 생깁니다.']},{id:'ios',name:'iPhone · iPad',steps:['Safari에서 리플로우를 엽니다.','공유 메뉴에서 홈 화면에 추가를 선택합니다.','웹 앱으로 열기 옵션이 있다면 켜고 추가합니다.']}];
export default function InstallDialog({pwa,onClose,onGuide,capabilities={}}){
  const [platform,setPlatform]=useState(()=>/iPad|iPhone|iPod/.test(navigator.userAgent)?'ios':/Android/.test(navigator.userAgent)?'android':'desktop');
  const selected=platforms.find(p=>p.id===platform);
  const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
  return <Modal title={pwa.installed?'앱으로 사용하고 있어요':'리플로우를 앱으로 열기'} onClose={onClose}>
    <div className="install-identity"><img src="/icons/icon-192.png" width="64" height="64" alt="REFLOW 앱 아이콘"/><div><h3>REFLOW · 리플로우</h3><p>브라우저 탭과 분리된 앱 창에서 사용하세요.</p></div></div>
    <p className="modal-description">홈 화면이나 작업 표시줄에서 바로 열고, 브라우저 탭과 분리된 창으로 작업하세요.</p>
    {pwa.installed?<p className="install-state" role="status">현재 앱 창에서 실행 중이거나 이 브라우저가 설치를 확인했어요.</p>:pwa.available?<Button primary className="install-primary" disabled={pwa.busy} onClick={installApp}>{pwa.busy?'브라우저에서 확인해 주세요':'앱 설치'}</Button>:<p className="install-state">지금은 설치창을 바로 열 수 없어요. 아래에서 브라우저별 설치 방법을 확인하세요.</p>}
    {pwa.error&&<p className="form-error" role="alert">{pwa.error}</p>}
    {!pwa.installed&&<><div className="segmented install-platforms" aria-label="설치할 기기">{platforms.map(p=><button key={p.id} aria-pressed={platform===p.id} className={platform===p.id?'active':''} onClick={()=>setPlatform(p.id)}>{p.name}</button>)}</div><ol className="install-steps">{selected.steps.map((s,i)=><li key={s}><span>{i+1}</span><p>{s}</p></li>)}</ol><p className="quiet install-help">설치 메뉴가 보이지 않으면 Chrome·Edge·Safari에서 직접 열어 주세요. 메뉴 이름은 브라우저와 OS에 따라 다를 수 있어요.</p></>}
    <div className="install-boundary"><h3>설치 전에 알아두세요</h3><p>{capabilities.cloud?'설치해도 같은 계정의 자료를 사용합니다. 저장·캡처·편집에는 인터넷 연결이 필요하며 오프라인 편집은 지원하지 않아요.':'자료 저장·캡처·편집에는 이 PC에서 실행 중인 로컬 서버가 필요합니다. 오프라인 편집은 지원하지 않아요.'}</p>{local&&<p>지금 주소는 이 PC 전용입니다. 휴대폰에서는 공개 HTTPS 주소가 준비된 뒤 설치할 수 있어요.</p>}</div>
    <div className="form-actions"><Button onClick={onGuide}>사용법에서 자세히 보기</Button><Button onClick={onClose}>닫기</Button></div>
  </Modal>;
}
