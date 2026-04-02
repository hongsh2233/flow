/**
 * 하단 네비게이션 등 앱 전역에서 쓰는 링크/메뉴는 config에서 불러옵니다.
 * 데이터: config/nav-items.json
 */
import Home from '@mui/icons-material/Home'
import CalendarToday from '@mui/icons-material/CalendarToday'
import Article from '@mui/icons-material/Article'
import TrendingUp from '@mui/icons-material/TrendingUp'
import CandlestickChart from '@mui/icons-material/CandlestickChart'
import Settings from '@mui/icons-material/Settings'
import navData from './nav-items.json'

type IconComponent = typeof Home

interface NavItemData {
  id: string
  label: string
  href: string
  headerTitle: string
  headerSubtitle: string
}

const iconMap: Record<string, IconComponent> = {
  home: Home,
  briefing: Article,
  calendar: CalendarToday,
  market: TrendingUp,
  stocks: CandlestickChart,
  settings: Settings,
}

export interface NavItem {
  id: string
  label: string
  href: string
  icon: IconComponent
  headerTitle: string
  headerSubtitle: string
}

export const navItems: NavItem[] = (navData as NavItemData[]).map((item) => ({
  ...item,
  icon: iconMap[item.id] ?? Home,
}))
