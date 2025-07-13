import ProtectedRoute from "@/components/Auth/ProtectedRoute"
import StudentTable from "@/components/student/StudentTable"

export default function StudentsPage() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto p-4">
        <StudentTable />
      </div>
    </ProtectedRoute>
  )
}
