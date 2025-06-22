"use client"

import { useState, useCallback, useEffect } from "react"
import { Project, MasterImage, LayoutRegion, Prisma } from "@prisma/client"
import { toast } from "sonner"

export type ProjectWithDetails = Project & {
  masterImages?: MasterImage[]
  layoutRegions?: LayoutRegion[]
}

export interface ProjectStatus {
  hasMasterImages: boolean
  hasLayoutRegions: boolean
  hasAnswerSheets: boolean
  isGradingComplete: boolean
  nextStep: "master-images" | "layout-regions" | "answer-sheets" | "grading" | "complete"
  progress: number
}

export function useProject(projectId?: string) {
  const [project, setProject] = useState<ProjectWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const calculateProjectStatus = useCallback((project: ProjectWithDetails): ProjectStatus => {
    const hasMasterImages = (project.masterImages?.length ?? 0) > 0
    const hasLayoutRegions = (project.layoutRegions?.length ?? 0) > 0
    const hasAnswerSheets = false // TODO: Implement when answer sheets are added
    const isGradingComplete = false // TODO: Implement when grading is added

    let nextStep: ProjectStatus["nextStep"] = "master-images"
    let progress = 0

    if (!hasMasterImages) {
      nextStep = "master-images"
      progress = 0
    } else if (!hasLayoutRegions) {
      nextStep = "layout-regions"
      progress = 25
    } else if (!hasAnswerSheets) {
      nextStep = "answer-sheets"
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
      hasLayoutRegions,
      hasAnswerSheets,
      isGradingComplete,
      nextStep,
      progress
    }
  }, [])

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
      const errorMessage = err instanceof Error ? err.message : "プロジェクトの読み込みに失敗しました"
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const updateProject = useCallback(async (updates: Prisma.ProjectUpdateInput) => {
    if (!project?.id) return

    try {
      const updatedProject = await window.electronAPI.updateProject(project.id, updates)
      setProject(prev => prev ? { ...prev, ...updatedProject } : null)
      return updatedProject
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "プロジェクトの更新に失敗しました"
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    }
  }, [project])

  const deleteProject = useCallback(async () => {
    if (!project) return

    try {
      await window.electronAPI.deleteProject(project.id)
      setProject(null)
      toast.success("プロジェクトを削除しました")
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "プロジェクトの削除に失敗しました"
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
    setProject
  }
}