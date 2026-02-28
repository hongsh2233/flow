/**
 * @capacitor/push-notifications 스텁 (웹 빌드 시 패키지 미설치 환경용)
 * Capacitor 네이티브가 아닌 경우 이 모듈로 resolve되어 no-op으로 동작합니다.
 */

const noop = () => Promise.resolve();
const noopListener = () => Promise.resolve({ remove: () => Promise.resolve() });

export const PushNotifications = {
  requestPermissions: () => Promise.resolve({ receive: "denied" as const }),
  register: noop,
  unregister: noop,
  addListener: (_event: string, _callback: (arg: unknown) => void) => noopListener(),
  removeAllListeners: noop,
  createChannel: noop,
  deleteChannel: noop,
  listChannels: () => Promise.resolve({ channels: [] }),
};

export default { PushNotifications };
