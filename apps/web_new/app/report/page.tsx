import styles from "./Report.module.css";
import BoardList from "../components/module/board/BoardList";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";

export default function ReportPage() {
  return (
    <main className={styles.wrap}>
      <Tabs defaultValue="chart">
        <TabsList>
          <TabsTrigger value="chart">시황</TabsTrigger>
          <TabsTrigger value="report">리포트</TabsTrigger>
        </TabsList>
        <TabsContent value="chart">
          <BoardList />
        </TabsContent>
        <TabsContent value="report">
          <BoardList />
        </TabsContent>
      </Tabs>
    </main>
  )
}
