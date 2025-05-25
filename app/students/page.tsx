import StudentManagementTable from "@/components/Students/StudentManagementTable"

export default function StudentsPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="mb-6 text-2xl font-semibold">生徒・学級管理</h1>
      <StudentManagementTable />
    </div>
  )
}
