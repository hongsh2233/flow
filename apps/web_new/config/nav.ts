/**
 * 하단 네비게이션 등 앱 전역에서 쓰는 링크/메뉴는 config에서 불러옵니다.
 * 데이터: config/nav-items.json
 */
import {
  Home,
  CalendarToday,
  Article,
  Description,
  FolderOpen,
  Settings,
} from '@mui/icons-material'
import navData from './nav-items.json'

type IconComponent = typeof Home

const iconMap: Record<string, IconComponent> = {
  home: Home,
  calendar: CalendarToday,
  news: Article,
  market: Description,
  stocks: FolderOpen,
  settings: Settings,
}

export interface NavItem {
  id: string
  label: string
  href: string
  icon: IconComponent
}

export const navItems: NavItem[] = (navData as { id: string; label: string; href: string }[]).map(
  (item) => ({
    ...item,
    icon: iconMap[item.id] ?? Home,
  })
)
