import { useEffect, useState } from "react"

import type { ClassroomStudentExamResult } from "@/electron-src/lib/prisma/student"

export function useClassroomExamResults(classroomId: string) {
  const [studentResults, setStudentResults] = useState<
    ClassroomStudentExamResult[]
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
