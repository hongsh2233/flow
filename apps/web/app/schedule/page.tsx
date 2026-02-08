'use client'

import * as React from 'react'
import { useState, useEffect, Suspense } from 'react'
import PageTitle from '../components/element/PageTitle'
import Calendar from '../components/module/Calendar/Calendar'
import { fetchSchedules } from '@/lib/services/scheduleService'
import { fetchNavMenu } from '@/lib/services/navMenuService'

function ScheduleContent() {
  const [schedules, setSchedules] = useState<{ date: string; title: string; content?: string; type?: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [pageTitle, setPageTitle] = useState<string>('캘린더')

  // 백엔드에서 메뉴 이름 가져오기
  useEffect(() => {
    fetchNavMenu().then((items) => {
      const scheduleItem = items.find(item => 
        item.link === '/schedule' || 
        item.linkValue === '/schedule' ||
        (item.linkType === 'page' && item.linkValue === '/schedule')
      )
      if (scheduleItem) {
        setPageTitle(scheduleItem.name)
      }
    }).catch(() => {
      // 에러 발생 시 기본값 유지
    })
  }, [])

  useEffect(() => {
    const loadSchedules = async () => {
      try {
        setLoading(true)
        const response = await fetchSchedules()

        if (response.success && response.data) {
          const formattedSchedules = response.data.map((item: any) => {
            return {
              date: item.date,
              title: item.subject || item.title,
              content: item.content || '',
              type: item.type || 'manual',
            }
          })
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

  if (loading) {
    return (
      <div className="content__wrap">
        <PageTitle label={pageTitle} />
        <div style={{ padding: '20px', textAlign: 'center' }}>
          일정을 불러오는 중...
        </div>
      </div>
    )
  }

  return (
    <div className="content__wrap">
      <PageTitle label={pageTitle} />
      <Calendar schedules={schedules} />
    </div>
  )
}

export default function Scadule() {
  return (
    <Suspense fallback={<div className="content__wrap"><PageTitle label="캘린더" /></div>}>
      <ScheduleContent />
    </Suspense>
  )
}
