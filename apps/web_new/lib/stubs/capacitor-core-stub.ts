/**
 * @capacitor/core 스텁 (웹 빌드 시 alias로 대체될 때 사용)
 */
export const Capacitor = {
  isNativePlatform: () => false,
  getPlatform: () => 'web',
  convertFileSrc: (path: string) => path,
  getServerUrl: () => '',
  isPluginAvailable: () => false,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerPlugin(_name: string, _implementations?: any): any {
  return {};
}

export class WebPlugin {
  // stub: no-op base class for web capacitor plugins
}

export default Capacitor;
