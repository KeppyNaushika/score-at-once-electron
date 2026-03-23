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

export function useStudentExamResults(studentId: string) {
  const [results, setResults] = useState<ExamResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const data = await window.electronAPI.getStudentExamResults(studentId)
        setResults(data)
      } catch (error) {
        console.error("Failed to fetch exam results:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchResults()
  }, [studentId])

  return { results, loading }
}
