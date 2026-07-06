import { useEffect, useState } from "react"

import type { StudentExamResult } from "@/electron-src/lib/prisma/student"

export function useStudentExamResults(studentId: string) {
  const [results, setResults] = useState<StudentExamResult[]>([])
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
