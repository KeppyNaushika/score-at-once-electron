import ProtectedRoute from "@/components/auth/ProtectedRoute"
import StudentManagementTable from "@/components/student/StudentManagementTable"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Info } from "lucide-react"

export default function StudentsPage() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto p-4">
        <div className="mb-6 flex items-center gap-2">
          <h1 className="text-2xl font-semibold">生徒・学級管理</h1>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="rounded-full p-1 transition-colors hover:bg-gray-100"
                aria-label="複数学級対応システムについての詳細情報"
              >
                <Info className="h-4 w-4 text-blue-600" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              className="max-w-sm p-4"
              side="bottom"
              align="start"
            >
              <div>
                <h3 className="mb-2 text-sm font-medium text-gray-900">
                  📚 複数学級対応システム
                </h3>
                <p className="mb-2 text-xs text-gray-700">
                  このシステムでは、生徒は複数の学級に同時に所属できます。
                  ホームルーム、教科別クラス、習熟度別クラスなど、様々な学級タイプに対応しています。
                </p>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>
                    • 🏠 <strong>ホームルーム</strong>: 担任クラス（1年A組など）
                  </li>
                  <li>
                    • 📖 <strong>教科別クラス</strong>:
                    数学、英語などの教科別編成
                  </li>
                  <li>
                    • 📊 <strong>習熟度別クラス</strong>: 能力に応じた編成
                  </li>
                  <li>
                    • ⭐ <strong>特別クラス</strong>: 補習、発展クラスなど
                  </li>
                </ul>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
        <StudentManagementTable />
      </div>
    </ProtectedRoute>
  )
}
