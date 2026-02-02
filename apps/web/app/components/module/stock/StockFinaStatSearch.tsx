'use client'

import * as React from 'react'
import { useState, useCallback } from 'react'
import { fetchFinaStat } from '@/lib/services/finaStatService'
import type { FinaStatType } from '@/lib/types/api'
import styles from './StockFinaStatSearch.module.css'

const TYPE_LABELS: Record<FinaStatType, string> = {
  summ: '요약재무제표',
  bs: '재무상태표',
  inco: '손익계산서',
}

// 필드명 한글 매핑
function formatColumnName(key: string): string {
  const columnMap: Record<string, string> = {
    // 재무제표 기본 필드
    'bizYear': '사업연도',
    'fnclDcd': '재무제표구분',
    'fnclDcdNm': '재무제표구분명',
    'enpSzNm': '기업규모명',
    'accnutFcltyTpcd': '회계기준유형코드',
    'accnutFcltyTpcdNm': '회계기준유형명',
    'accnutOblgPfmcRlncd': '회계의무수행관련코드',
    'accnutOblgPfmcRlncdNm': '회계의무수행관련명',
    'frmNm': '계정과목명',
    'amt': '금액',
    'frmCd': '계정과목코드',
    // 현금흐름표 활동별 필드
    'acitId': '활동ID',
    'acitNm': '활동명',
    'thqrAcitAmt': '당기 활동 금액',
    'crtmAcitAmt': '당기 활동 금액',
    'lsqtAcitAmt': '전기 활동 금액',
    'pvtrAcitAmt': '전년 동기 활동 금액',
    'bpvtrAcitAmt': '전년 동기 전 활동 금액',
    'curCd': '통화 코드',
    // 재무제표 추가 필드
    'npSaleAmt': '순매출액',
    'enpBzopPft': '기업 영업이익',
    'iclsPalClcAmt': '포괄손익계산 금액',
    'enpCrtmNpf': '기업 당기 순이익',
    'enpTastAmt': '기업 총자산 금액',
    'enpTdbtAmt': '기업 총부채 금액',
    'enpTcptAmt': '기업 총자본 금액',
    'enpCptlAmt': '기업 자본금액',
    'fnclDebtRto': '재무 부채비율',
  }
  return columnMap[key] || key
}

// 금액 필드 포맷팅 (억 단위, 천 단위 구분자)
function formatAmountValue(key: string, val: unknown): string {
  if (val === undefined || val === null || val === '') return '-'
  
  const amountFields = [
    'amt', 'thqrAcitAmt', 'crtmAcitAmt', 'lsqtAcitAmt', 'pvtrAcitAmt', 'bpvtrAcitAmt',
    'npSaleAmt', 'enpBzopPft', 'iclsPalClcAmt', 'enpCrtmNpf', 
    'enpTastAmt', 'enpTdbtAmt', 'enpTcptAmt', 'enpCptlAmt', 'fnclDebtRto'
  ]
  
  if (amountFields.includes(key)) {
    const numValue = typeof val === 'string' ? parseFloat(val) : Number(val)
    if (!isNaN(numValue) && numValue !== 0) {
      const eokValue = numValue / 100000000
      return eokValue.toLocaleString('ko-KR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }) + '억원'
    }
  }
  
  return String(val).trim() || '-'
}

function formatCellValue(key: string, val: unknown): string {
  if (val === undefined || val === null || val === '') return '-'
  
  // 금액 필드는 포맷팅 적용
  const formatted = formatAmountValue(key, val)
  if (formatted !== '-') return formatted
  
  return String(val).trim() || '-'
}

function DataTable({ data }: { data: Record<string, unknown>[] }) {
  if (!data || data.length === 0) return null
  const columns = Object.keys(data[0]).filter((k) => data[0][k] !== undefined && data[0][k] !== '')
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((key) => (
              <th key={key}>{formatColumnName(key)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx}>
              {columns.map((key) => (
                <td key={key}>{formatCellValue(key, row[key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function StockFinaStatSearch() {
  const [crno, setCrno] = useState('')
  const [bizYear, setBizYear] = useState('')
  const [typeSumm, setTypeSumm] = useState(false)
  const [typeBs, setTypeBs] = useState(false)
  const [typeInco, setTypeInco] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    summ?: { data: Record<string, unknown>[] }
    bs?: { data: Record<string, unknown>[] }
    inco?: { data: Record<string, unknown>[] }
  } | null>(null)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setHasSearched(true)
      const types: FinaStatType[] = []
      if (typeSumm) types.push('summ')
      if (typeBs) types.push('bs')
      if (typeInco) types.push('inco')

      if (!crno.trim() || !bizYear.trim()) {
        setError('법인등록번호와 사업연도를 입력해 주세요.')
        setResult(null)
        return
      }
      if (types.length === 0) {
        setError('조회할 항목(요약재무제표, 재무상태표, 손익계산서)을 하나 이상 체크해 주세요.')
        setResult(null)
        return
      }

      setError(null)
      setLoading(true)
      try {
        const res = await fetchFinaStat(crno.trim(), bizYear.trim(), types)
        if (res.error) {
          setError(res.error)
          setResult(null)
        } else {
          setResult(res.result || null)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '조회 중 오류가 발생했습니다.')
        setResult(null)
      } finally {
        setLoading(false)
      }
    },
    [crno, bizYear, typeSumm, typeBs, typeInco]
  )

  return (
    <div className={styles.wrap}>
      <p className={styles.desc}>
        법인등록번호·사업연도로 재무제표를 조회합니다. <strong>조회할 항목을 체크</strong>한 뒤 조회하세요.
      </p>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field} style={{ width: 160 }}>
          <label htmlFor="fina-stat-crno" className={styles.label}>
            법인등록번호
          </label>
          <input
            id="fina-stat-crno"
            type="text"
            value={crno}
            onChange={(e) => setCrno(e.target.value)}
            placeholder="예: 1101110215578"
            maxLength={13}
            disabled={loading}
            className={styles.input}
          />
        </div>
        <div className={styles.field} style={{ width: 100 }}>
          <label htmlFor="fina-stat-biz-year" className={styles.label}>
            사업연도
          </label>
          <input
            id="fina-stat-biz-year"
            type="text"
            value={bizYear}
            onChange={(e) => setBizYear(e.target.value)}
            placeholder="예: 2024"
            maxLength={4}
            disabled={loading}
            className={styles.input}
          />
        </div>
        <div className={styles.checkboxGroup}>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={typeSumm} onChange={(e) => setTypeSumm(e.target.checked)} /> 요약재무제표
          </label>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={typeBs} onChange={(e) => setTypeBs(e.target.checked)} /> 재무상태표
          </label>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={typeInco} onChange={(e) => setTypeInco(e.target.checked)} /> 손익계산서
          </label>
        </div>
        <button type="submit" disabled={loading} className={styles.searchBtn}>
          {loading ? '조회 중...' : '조회'}
        </button>
      </form>

      {hasSearched && error && <div className={styles.errorBox} role="alert">{error}</div>}

      {hasSearched && !error && result && (
        <>
          {result.summ && result.summ.data.length > 0 && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>{TYPE_LABELS.summ} ({result.summ.data.length}건)</h4>
              <DataTable data={result.summ.data} />
            </div>
          )}
          {result.bs && result.bs.data.length > 0 && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>{TYPE_LABELS.bs} ({result.bs.data.length}건)</h4>
              <DataTable data={result.bs.data} />
            </div>
          )}
          {result.inco && result.inco.data.length > 0 && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>{TYPE_LABELS.inco} ({result.inco.data.length}건)</h4>
              <DataTable data={result.inco.data} />
            </div>
          )}
          {(!result.summ?.data?.length && !result.bs?.data?.length && !result.inco?.data?.length) && (
            <div className={styles.noData}>선택한 항목에 대한 데이터가 없습니다.</div>
          )}
        </>
      )}
    </div>
  )
}
