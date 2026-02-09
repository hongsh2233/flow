# Stock BO API 통합 가이드

API 명세서를 기반으로 구현된 서비스 레이어와 목업 데이터입니다.

## 📁 프로젝트 구조

```
lib/
  types/
    api.ts              # API 타입 정의
  config/
    api.ts              # API 설정 (엔드포인트, 인증 등)
  services/
    authService.ts      # 인증 API
    boardService.ts     # 게시판 API
    scheduleService.ts  # 일정 관리 API
    krxService.ts       # KRX 데이터 API
    fscService.ts       # FSC 주식시세 API
    collectedDataService.ts  # 수집 데이터 API

data/
  mock/
    boards.ts           # 게시판 목업 데이터
    schedules.ts        # 일정 목업 데이터
    krxData.ts          # KRX 데이터 목업
    fscStockPrice.ts    # FSC 주식시세 목업
    collectedData.ts    # 수집 데이터 목업
```

## 🚀 사용 방법

### 1. 인증 (로그인)

```typescript
import { login } from '@/lib/services/authService'

const result = await login({
  username: 'admin@example.com',
  password: 'password'
})

if (result.success && result.data) {
  // 로그인 성공, 토큰이 자동으로 저장됨
  console.log('Token:', result.data.access_token)
}
```

### 2. 게시판 API

```typescript
import { fetchBoards, fetchBoardPosts, fetchPostDetail } from '@/lib/services/boardService'

// 게시판 목록
const boards = await fetchBoards()

// 게시판의 게시글 목록
const posts = await fetchBoardPosts('B001', 1, 10)

// 게시글 상세
const post = await fetchPostDetail('P001')
```

### 3. 일정 관리 API

```typescript
import { fetchSchedules } from '@/lib/services/scheduleService'

// 일정 목록 (필터링 가능)
const schedules = await fetchSchedules({
  start_date: '2025-01-01',
  end_date: '2025-12-31',
  type: 'manual'
})
```

### 4. KRX 데이터 API

```typescript
import { fetchKrxData, fetchKrxDates } from '@/lib/services/krxService'

// KRX 데이터 조회
const krxData = await fetchKrxData({
  data_type: 'kospi',
  bas_dd: '20251230'
})

// 날짜 목록 조회
const dates = await fetchKrxDates('kospi')
```

### 5. FSC 주식시세 API

```typescript
import { fetchFscStockPrice, fetchFscDates } from '@/lib/services/fscService'

// 주식시세 조회
const stockPrice = await fetchFscStockPrice({
  bas_dt: '20251230',
  limit: 200
})

// 날짜 목록 조회
const dates = await fetchFscDates()
```

### 6. 수집 데이터 API

```typescript
import { fetchCollectedData } from '@/lib/services/collectedDataService'

// 수집 데이터 조회
const collectedData = await fetchCollectedData({
  type: 'api',
  status: 'success',
  limit: 100
})
```

## 🔄 목업 데이터 ↔ 실제 API 전환

### 현재 상태 (목업 데이터 사용)

`.env.local` 파일이 없거나 `NEXT_PUBLIC_USE_MOCK_DATA=true`로 설정되어 있으면 목업 데이터를 사용합니다.

### 실제 API로 전환

1. `.env.local` 파일 생성:
```env
NEXT_PUBLIC_USE_MOCK_DATA=false
NEXT_PUBLIC_API_BASE_URL=https://your-api-domain.com
```

2. 각 서비스 파일에서 실제 API 응답 형식에 맞게 타입과 로직을 확인/수정합니다.

## 📝 컴포넌트에서 사용 예시

```typescript
'use client'

import { useState, useEffect } from 'react'
import { fetchBoards } from '@/lib/services/boardService'
import type { Board } from '@/lib/types/api'

export default function BoardList() {
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadBoards = async () => {
      try {
        const result = await fetchBoards()
        if (result.success && result.data) {
          setBoards(result.data)
        }
      } catch (error) {
        console.error('Failed to load boards:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadBoards()
  }, [])

  if (loading) return <div>Loading...</div>

  return (
    <div>
      {boards.map((board) => (
        <div key={board.id}>{board.name}</div>
      ))}
    </div>
  )
}
```

## 🔐 인증 토큰 관리

인증 토큰은 `localStorage`에 자동으로 저장/관리됩니다.

- 로그인 시: `setAuthToken()` 자동 호출
- API 요청 시: `getAuthHeaders()`로 자동 포함
- 로그아웃 시: `removeAuthToken()` 호출

## ⚠️ 주의사항

1. 모든 API는 JWT 토큰 인증이 필요합니다 (목업 데이터 사용 시 제외)
2. 에러 발생 시 목업 데이터로 자동 폴백됩니다
3. 실제 API 배포 후 `.env.local` 설정을 변경하면 자동으로 실제 API를 사용합니다

