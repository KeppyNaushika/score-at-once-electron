import ProtectedRoute from "@/components/auth/ProtectedRoute"
import StudentManagementTable from "@/components/student/StudentManagementTable"

export default function StudentsPage() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto p-4">
        <h1 className="mb-6 text-2xl font-semibold">生徒・学級管理</h1>
        <StudentManagementTable />
      </div>
    </ProtectedRoute>
  )
}
