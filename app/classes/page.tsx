import ProtectedRoute from "@/components/Auth/ProtectedRoute"
import ClassManagementTable from "@/components/class/ClassManagementTable"

export default function ClassesPage() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto p-4">
        <ClassManagementTable />
      </div>
    </ProtectedRoute>
  )
}