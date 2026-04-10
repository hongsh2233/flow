/**
 * JurinIApp / Capacitor Android OAuth 딥링크.
 *
 * @sync 필수 — Android 네이티브 `JurinIApp/app/build.gradle.kts` 의
 * `appAuthDeepLinkScheme` · `applicationId` 와 동일해야 합니다.
 * (Manifest 는 `${authDeepLinkScheme}` 로 위 값을 주입합니다.)
 */
export const MOBILE_AUTH_DEEPLINK_SCHEME = "com.julianhong.flowapp" as const;

export const MOBILE_AUTH_CALLBACK_URL =
  `${MOBILE_AUTH_DEEPLINK_SCHEME}://auth/callback` as const;
