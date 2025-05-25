import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function DashboardPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="mb-6 text-2xl font-semibold">ダッシュボード</h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>あなたの採点状況</CardTitle>
          </CardHeader>
          <CardContent>
            <p>ここに採点進捗などの情報を表示します。</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>要対応タスク</CardTitle>
          </CardHeader>
          <CardContent>
            <p>保留中の答案やレビュー待ちの項目などを表示します。</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>最近の活動</CardTitle>
          </CardHeader>
          <CardContent>
            <p>最近の操作ログや通知などを表示します。</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
