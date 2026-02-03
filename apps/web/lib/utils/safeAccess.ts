/**
 * 안전한 데이터 접근 및 포맷 유틸리티
 */

/**
 * 객체에서 여러 키 중 첫 번째로 존재하는 값을 반환
 */
export function safeGetString(
  obj: Record<string, unknown> | object,
  keys: string[],
  fallback = '-'
): string {
  const record = obj as Record<string, unknown>
  for (const key of keys) {
    const val = record[key]
    if (val !== undefined && val !== null && val !== '') {
      return String(val)
    }
  }
  return fallback
}

/**
 * 날짜 문자열 포맷 (YYYYMMDD 또는 YYYY-MM-DD → YYYY년 M월 D일)
 */
export function formatDate(value: string | Date): string {
  if (!value) return '-'
  const str = typeof value === 'string' ? value : value.toISOString().slice(0, 10)
  const cleaned = str.replace(/-/g, '')
  if (cleaned.length >= 8) {
    const y = cleaned.slice(0, 4)
    const m = cleaned.slice(4, 6).replace(/^0+/, '') || '1'
    const d = cleaned.slice(6, 8).replace(/^0+/, '') || '1'
    return `${y}년 ${m}월 ${d}일`
  }
  return str
}

/**
 * 숫자 포맷 (천 단위 구분자)
 */
export function formatNumber(value: string | number | null | undefined): string {
  if (value === undefined || value === null || value === '') return '-'
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : Number(value)
  if (isNaN(num)) return '-'
  return num.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
}

/**
 * 금액 포맷 (억 단위)
 */
export function formatAmount(value: string | number | null | undefined): string {
  if (value === undefined || value === null || value === '') return '-'
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : Number(value)
  if (isNaN(num) || num === 0) return '-'
  const eok = num / 100000000
  return `${eok.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}억원`
}

/**
 * 등락률/대비 값에 따른 색상 반환 (상승: 빨강, 하락: 파랑)
 */
export function getRateColor(value: string | number | null | undefined): string {
  if (value === undefined || value === null || value === '') return ''
  const str = String(value)
  if (str.startsWith('+') || (parseFloat(str) > 0)) return '#e74c3c' // 상승: 빨강
  if (str.startsWith('-') || parseFloat(str) < 0) return '#3498db' // 하락: 파랑
  return ''
}
