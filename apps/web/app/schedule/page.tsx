'use client'

import * as React from 'react'
import { useState, useEffect } from 'react'
import PageTitle from '../components/element/PageTitle'
import Calendar from '../components/module/Calendar/Calendar'
// 실제 API 호출을 위한 서비스 함수와 타입 임포트
import { fetchSchedules } from '@/lib/services/scheduleService'

export default function Scadule() {
  // 상태 관리를 위한 useState 설정
  const [schedules, setSchedules] = useState<{ date: string; title: string; content?: string; type?: string }[]>(
    []
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSchedules = async () => {
      try {
        setLoading(true)
        // 1. BO 서버의 일정 API 호출
        const response = await fetchSchedules()

        if (response.success && response.data) {
          // 보안: 일정 데이터 상세 정보는 콘솔에 출력하지 않음
          console.log('=== 일정 데이터 로드 완료 ===')
          console.log('일정 개수:', response.data.length)
          
          // 백엔드에서 type 필드와 content 필드를 그대로 전달
          const formattedSchedules = response.data.map((item: any) => {
            return {
              date: item.date,
              title: item.subject || item.title,
              content: item.content || '',  // content 필드 명시적으로 포함
              type: item.type || 'manual',  // 백엔드의 type 필드 그대로 전달 ("api" 또는 "manual")
            }
          })
          
          console.log('포맷팅된 일정 개수:', formattedSchedules.length)
          console.log('type="api"인 일정 개수:', formattedSchedules.filter(s => s.type === "api").length)
          setSchedules(formattedSchedules)
        }
      } catch (error) {
        console.error('일정 데이터를 가져오는데 실패했습니다:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSchedules()
  }, [])

  // 로딩 상태 처리
  if (loading) {
    return (
      <div className="content__wrap">
        <div style={{ padding: '20px', textAlign: 'center' }}>
          일정을 불러오는 중...
        </div>
      </div>
    )
  }

  return (
    <div className="content__wrap">
      <PageTitle label="일정 관리" />
      {/* API에서 받아온 실시간 데이터를 캘린더에 적용 */}
      <Calendar schedules={schedules} />
    </div>
  )
}
