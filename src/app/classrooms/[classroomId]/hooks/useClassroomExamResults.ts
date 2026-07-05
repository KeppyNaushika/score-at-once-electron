import { useEffect, useState } from "react"

export interface SubtotalScoreResult {
  subtotalId: string
  subtotalName: string
  subtotalGroupId: string
  subtotalGroupName: string
  score: number
  maxScore: number
}

export interface ExamResult {
  examId: string
  examName: string
  examDate: Date | null
  tags: string[]
  totalScore: number
  maxScore: number
  scoredCount: number
  totalQuestions: number
  status: "complete" | "partial" | "unscored"
  subtotalScores: SubtotalScoreResult[]
}

export interface ClassroomStudentResult {
  studentId: string
  studentNumber: string
  studentName: string
  attendanceNumber: number | null
  examResults: ExamResult[]
}

export function useClassroomExamResults(classroomId: string) {
  const [studentResults, setStudentResults] = useState<
    ClassroomStudentResult[]
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const data =
          await window.electronAPI.getClassroomExamResults(classroomId)
        setStudentResults(data)
      } catch (error) {
        console.error("Failed to fetch class exam results:", error)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [classroomId])

  return { studentResults, loading }
}
