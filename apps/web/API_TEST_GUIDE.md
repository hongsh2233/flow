# 공공데이터 API 테스트 가이드

## 1. 환경 설정

```bash
# .env.local 파일에 API 키 설정
DATA_GO_KR_API_KEY=your_decoded_api_key_here
```

## 2. 개발 서버 실행

```bash
npm run dev
```

## 3. API 테스트 방법

개발 서버 실행 후 브라우저나 curl로 다음 URL들을 테스트하세요:

### 테스트 1: crno로 기업 개요 조회
```
http://localhost:3000/api/test-company-api?type=outline&crno=1301110006246
```
**확인 사항**: crno 파라미터로 특정 기업 1건만 조회되는가?

### 테스트 2: 기업 개요 전체 목록 조회
```
http://localhost:3000/api/test-company-api?type=outline-all
```
**확인 사항**: 전체 기업 목록이 조회되는가? 몇 건이 조회되는가?

### 테스트 3: 기업명으로 검색
```
http://localhost:3000/api/test-company-api?type=outline-name&corpNm=삼성전자
```
**확인 사항**: 기업명으로 검색이 가능한가?

### 테스트 4: crno로 재무제표 조회
```
http://localhost:3000/api/test-company-api?type=finance&crno=1301110006246
```
**확인 사항**: crno 파라미터로 특정 기업의 재무제표만 조회되는가?

### 테스트 5: 재무제표 전체 목록 조회
```
http://localhost:3000/api/test-company-api?type=finance-all
```
**확인 사항**: 전체 기업의 재무제표가 조회되는가?

## 4. 응답 분석

각 테스트 응답에서 확인해야 할 항목:
- `resultCode`: "00"이면 성공
- `resultMsg`: 에러 메시지
- `totalCount`: 전체 건수
- `itemsCount`: 실제 조회된 건수
- `hasItems`: 데이터 존재 여부

## 5. 터미널 로그 확인

서버 터미널에서 상세한 API 응답을 확인할 수 있습니다:
```
========== 기업 개요 (crno 파라미터) 테스트 ==========
URL: http://apis.data.go.kr/...
응답: { ... }
========================================
```

## 6. 법인등록번호 (crno) 참고

- 삼성전자: 1301110006246
- 카카오: 1201110320167
- SK하이닉스: 1301110173407

## 7. 다음 단계

테스트 결과를 바탕으로:
1. **crno로 직접 조회 가능**: 현재 로직 유지
2. **전체 목록만 조회 가능**: 로직 수정 필요 (전체 조회 후 필터링)
3. **기업명으로만 검색 가능**: 로직 변경 (종목명 → 기업명 변환)
