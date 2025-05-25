import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PlusCircle } from "lucide-react"
import ExamList from "@/components/Exams/ExamList" // 試験一覧コンポーネント

export default function ExamsPage() {
  return (
    <div className="container mx-auto p-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">試験管理</h1>
        <Button asChild>
          <Link href="/exams/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            新しい試験を作成
          </Link>
        </Button>
      </div>
      <ExamList />
    </div>
  )
}
