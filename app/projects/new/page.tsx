import ExamForm from "@/components/Exams/ExamForm"

export default function NewExamPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="mb-6 text-2xl font-semibold">新しい試験の作成</h1>
      <ExamForm />
    </div>
  )
}
