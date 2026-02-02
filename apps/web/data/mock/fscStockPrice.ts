import type { FscStockPrice } from '@/lib/types/api'

export const mockFscStockPrice: FscStockPrice[] = [
  {
    id: 1,
    bas_dt: '20251230',
    srtn_cd: '005930',
    itms_nm: '삼성전자',
    mrkt_tot_amt: '500000000000',
    clpr: '75000',
    flt_rt: '1.5',
    crno: '1301110006246', // 삼성전자 법인등록번호
  },
  {
    id: 2,
    bas_dt: '20251230',
    srtn_cd: '035720',
    itms_nm: '카카오',
    mrkt_tot_amt: '300000000000',
    clpr: '48200',
    flt_rt: '-0.8',
    crno: '1201110320167', // 카카오 법인등록번호
  },
  {
    id: 3,
    bas_dt: '20251230',
    srtn_cd: '000660',
    itms_nm: 'SK하이닉스',
    mrkt_tot_amt: '200000000000',
    clpr: '128000',
    flt_rt: '2.5',
    crno: '1301110173407', // SK하이닉스 법인등록번호
  },
]

export const mockFscDates: string[] = [
  '20251230',
  '20251229',
  '20251228',
]

