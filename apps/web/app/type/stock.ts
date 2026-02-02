// src/types/stock.ts (또는 types/stock.ts)

// 1. 실제 주식 데이터를 담는 항목 타입
export interface StockItem {
    basDt: string; // 기준일자 (YYYYMMDD)
    crno: string; // 법인등록번호
    corpNm: string; // 법인명
    srvNm: string; // 종목명
    srtnCd: string; // 종목코드 (단축)
    itmsNm: string; // 종목명
    mrktCtg: string; // 시장구분 (KOSPI, KOSDAQ, KONEX)
    clpr: string; // 종가
    vs: string; // 전일 대비
    fltRt: string; // 등락률 (%)
    mkp: string; // 시가
    hipr: string; // 고가
    lopr: string; // 저가
    trqu: string; // 거래량
    trPrc: string; // 거래대금
    lstgStCnt: string; // 상장 주식 수
    mrktTotAmt: string; // 시가총액
}

// 2. 공공데이터 포털 API 응답의 복잡한 구조를 타입으로 정의
interface ApiResponse {
    response: {
        header: {
            resultCode: string;
            resultMsg: string;
        };
        body: {
            items: {
            item: StockItem[]; // 핵심 데이터 배열
            };
            numOfRows: number;
            pageNo: number;
            totalCount: number;
        };
    };
}

  // 3. 클라이언트에 보낼 최종 응답 타입
export interface StockResponse {
    success: boolean;
    message: string;
    data: StockItem[];
    retryable?: boolean; // 재시도 가능 여부 (데이터 없음 등)
    meta?: {
        totalCount: number;
        pageNo: number;
        numOfRows?: number;
    }
}