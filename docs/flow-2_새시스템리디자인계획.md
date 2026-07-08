# Jurin-i 완전 리디자인 계획서 (v1.0)

**프로젝트명**: Jurin-i 시스템 재구축 (FastAPI Full Stack)  
**기간**: 6-9개월  
**팀**: 4명 (백엔드 3 + 프론트엔드 1 + DevOps 1)  
**상태**: 계획 완료  
**최종 수정**: 2026-07-08

---

## 📋 Context (왜 이 변화가 필요한가?)

### 현황
- **기술 스택**: Next.js 16 + FastAPI + PostgreSQL (3개 조직)
- **서비스 상태**: 운영 중 (회원 0명, 데이터 수집 중심)
- **문제점**:
  - 프론트/백엔드 분리 → 복잡한 배포 & 유지보수
  - API 엔드포인트 70개 (중복/비정규화)
  - 데이터 모델 비정규화 (불필요한 JSON 필드)
  - 타입 불일치 (Python + TypeScript)
  - 기술 부채 누적 (테스트 <30%, 문서화 부족)

### 목표
- ✅ **아키텍처 통합**: FastAPI Full Stack (2개 계층)
- ✅ **기능 정리**: API 45개로 축소, 게시판 정의 재설정
- ✅ **기술 부채 해소**: 정규화, 테스트 80%+, 문서화 완성
- ✅ **확장성 증대**: 독립적 스케일링, 명확한 계층화

### 기대 효과
| 지표 | 현재 | 목표 |
|------|------|------|
| 배포 복잡도 | 3개 앱 | 1-2개 (FastAPI + DB) |
| API 엔드포인트 | 70개 | 45개 |
| 테스트 커버리지 | <30% | 80%+ |
| 개발 속도 | 느림 | 2배 ↑ |
| 유지보수 비용 | 높음 | 50% ↓ |

---

## 📅 4 Phase Development Roadmap (6-9개월)

### Phase 1: 아키텍처 & 기본 구조 (1-2개월)
**마일스톤:** FastAPI 풀스택 개발 환경 완성

**작업:**
- FastAPI 초기화 + Jinja2/HTMX 템플릿
- SQLAlchemy 2.1 모델 재설계 (50개 → 35개 테이블)
- Alembic 마이그레이션 + 데이터 이관
- JWT 인증 시스템
- GitHub Actions CI/CD 파이프라인

**산출물:** 기본 FastAPI 앱 + 마이그레이션 DB

**팀:** Backend 2명

---

### Phase 2: 핵심 기능 (2-3개월)
**마일스톤:** 데이터 + 스크리닝 + 검색 완성

**작업:**
- 데이터 수집 (FSC/KRX, Yahoo, 뉴스) - APScheduler 12-14개 작업
- 4가지 스크리닝 (일목, 종베, 밥그릇, 급등예상)
- 종목 검색 & 상세 페이지
- 26개 API 엔드포인트 (데이터 + 스크리닝)

**산출물:** 완전한 데이터 파이프라인

**팀:** Backend 2명

---

### Phase 3: 사용자 기능 (1-2개월)
**마일스톤:** 게시판 + 알림 + 회원 완성

**작업:**
- 게시판 (CRUD + 좋아요 + 상태 관리)
- 알림 (인앱 + FCM 푸시)
- 회원 기능 (프로필 + 포인트 + 등급)
- 19개 API 엔드포인트

**산출물:** 게시판/회원/알림 기능

**팀:** Backend 1명 + Frontend 1명

---

### Phase 4: 고도화 & 배포 (1-2개월)
**마일스톤:** 프로덕션 준비 완료

**작업:**
- 성능 최적화 (DB 쿼리 + 인덱싱 + 캐싱)
- 테스트 (단위 80%, 통합, E2E)
- 모니터링/로깅 (Sentry)
- 무중단 마이그레이션 & 배포

**산출물:** 프로덕션 시스템

**팀:** Backend 1명 + Frontend 1명 + DevOps 1명

---

## 🏗️ Architecture Overview

### 2계층 구조
```
클라이언트 (HTML + HTMX)
         ↓
FastAPI Full Stack (uvicorn)
├─ Frontend Layer (Jinja2 렌더링)
├─ API Layer (45개 정규화 엔드포인트)
├─ Business Logic (서비스)
├─ Data Access (SQLAlchemy ORM)
└─ Background Jobs (APScheduler)
         ↓
PostgreSQL DB1 (회원)  +  PostgreSQL DB2 (시장)
```

### Technology Stack
- **Server**: FastAPI 0.127+ (Uvicorn)
- **ORM**: SQLAlchemy 2.1+, Pydantic v2
- **Template**: Jinja2 3.1+ (HTMX 1.10+)
- **Migration**: Alembic 1.13+
- **Scheduler**: APScheduler 3.11+
- **Testing**: pytest 8.0+
- **Deploy**: Docker + GitHub Actions

---

## 📊 API Normalization (70 → 45 endpoints)

### Endpoint Categories
| 카테고리 | 개수 | 예시 |
|---------|------|------|
| 인증 | 5 | login, signup, logout, refresh |
| 데이터 | 18 | stocks, indices, news, summaries |
| 스크리닝 | 8 | ichimoku, jongbe, ricebowl, breakout |
| 게시판 | 7 | boards, posts, likes |
| 회원 | 7 | profile, points, notifications |
| **합계** | **45** | |

---

## 👥 Team Structure (5명)

| 역할 | 담당 | Phase |
|------|------|-------|
| Backend Lead | 아키텍처, API 설계 | All |
| Backend Dev 1 | 데이터 수집, 스크리닝 | 2 |
| Backend Dev 2 | 게시판, 회원, 알림 | 3 |
| Frontend Dev | 템플릿, HTMX, UI | 3-4 |
| DevOps | 배포, 모니터링 | 4 |

---

## ⏰ Timeline & Milestones

```
Month 1-2: Phase 1 (아키텍처)
├─ Week 1-2: FastAPI 구조 + 템플릿
├─ Week 3-4: 데이터 모델 + 마이그레이션
├─ Week 5-6: 인증 + CI/CD
└─ Week 7-8: QA

Month 3-5: Phase 2 (핵심 기능)
├─ Week 9-11: 데이터 수집
├─ Week 12-14: 스크리닝 + API
└─ Week 15-16: 검색 + 캐싱

Month 6-7: Phase 3 (사용자 기능)
├─ Week 17-18: 게시판 + 알림
├─ Week 19-20: 회원 + 포인트
└─ Week 21-22: UI 통합

Month 8-9: Phase 4 (배포)
├─ Week 23-24: 성능 최적화
├─ Week 25-26: 테스트 + QA
└─ Week 27-30: 배포 + 모니터링
```

---

## 🚀 Deployment Strategy

### 환경 구성
- **Local**: Docker PostgreSQL + Uvicorn
- **Staging**: RDS + Railway
- **Production**: RDS + Railway/K8s

### 무중단 마이그레이션
1. Phase 3까지 구 시스템 운영 유지
2. Phase 4: 신/구 병렬 운영
3. 신 시스템 검증 후 트래픽 이전
4. 문제 발생 시 빠른 롤백

---

## ✅ Success Criteria (KPI)

| 지표 | 목표 |
|------|------|
| API 응답 시간 | <200ms (P95) |
| 테스트 커버리지 | 80%+ |
| 가동률 | 99.5%+ |
| 배포 시간 | <10분 |

---

## ⚠️ Key Risks

| 리스크 | 완화 전략 |
|--------|---------|
| 데이터 손실 | 단계별 검증, 3개 백업 |
| 성능 저하 | Phase 2부터 성능 테스트 |
| API 의존성 | 폴백 메커니즘, 캐싱 |
| 팀 규모 | 명확한 책임 분담 |

---

## 🎯 Critical Files for Implementation

- `/apps/admin/app/engine/models.py` - 데이터 모델 재설계 기준
- `/apps/admin/app/routers/api.py` - API 정규화 대상
- `/apps/admin/app/services/scheduler_service.py` - 스케줄러 이식
- `/apps/admin/requirements.txt` - 의존성 버전 검토

---

## 📝 Next Steps

1. **팀 회의 & 승인** - 아키텍처 확정
2. **Phase 1 시작** - FastAPI 프로젝트 생성
3. **주간 스프린트** - 1주 단위 마일스톤
4. **지속적 모니터링** - 리스크 & 일정 조정

---

## 결론

**FastAPI Full Stack 리디자인의 기대 효과:**
- ✅ 기술 스택 통일 (Python)
- ✅ 배포 간소화 (1개 앱)
- ✅ API 35% 축소
- ✅ 개발 속도 2배
- ✅ 유지보수 비용 50% 감소

**투자 기간:** 6-9개월  
**팀 규모:** 4-5명  
**ROI:** 높음

---

**Status:** ✅ Ready for Implementation
