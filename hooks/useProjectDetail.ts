"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

interface ProjectData {
  id: string
  examName: string
  description: string | null
  examDate: Date | null
  subject: string | null
  createdAt: Date
  updatedAt: Date
  userId: string
  masterImages?: any[]
  answerSheets?: any[]
  layoutRegions?: any[]
}

export function useProjectDetail(projectId: string) {
  const [project, setProject] = useState<ProjectData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [studentCount, setStudentCount] = useState(0)
  const [questionRegionCount, setQuestionRegionCount] = useState(0)

  const loadProject = useCallback(async () => {
    if (!projectId) return

    try {
      setIsLoading(true)
      const result = await window.electronAPI.fetchProjectById(projectId)

      if (result) {
        setProject(result)
        
        // 生徒数を取得
        const studentsResult = await window.electronAPI.getStudentsForProject(projectId)
        if (studentsResult.success) {
          setStudentCount(studentsResult.students?.length || 0)
        }

        // 設問領域数を取得
        const regionsResult = await window.electronAPI.getLayoutRegionsByProjectId(projectId)
        if (Array.isArray(regionsResult)) {
          const questionRegions = regionsResult.filter(
            region => region.type === "QUESTION_ANSWER" && (region.orderIndex || region.label)
          )
          setQuestionRegionCount(questionRegions.length)
        }
      } else {
        toast.error("プロジェクトが見つかりません")
        return false
      }
    } catch (error) {
      console.error("Error loading project:", error)
      toast.error("プロジェクトの読み込みに失敗しました")
      return false
    } finally {
      setIsLoading(false)
    }
    return true
  }, [projectId])

  const updateProject = useCallback(async (projectData: any) => {
    if (!project) return false

    try {
      const updatedProject = await window.electronAPI.updateProject(
        project.id,
        {
          examName: projectData.examName,
          description: projectData.description,
          examDate: projectData.examDate,
          subject: projectData.subject,
        },
      )
      setProject(updatedProject)
      toast.success("プロジェクトを更新しました")
      return true
    } catch (error) {
      console.error("Failed to update project:", error)
      toast.error("プロジェクトの更新に失敗しました")
      return false
    }
  }, [project])

  useEffect(() => {
    loadProject()
  }, [loadProject])

  const masterImageCount = project?.masterImages?.length || 0
  const answerSheetCount = project?.answerSheets?.length || 0
  const layoutRegionCount = project?.layoutRegions?.length || 0

  return {
    project,
    isLoading,
    studentCount,
    questionRegionCount,
    masterImageCount,
    answerSheetCount,
    layoutRegionCount,
    loadProject,
    updateProject,
  }
}