'use client'

import React, { useState, useEffect } from 'react'
// Import Swiper React components
import { Swiper, SwiperSlide } from 'swiper/react'

// import required modules
import { Pagination } from 'swiper/modules'
import { getImageUrl } from '@/lib/config/api'

interface Banner {
  id: number
  type: string
  image_url: string
  link_url: string | null
  alt_text: string | null
  order_index: number
}

interface BannerResponse {
  success: boolean
  data: Banner[]
  count: number
  error?: string
}

export default function BasicSwiper() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/banners?type=banner')

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result: BannerResponse = await response.json()

        if (result.success && result.data) {
          setBanners(result.data)
        } else {
          setBanners([])
        }
      } catch (error) {
        console.error('배너 가져오기 실패:', error)
        setBanners([])
      } finally {
        setLoading(false)
      }
    }

    fetchBanners()
  }, [])

  const pagination = {
    clickable: true,
  }

  if (loading) {
    return (
      <div className="swiper__wrap">
        <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
          배너를 불러오는 중...
        </div>
      </div>
    )
  }

  if (banners.length === 0) {
    return null // 배너가 없으면 아무것도 표시하지 않음
  }

  return (
    <div className="swiper__wrap">
      <Swiper pagination={pagination} modules={[Pagination]} className="mySwiper">
        {banners.map((banner) => {
          const imageUrl = getImageUrl(banner.image_url)
          const slideContent = (
            <img
              src={imageUrl}
              alt={banner.alt_text || '배너'}
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                objectFit: 'cover',
              }}
            />
          )

          return (
            <SwiperSlide key={banner.id}>
              {banner.link_url ? (
                <a
                  href={banner.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'block' }}
                >
                  {slideContent}
                </a>
              ) : (
                slideContent
              )}
            </SwiperSlide>
          )
        })}
      </Swiper>
    </div>
  )
}
