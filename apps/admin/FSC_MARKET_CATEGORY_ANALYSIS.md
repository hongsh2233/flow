# 금융위원회(FSC) 시가총액 200종목 코스피/코스닥 구분 분석

## 📊 분석 결과 요약

**✅ 코스피/코스닥 구분 가능**

금융위원회 API에서 제공하는 데이터에는 시장구분(`mrktCtg`) 필드가 포함되어 있어 코스피와 코스닥을 구분할 수 있습니다.

---

## 🔍 데이터 구조

### 1. 데이터베이스 모델 (`FscStockPrice`)
```python
mrkt_ctg = Column(String(20))  # 시장구분 (예: 'KOSPI', 'KOSDAQ')
```

### 2. API 응답 필드
- `mrktCtg`: 시장구분 (KOSPI, KOSDAQ, KONEX)
- `mrktTotAmt`: 시가총액 (정렬 기준)

### 3. 프론트엔드 타입 정의
```typescript
mrktCtg: string; // 시장구분 (KOSPI, KOSDAQ, KONEX)
```

---

## 🛠️ 현재 구현 상태

### ✅ 구분 가능한 엔드포인트

#### `/api/fsc-stock-price` (프론트엔드용)
- **위치**: `app/routers/api.py`
- **기능**: 시가총액 상위 종목 조회
- **시장구분 필터링**: ✅ 지원
  ```python
  mrkt_ctg: Optional[str] = Query(None, description="시장구분 (KOSPI, KOSDAQ)")
  ```
- **사용 예시**:
  - 코스피만: `/api/fsc-stock-price?mrkt_ctg=KOSPI&limit=200`
  - 코스닥만: `/api/fsc-stock-price?mrkt_ctg=KOSDAQ&limit=200`
  - 전체: `/api/fsc-stock-price?limit=200`

### ⚠️ 구분 없는 엔드포인트

#### `/api/stock-price` (관리자용)
- **위치**: `app/routers/fsc.py`
- **기능**: 시가총액 상위 200종목 조회
- **시장구분 필터링**: ❌ 미지원
- **현재 동작**: 전체 시장에서 시가총액 상위 200개만 반환 (코스피/코스닥 구분 없음)

---

## 📈 시가총액 200종목 구성 분석

### 예상 구성
- **코스피**: 대형주 중심 (삼성전자, SK하이닉스, 현대차 등)
- **코스닥**: 중소형/성장주 중심
- **실제 비율**: 코스피가 대부분을 차지할 것으로 예상 (시가총액 기준)

### 데이터 확인 방법
```python
# DB에서 시장구분별 시가총액 상위 200개 확인
# 코스피 상위 200개
kospi_top200 = db.query(FscStockPrice)\
    .filter(FscStockPrice.mrkt_ctg == 'KOSPI')\
    .order_by(cast(FscStockPrice.mrkt_tot_amt, Integer).desc())\
    .limit(200)\
    .all()

# 코스닥 상위 200개
kosdaq_top200 = db.query(FscStockPrice)\
    .filter(FscStockPrice.mrkt_ctg == 'KOSDAQ')\
    .order_by(cast(FscStockPrice.mrkt_tot_amt, Integer).desc())\
    .limit(200)\
    .all()
```

---

## 💡 개선 제안

### 1. `/api/stock-price` 엔드포인트 개선
현재 관리자용 엔드포인트에 시장구분 필터링 추가:

```python
@router.get("/api/stock-price")
async def get_stock_price(
    request: Request,
    page_no: int = 1,
    num_of_rows: int = 200,
    bas_dt: str = None,
    mrkt_ctg: Optional[str] = Query(None, description="시장구분 (KOSPI, KOSDAQ)"),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # ... 기존 코드 ...
    
    # 시장구분 필터링 추가
    if mrkt_ctg:
        filtered_data = [item for item in filtered_data if item.get('mrktCtg') == mrkt_ctg]
    
    # ... 나머지 코드 ...
```

### 2. 코스피/코스닥 각각 100개씩 반환 옵션
```python
# 코스피 100개 + 코스닥 100개 = 총 200개
kospi_data = [item for item in sorted_data if item.get('mrktCtg') == 'KOSPI'][:100]
kosdaq_data = [item for item in sorted_data if item.get('mrktCtg') == 'KOSDAQ'][:100]
```

### 3. 프론트엔드 표시 방식
- 네이버 랭킹과 동일하게 서브 탭으로 코스피/코스닥 구분
- 또는 코스피 100개 + 코스닥 100개로 각각 표시

---

## ✅ 결론

1. **데이터 구조**: ✅ 코스피/코스닥 구분 정보 포함 (`mrktCtg` 필드)
2. **프론트엔드 API**: ✅ 구분 가능 (`/api/fsc-stock-price`에 `mrkt_ctg` 파라미터)
3. **관리자 API**: ⚠️ 구분 미지원 (`/api/stock-price`에 필터링 없음)
4. **개선 필요**: 관리자용 엔드포인트에 시장구분 필터링 추가 권장

---

## 📝 참고사항

- 현재 `/api/fsc-stock-price`는 이미 시장구분 필터링을 지원하므로 프론트엔드에서는 사용 가능
- 관리자 페이지(`/admin/finance-data2`)에서도 코스피/코스닥 구분 표시가 필요하면 엔드포인트 개선 필요
- 네이버 랭킹과 동일한 UX를 제공하려면 서브 탭 방식 적용 권장

