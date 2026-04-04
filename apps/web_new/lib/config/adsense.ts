/**
 * Google AdSense — 게시자 ID는 public/ads.txt 의 pub- 값과 일치해야 합니다.
 * ads.txt 규격: google.com, <pub-ID>, DIRECT, <certification-authority-id>
 */
export const ADSENSE_CLIENT_ID = "ca-pub-6042624006544756" as const;

/** https://<도메인>/ads.txt 에 그대로 한 줄로 게시 */
export const ADS_TXT_LINE =
  "google.com, pub-6042624006544756, DIRECT, f08c47fec0942fa0" as const;

export const ADSENSE_SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;
