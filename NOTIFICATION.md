# 알림(Notification) 기능 설계 및 구현 가이드

## 개요

주린이 앱의 헤더 알림 벨 버튼을 중심으로, **설정 → 알림 수신 → 리스트 노출 → 뱃지 카운터**까지의 흐름을 정의합니다.

---

## 1. 알림 활성화 조건

### 설정 페이지 (`/settings`)
| 항목 | 스토리지 키 | 역할 |
|------|------------|------|
| 푸시 알림 | `push_notification_enabled` (localStorage) | 헤더 벨 버튼 활성화/비활성화 |
| 일정 알림 | `schedule_alarm_enabled` (localStorage) | 캘린더 ScheduleCard의 알림 버튼 활성화/비활성화 |

### 헤더 벨 버튼 동작
- `pushEnabled = false` → 벨 아이콘 반투명(opacity 0.45), 클릭 시 `/settings`로 이동
- `pushEnabled = true` → 정상 활성화, 알림 목록 패널 표시

```
설정 페이지에서 푸시 알림 ON
        ↓
헤더 벨 버튼 활성화
        ↓
60초마다 백엔드 GET /api/notifications 폴링
        ↓
미읽음 카운트 뱃지 표시 (최대 99+)
```

---

## 2. 알림 종류 (type)

| type | 발생 시점 | 생성 주체 |
|------|----------|----------|
| `new_post` | 게시판에 새 글 등록 (비밀글 제외) | `board.py` POST 핸들러 |
| `new_schedule` | 캘린더에 새 일정 등록 | `schedule.py` add_schedule() |
| `schedule_alarm` | 일정 알림 신청 후 지정 시간 도래 | `ScheduleAlarmScheduler` (매 5분 실행) |

---

## 3. 데이터 모델

### `notifications` 테이블
```sql
id          SERIAL PRIMARY KEY
type        VARCHAR(30)   -- 'new_post' | 'new_schedule' | 'schedule_alarm'
title       VARCHAR(255)  -- 알림 제목
message     VARCHAR(500)  -- 상세 메시지
link_url    VARCHAR(500)  -- 클릭 시 이동할 URL
is_global   VARCHAR(10)   -- 'true' (전체 회원 대상)
created_at  TIMESTAMPTZ
```

### `notification_reads` 테이블
```sql
id               SERIAL PRIMARY KEY
notification_id  INTEGER (FK → notifications.id)
member_email     VARCHAR(100)
read_at          TIMESTAMPTZ
UNIQUE(notification_id, member_email)
```

### `schedule_alarm_subscriptions` 테이블 (신규)
```sql
id            SERIAL PRIMARY KEY
member_email  VARCHAR(100)
schedule_id   INTEGER (FK → schedules.id ON DELETE CASCADE)
timing        VARCHAR(10)   -- '1min' | '30min' | '1day' | '2day'
notified      VARCHAR(10)   -- 'false' | 'true'
created_at    TIMESTAMPTZ
UNIQUE(member_email, schedule_id)
```

---

## 4. 백엔드 API

### 알림 목록 조회
```
GET /api/notifications?email={email}&limit=30
```
- 최근 30일 이내 알림 반환
- `email` 파라미터로 읽음 여부 포함

### 알림 읽음 처리
```
POST /api/notifications/read?email={email}
Body: { "notification_ids": [1, 2, 3] }
```

### 전체 읽음 처리
```
POST /api/notifications/read-all?email={email}
```

### 일정 알림 신청
```
POST /api/schedule-alarms?email={email}
Body: { "schedule_id": 123, "timing": "1day" }
```

### 일정 알림 취소
```
DELETE /api/schedule-alarms/{schedule_id}?email={email}
```

### 내 알림 신청 목록
```
GET /api/schedule-alarms?email={email}
```

---

## 5. 프론트엔드 API 프록시 (Next.js Route Handlers)

| 엔드포인트 | 역할 |
|-----------|------|
| `GET /api/notifications` | 알림 목록 조회 (세션 email 자동 주입) |
| `POST /api/notifications/read` | 읽음 처리 |
| `POST /api/notifications/read-all` | 전체 읽음 처리 |
| `GET /api/schedule-alarms` | 내 알림 신청 목록 |
| `POST /api/schedule-alarms` | 알림 신청 |
| `DELETE /api/schedule-alarms` | 알림 취소 |

---

## 6. 일정 알림 타이밍 계산

`ScheduleAlarmScheduler`는 **매 5분**마다 다음을 수행합니다:

1. `notified='false'`인 구독 전체 조회
2. 각 구독의 일정 발생 시각 계산
   - 시간 없는 일정: 당일 09:00 기준
3. `fire_at = schedule_datetime - offset_minutes`
4. `now_kst >= fire_at` 이면 `Notification` 생성 후 `notified='true'` 처리

| timing | offset |
|--------|--------|
| `1min` | 1분 전 |
| `30min` | 30분 전 |
| `1day` | 1일(1440분) 전 |
| `2day` | 2일(2880분) 전 |

---

## 7. UI 플로우

### 헤더 알림 패널
```
[벨 아이콘] → 클릭 → 알림 패널 열림
  ├── 알림 항목 (미읽음: 진한 배경 + 파란 점)
  │     클릭 → 읽음 처리 → link_url 이동
  └── [모두 읽음] 버튼
```

### 캘린더 일정 알림 신청
```
설정에서 일정 알림 ON + 로그인
        ↓
ScheduleCard에 알림 버튼 활성화
        ↓
버튼 클릭 → 드롭다운 (1분 전 / 30분 전 / 1일 전 / 2일 전)
        ↓
선택 → POST /api/schedule-alarms 저장
        ↓
백엔드 스케줄러가 지정 시간에 Notification 생성
        ↓
다음 폴링 주기(60초)에 헤더 벨에 반영
```

---

## 8. 주의사항 및 TODO

### 현재 구현 한계
- **알림은 전역(is_global=true)** 방식: 모든 로그인 회원이 같은 new_post/new_schedule 알림을 받음
- schedule_alarm 타입 알림도 현재 전역으로 생성됨 → 개인화 지원이 필요한 경우 `Notification.target_email` 컬럼 추가 필요

### 추후 개선 가능 항목
- [ ] Web Push (VAPID/FCM) 실제 푸시 알림 구현 (`push_service.py` TODO 참조)
- [ ] `Notification`에 `target_email` 컬럼 추가 → 개인별 알림 분리
- [ ] 알림 타입별 아이콘 구분 (게시글/일정/시스템)
- [ ] 읽음 처리 후 30일 이상 지난 알림 자동 삭제
- [ ] 알림 신청 현황을 캘린더 카드에 초기 로드 시 복원 (현재: 새로고침 시 선택 상태 초기화)
