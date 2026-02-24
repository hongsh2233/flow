# Capacitor APK 빌드 가이드 (주린이 앱)

> **방식**: WebView APK — Next.js 웹앱을 WebView로 래핑하여 Android APK 생성
> **푸시 알림**: FCM (Firebase Cloud Messaging) — 앱이 꺼져 있어도 수신 가능

---

## 전체 흐름

```
Firebase 프로젝트 생성
        ↓
google-services.json 다운로드 → android/app/ 에 배치
        ↓
npm install (Capacitor 패키지)
        ↓
npx cap add android
        ↓
capacitor.config.ts에 Railway URL 설정
        ↓
npx cap sync
        ↓
Android Studio에서 APK 빌드
```

---

## 1단계: Firebase 프로젝트 설정

### 1-1. Firebase 콘솔에서 프로젝트 생성
1. [Firebase Console](https://console.firebase.google.com) 접속
2. **프로젝트 추가** → 이름: `jurini-app`
3. Android 앱 추가:
   - 패키지명: `com.jurini.app`
   - 앱 닉네임: `주린이`
4. `google-services.json` 다운로드

### 1-2. 서비스 계정 키 발급 (백엔드 FCM 전송용)
1. Firebase 콘솔 → ⚙️ 프로젝트 설정 → **서비스 계정** 탭
2. **새 비공개 키 생성** → JSON 파일 다운로드
3. 해당 JSON 파일 내용을 Railway의 `admin` 서비스 환경 변수에 추가:

```
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...전체 JSON..."}
```

---

## 2단계: 로컬 개발 환경 설정

```bash
cd apps/web_new

# Capacitor 패키지 설치
npm install

# Android 플랫폼 추가
npx cap add android
```

---

## 3단계: capacitor.config.ts 설정

`apps/web_new/capacitor.config.ts`에서 Railway 배포 URL 설정:

```typescript
server: {
  url: "https://your-web-app.railway.app",  // ← 실제 Railway URL로 변경
  cleartext: false,
  androidScheme: "https",
},
```

> **로컬 개발 시**: `server.url`을 주석 처리하면 빌드된 파일(`out/`)을 사용합니다.

---

## 4단계: google-services.json 배치

```bash
# 다운로드한 google-services.json을 다음 경로에 복사
cp ~/Downloads/google-services.json apps/web_new/android/app/google-services.json
```

---

## 5단계: Capacitor 동기화 및 빌드

```bash
cd apps/web_new

# 웹 빌드 (server.url 사용 시 불필요)
# npm run build && npx next export

# Capacitor 동기화
npx cap sync android

# Android Studio 열기
npx cap open android
```

---

## 6단계: Android Studio에서 APK 빌드

1. Android Studio가 열리면 Gradle Sync 대기
2. **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. `android/app/build/outputs/apk/debug/app-debug.apk` 생성

### 릴리즈 APK (Play Store 배포용)
1. **Build → Generate Signed Bundle / APK**
2. 키스토어 생성 또는 기존 키스토어 선택
3. Release APK 생성

---

## 7단계: 권한 설정 확인

`android/app/src/main/AndroidManifest.xml`에 다음이 자동 추가됩니다:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

---

## 환경 변수 정리

### Railway - admin 서비스
| 변수명 | 설명 |
|--------|------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase 서비스 계정 JSON (FCM 전송용) |

### Railway - web_new 서비스
| 변수명 | 설명 |
|--------|------|
| `NEXT_PUBLIC_API_BASE_URL` | Admin API URL |
| `NEXT_PUBLIC_X_API_KEY` | API 시크릿 키 |

---

## 푸시 알림 흐름

```
앱 설치 → 로그인 → 설정에서 푸시 알림 ON
        ↓
CapacitorProvider: FCM 권한 요청 (Android 권한 다이얼로그)
        ↓
FCM 토큰 발급 → POST /api/fcm-token → DB 저장
        ↓
[새 게시글 등록 시]
board.py → Notification 생성 → send_push_to_all() → FCM 전송 → 기기 수신

[새 일정 등록 시]
schedule.py → Notification 생성 → send_push_to_all() → FCM 전송 → 기기 수신

[일정 알림 신청]
ScheduleCard 알림 버튼 클릭 → POST /api/schedule-alarms
ScheduleAlarmScheduler (5분마다) → 시간 도래 시 → send_push_to_email() → 해당 기기만 수신
```

---

## 앱 업데이트 방법

**코드 변경 시** (Railway 서버 URL 방식):
- Next.js 코드 수정 → Railway 자동 재배포 → **앱 재빌드 불필요**
- 앱 새로고침하면 최신 버전 자동 적용

**Capacitor 네이티브 설정 변경 시**:
```bash
npx cap sync android
# → Android Studio에서 다시 빌드 필요
```

---

## 트러블슈팅

### FCM 토큰이 등록되지 않을 때
- Android 13+ 기기는 알림 권한을 사용자가 명시적으로 허용해야 함
- 설정 → 앱 → 주린이 → 알림 → 허용

### 앱에서 API 연결이 안 될 때
- `capacitor.config.ts`의 `server.url`이 올바른지 확인
- Railway 배포 URL이 HTTPS인지 확인

### 푸시 알림이 오지 않을 때
- Railway admin 서비스에 `FIREBASE_SERVICE_ACCOUNT_JSON` 설정 확인
- Firebase 콘솔 → Cloud Messaging → 테스트 메시지 전송으로 검증
