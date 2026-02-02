'use client'

import React, { useState, useEffect } from 'react'

interface IconProps {
  name: string
  className?: string
  width?: number | string
  height?: number | string
}

/**
 * SVG 아이콘을 동적으로 로드하여 다크모드에서 색상을 제어할 수 있도록 하는 컴포넌트
 */
export default function Icon({ name, className = '', width = 24, height = 24 }: IconProps) {
  const [svgContent, setSvgContent] = useState<string>('')

  useEffect(() => {
    const loadSvg = async () => {
      try {
        const response = await fetch(`/image/icon/${name}.svg`)
        const text = await response.text()
        
        // SVG의 fill 속성을 currentColor로 변경
        const modifiedSvg = text
          .replace(/fill="#[^"]+"/g, 'fill="currentColor"')
          .replace(/fill='#[^']+'/g, "fill='currentColor'")
        
        setSvgContent(modifiedSvg)
      } catch (error) {
        console.error(`Failed to load icon: ${name}`, error)
      }
    }

    if (name) {
      loadSvg()
    }
  }, [name])

  if (!svgContent) {
    return null
  }

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', width, height }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  )
}
