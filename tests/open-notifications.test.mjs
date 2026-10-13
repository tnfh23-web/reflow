import test from 'node:test';
import assert from 'node:assert/strict';

const values = new Map(), shown = [];
globalThis.window = {isSecureContext: true};
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key)
};
globalThis.Notification = {permission: 'default', requestPermission: async () => 'granted'};
window.Notification = Notification;
Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {
  serviceWorker: {getRegistration: async () => ({showNotification: async (...args) => shown.push(args)})}
}});

const {notificationState, enableNotifications, disableNotifications, notifyOpenApp} = await import('../src/notifications.js');

test('OS alerts require an explicit setting and a signed-in user', async () => {
  assert.equal(notificationState(null).available, false);
  assert.equal(await notifyOpenApp('capture-complete'), false);
  await enableNotifications();
  Notification.permission = 'granted';
  assert.equal(notificationState({id: 'owner'}).active, true);
  assert.equal(await notifyOpenApp('capture-complete'), true);
  assert.equal(shown[0][1].data.route, '#library');
  assert.equal(await notifyOpenApp('project-updated'), true);
  assert.equal(shown[1][1].data.route, '#projects');
  assert.equal(await notifyOpenApp('test'), true);
  assert.match(shown[2][1].body, /정상적으로/);
  assert.equal(await notifyOpenApp('unknown'), false);
  disableNotifications();
  assert.equal(await notifyOpenApp('capture-failed'), false);
  assert.equal(shown.length, 3);
});
