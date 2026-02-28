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

export default Capacitor;
