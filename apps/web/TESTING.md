# 테스트 가이드

## 테스트 실행

### 전체 테스트 실행
```bash
npm test
```

### Watch 모드로 실행 (파일 변경 감지)
```bash
npm run test:watch
```

### 커버리지 리포트 생성
```bash
npm run test:coverage
```

## 테스트 구조

```
├── lib/
│   ├── stores/
│   │   └── __tests__/
│   │       └── useFavoriteStore.test.ts   # Zustand 스토어 테스트
│   └── utils/
│       └── __tests__/
│           └── safeAccess.test.ts          # 유틸리티 함수 테스트
└── app/
    └── components/
        └── __tests__/                       # 컴포넌트 테스트 (추가 예정)
```

## 테스트 작성 가이드

### 1. 유닛 테스트 (유틸리티 함수)

```typescript
import { formatNumber } from '../safeAccess'

describe('formatNumber', () => {
  it('숫자를 천단위 콤마로 포맷팅해야 함', () => {
    expect(formatNumber(1000)).toBe('1,000')
  })
})
```

### 2. 스토어 테스트 (Zustand)

```typescript
import { renderHook, act } from '@testing-library/react'
import { useFavoriteStore } from '../useFavoriteStore'

describe('useFavoriteStore', () => {
  it('addFavCode로 추가가 가능해야 함', () => {
    const { result } = renderHook(() => useFavoriteStore())

    act(() => {
      result.current.addFavCode('005930')
    })

    expect(result.current.favCodes.has('005930')).toBe(true)
  })
})
```

### 3. 컴포넌트 테스트 (React Testing Library)

```typescript
import { render, screen } from '@testing-library/react'
import Button from '../Button'

describe('Button', () => {
  it('버튼을 렌더링해야 함', () => {
    render(<Button label="클릭" />)
    expect(screen.getByText('클릭')).toBeInTheDocument()
  })
})
```

## 모킹 (Mocking)

### NextAuth 모킹
```typescript
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({ data: null, status: 'unauthenticated' })),
}))
```

### Next Router 모킹
```typescript
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
  })),
}))
```

## 커버리지 목표

- **유틸리티 함수**: 90% 이상
- **스토어**: 80% 이상
- **커스텀 훅**: 80% 이상
- **컴포넌트**: 70% 이상

## 주의사항

1. **테스트 격리**: 각 테스트는 독립적이어야 합니다
2. **Mock 정리**: `beforeEach`, `afterEach`로 모킹 초기화
3. **비동기 처리**: `act()`, `waitFor()` 사용
4. **접근성 테스트**: `getByRole`, `getByLabelText` 우선 사용
