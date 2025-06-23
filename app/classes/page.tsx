import ProtectedRoute from "@/components/auth/ProtectedRoute"
import ClassManagementTable from "@/components/class/ClassManagementTable"

export default function ClassesPage() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">学級管理</h1>
        </div>
        <ClassManagementTable />
      </div>
    </ProtectedRoute>
  )
}