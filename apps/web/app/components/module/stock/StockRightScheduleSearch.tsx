'use client'

import * as React from 'react'
import { useState, useCallback } from 'react'
import { fetchRightSchedule } from '@/lib/services/rightScheduleService'
import type { RightScheduleItem } from '@/lib/types/api'
import styles from './StockRightScheduleSearch.module.css'

const COLUMN_LABELS: Record<string, string> = {
  basDt: '기준일자',
  issuCmpyKsdCustNo: '발행회사 KSD고객번호',
  stckIssuCmpyNm: '주식발행회사명',
  crno: '법인등록번호',
  rgtExertSttgDt: '권리행사시작일자',
  rgtExertEdDt: '권리행사종료일자',
  stckStacMd: '주식결산월일',
  nmlsLckSttgDt: '명부폐쇄시작일자',
  nmlsLckEdDt: '명부폐쇄종료일자',
  rgtExertRcdNm: '권리행사사유코드명',
  stckIssuRcdNm: '주식발행사유코드명',
  stckParPrc: '주식액면가',
  scrsIssuMnbdCdNm: '유가증권발행주체코드명',
}

function formatCellValue(val: string | undefined): string {
  if (val === undefined || val === null) return '-'
  return String(val).trim() || '-'
}

export default function StockRightScheduleSearch() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<RightScheduleItem[]>([])
  const [latestBasDt, setLatestBasDt] = useState<string | null>(null)
  const [count, setCount] = useState(0)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const q = query.trim()
      setHasSearched(true)
      if (!q) {
        setError('주식발행회사명 또는 법인등록번호를 입력한 뒤 조회 버튼을 눌러 주세요.')
        setData([])
        setCount(0)
        setLatestBasDt(null)
        return
      }
      setError(null)
      setLoading(true)
      try {
        const res = await fetchRightSchedule(q)
        if (res.error) {
          setError(res.error)
          setData([])
          setCount(0)
          setLatestBasDt(null)
        } else {
          setData(res.data || [])
          setCount(res.count ?? res.data?.length ?? 0)
          setLatestBasDt(res.latest_bas_dt ?? null)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '조회 중 오류가 발생했습니다.')
        setData([])
        setCount(0)
        setLatestBasDt(null)
      } finally {
        setLoading(false)
      }
    },
    [query]
  )

  const columns = React.useMemo(() => {
    if (data.length === 0) return []
    const keys = Object.keys(data[0]).filter((k) => data[0][k] !== undefined && data[0][k] !== '')
    return keys
  }, [data])

  return (
    <div className={styles.wrap}>
      <p className={styles.desc}>
        주식발행회사명 또는 법인등록번호를 입력한 뒤 <strong>조회</strong> 버튼을 눌러 권리행사일정을 조회합니다. 최신일 기준 20건까지 표시됩니다.
      </p>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="right-schedule-query" className={styles.label}>
            주식발행회사명 또는 법인등록번호
          </label>
          <input
            id="right-schedule-query"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="예: CJ씨푸드, 삼성전자 또는 1101110215578"
            disabled={loading}
            className={styles.input}
          />
        </div>
        <button type="submit" disabled={loading} className={styles.searchBtn}>
          {loading ? '조회 중...' : '조회'}
        </button>
      </form>

      {hasSearched && error && (
        <div className={styles.errorBox} role="alert">
          {error}
        </div>
      )}

      {hasSearched && !error && data.length > 0 && (
        <>
          <div className={styles.infoBar}>
            {latestBasDt ? `최신일(${latestBasDt}) 기준 ${count}건 표시` : `${count}건`}
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {columns.map((key) => (
                    <th key={key}>{COLUMN_LABELS[key] ?? key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr key={idx}>
                    {columns.map((key) => (
                      <td key={key}>{formatCellValue(row[key])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {hasSearched && !error && !loading && data.length === 0 && query.trim() && (
        <div className={styles.noData}>
          조회 결과가 없습니다. 회사명 또는 법인등록번호를 확인해 보세요.
        </div>
      )}
    </div>
  )
}
