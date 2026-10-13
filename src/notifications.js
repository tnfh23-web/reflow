const SETTING = 'reflow-open-app-notifications';
const enabled = () => window.isSecureContext && 'Notification' in window &&
  Notification.permission === 'granted' && localStorage.getItem(SETTING) === 'on';

const copy = {
  'test': {body: '알림이 정상적으로 표시됩니다.', route: '#library'},
  'capture-complete': {body: '웹페이지 캡처가 저장됐어요.', route: '#library'},
  'capture-failed': {body: '웹페이지를 캡처하지 못했어요. 라이브러리에서 다시 시도해 주세요.', route: '#library'},
  'project-created': {body: '프로젝트가 만들어졌어요.', route: '#projects'},
  'project-updated': {body: '프로젝트 변경 사항이 저장됐어요.', route: '#projects'},
  'project-deleted': {body: '프로젝트가 삭제됐어요.', route: '#projects'},
  'project-item-added': {body: '프로젝트에 레퍼런스가 추가됐어요.', route: '#projects'}
};

export function notificationState(user) {
  if (!user) return {available: false, active: false, reason: '로그인한 뒤 알림을 켤 수 있어요.'};
  if (!window.isSecureContext || !('Notification' in window))
    return {available: false, active: false, reason: '이 브라우저는 OS 알림을 지원하지 않아요.'};
  return {
    available: Notification.permission !== 'denied',
    active: enabled(),
    reason: Notification.permission === 'denied' ? '브라우저의 사이트 설정에서 알림 차단을 해제해 주세요.' : ''
  };
}

export async function enableNotifications() {
  if (await Notification.requestPermission() !== 'granted')
    throw new Error('브라우저에서 리플로우 알림을 허용해 주세요.');
  localStorage.setItem(SETTING, 'on');
}

export function disableNotifications() { localStorage.removeItem(SETTING); }

export async function notifyOpenApp(kind) {
  const item = copy[kind];
  if (!item || !enabled()) return false;
  try {
    const registration = await navigator.serviceWorker?.getRegistration?.();
    if (registration?.showNotification) {
      await registration.showNotification('REFLOW · 리플로우', {
        body: item.body, icon: '/icons/icon-192.png', tag: kind, data: {route: item.route}
      });
    } else {
      const notification = new Notification('REFLOW · 리플로우', {body: item.body, icon: '/icons/icon-192.png', tag: kind});
      notification.onclick = () => { window.focus(); location.hash = item.route; notification.close(); };
    }
    return true;
  } catch { return false; }
}
