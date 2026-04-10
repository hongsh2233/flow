/**
 * OAuth 딥링크 스킴이 웹 설정끼리 일치하는지 검증한다.
 * Android 는 `JurinIApp/app/build.gradle.kts` 의 `appAuthDeepLinkScheme` 과 수동으로 동기화.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function read(p) {
  return fs.readFileSync(path.join(root, p), "utf8");
}

const mobileAppAuth = read("lib/config/mobileAppAuth.ts");
const capacitor = read("capacitor.config.ts");

const scheme =
  mobileAppAuth.match(
    /export const MOBILE_AUTH_DEEPLINK_SCHEME = "([^"]+)" as const/
  )?.[1] ?? null;
const capAppId = capacitor.match(/appId:\s*"([^"]+)"/)?.[1] ?? null;

if (!scheme || !capAppId || scheme !== capAppId) {
  console.error(
    "[verify-mobile-deeplink] mobileAppAuth.ts 의 MOBILE_AUTH_DEEPLINK_SCHEME 과 capacitor.config.ts appId 가 같아야 합니다.",
    { scheme, capAppId }
  );
  process.exit(1);
}

if (
  !mobileAppAuth.includes(
    "`${MOBILE_AUTH_DEEPLINK_SCHEME}://auth/callback` as const"
  )
) {
  console.error(
    "[verify-mobile-deeplink] MOBILE_AUTH_CALLBACK_URL 은 템플릿 `${MOBILE_AUTH_DEEPLINK_SCHEME}://auth/callback` as const 여야 합니다."
  );
  process.exit(1);
}

console.log("[verify-mobile-deeplink] OK:", scheme);
