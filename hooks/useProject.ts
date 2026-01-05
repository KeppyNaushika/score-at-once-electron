"use client"

import { useState, useCallback, useEffect } from "react"
import { Project, MasterImage, CropRegion, Prisma } from "@prisma/client"
import { toast } from "sonner"

export type ProjectWithDetails = Project & {
  projectPages?: Array<{
    id: string
    pageNumber: number
    masterImages: MasterImage[]
  }>
  cropRegions?: CropRegion[]
}

export interface ProjectStatus {
  hasMasterImages: boolean
  hasCropRegions: boolean
  hasStudentAnswers: boolean
  isGradingComplete: boolean
  nextStep:
    | "master-images"
    | "crop-regions"
    | "student-answers"
    | "grading"
    | "complete"
  progress: number
}

export function useProject(projectId?: string) {
  const [project, setProject] = useState<ProjectWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const calculateProjectStatus = useCallback(
    (project: ProjectWithDetails): ProjectStatus => {
      const hasMasterImages =
        project.projectPages?.some((page) => page.masterImages.length > 0) ??
        false
      const hasCropRegions = (project.cropRegions?.length ?? 0) > 0
      const hasStudentAnswers = false // TODO: Implement when student answers are added
      const isGradingComplete = false // TODO: Implement when grading is added

      let nextStep: ProjectStatus["nextStep"] = "master-images"
      let progress = 0

      if (!hasMasterImages) {
        nextStep = "master-images"
        progress = 0
      } else if (!hasCropRegions) {
        nextStep = "crop-regions"
        progress = 25
      } else if (!hasStudentAnswers) {
        nextStep = "student-answers"
        progress = 50
      } else if (!isGradingComplete) {
        nextStep = "grading"
        progress = 75
      } else {
        nextStep = "complete"
        progress = 100
      }

      return {
        hasMasterImages,
        hasCropRegions,
        hasStudentAnswers,
        isGradingComplete,
        nextStep,
        progress,
      }
    },
    []
  )

  const fetchProject = useCallback(async (id: string) => {
    if (!id) return

    setIsLoading(true)
    setError(null)

    try {
      const fetchedProject = await window.electronAPI.fetchProjectById(id)
      if (fetchedProject) {
        setProject(fetchedProject)
      } else {
        setError("プロジェクトが見つかりません")
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "プロジェクトの読み込みに失敗しました"
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const updateProject = useCallback(
    async (updates: Prisma.ProjectUpdateInput) => {
      if (!project?.id) return

      try {
        const updatedProject = await window.electronAPI.updateProject(
          project.id,
          updates
        )
        setProject((prev) => (prev ? { ...prev, ...updatedProject } : null))
        return updatedProject
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "プロジェクトの更新に失敗しました"
        setError(errorMessage)
        toast.error(errorMessage)
        throw err
      }
    },
    [project]
  )

  const deleteProject = useCallback(async () => {
    if (!project) return

    try {
      await window.electronAPI.deleteProject(project.id)
      setProject(null)
      toast.success("プロジェクトを削除しました")
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "プロジェクトの削除に失敗しました"
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    }
  }, [project])

  const refreshProject = useCallback(() => {
    if (project) {
      fetchProject(project.id)
    }
  }, [project, fetchProject])

  useEffect(() => {
    if (projectId) {
      fetchProject(projectId)
    }
  }, [projectId, fetchProject])

  const status = project ? calculateProjectStatus(project) : null

  return {
    project,
    status,
    isLoading,
    error,
    fetchProject,
    updateProject,
    deleteProject,
    refreshProject,
    setProject,
  }
}
