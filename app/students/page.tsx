import ProtectedRoute from "@/components/auth/ProtectedRoute"
import StudentManagementTableV2 from "@/components/student/StudentManagementTableV2"

export default function StudentsPage() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto p-4">
        <h1 className="mb-6 text-2xl font-semibold">生徒・学級管理</h1>
        <div className="space-y-4">
          <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
            <h2 className="text-lg font-medium text-blue-900 mb-2">
              📚 複数学級対応システム
            </h2>
            <p className="text-blue-800 text-sm">
              このシステムでは、生徒は複数の学級に同時に所属できます。
              ホームルーム、教科別クラス、習熟度別クラスなど、様々な学級タイプに対応しています。
            </p>
            <ul className="mt-2 text-xs text-blue-700 space-y-1">
              <li>• 🏠 <strong>ホームルーム</strong>: 担任クラス（1年A組など）</li>
              <li>• 📖 <strong>教科別クラス</strong>: 数学、英語などの教科別編成</li>
              <li>• 📊 <strong>習熟度別クラス</strong>: 能力に応じた編成</li>
              <li>• ⭐ <strong>特別クラス</strong>: 補習、発展クラスなど</li>
            </ul>
          </div>
          <StudentManagementTableV2 />
        </div>
      </div>
    </ProtectedRoute>
  )
}
