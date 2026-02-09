// @ts-nocheck
import styles from './News.module.css'
import NewsList from '../components/module/NewsList'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'

export const metadata = {
  title: '뉴스 | 주리니',
  description: '주식·경제 뉴스를 확인하세요.',
}

export default function NewsPage() {
  return (
    <main className={styles.wrap}>
      <Tabs defaultValue="news">
        <TabsList>
          <TabsTrigger value="news">뉴스</TabsTrigger>
          <TabsTrigger value="favorite">관심뉴스</TabsTrigger>
        </TabsList>
        <TabsContent value="news">          
          <NewsList />
        </TabsContent>
        <TabsContent value="favorite">
          <NewsList />
        </TabsContent>
      </Tabs>
    </main>
  )
}
