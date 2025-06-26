"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import type { ProjectWithDetails } from "@/types/electron"

export function useProjectDetail() {
  const params = useParams()
  const projectId = params.projectId as string

  const [project, setProject] = useState<ProjectWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProject = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const projectData = await window.electronAPI.fetchProjectById(projectId)
      if (projectData) {
        setProject(projectData)
      } else {
        setError("プロジェクトが見つかりません")
      }
    } catch (err) {
      console.error("Failed to load project:", err)
      setError("プロジェクトの読み込みに失敗しました")
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadProject()
  }, [loadProject])

  // 削除処理
  const deleteProject = useCallback(async () => {
    try {
      await window.electronAPI.deleteProject(projectId)
      // 削除後の処理は呼び出し元で行う
      return true
    } catch (err) {
      console.error("Failed to delete project:", err)
      throw err
    }
  }, [projectId])

  // 更新処理
  const updateProject = useCallback(async (data: {
    name?: string
    description?: string
    [key: string]: unknown
  }) => {
    try {
      const updatedProject = await window.electronAPI.updateProject(projectId, data)
      setProject(updatedProject)
      return updatedProject
    } catch (err) {
      console.error("Failed to update project:", err)
      throw err
    }
  }, [projectId])

  return {
    project,
    loading,
    error,
    loadProject,
    deleteProject,
    updateProject,
  }
}