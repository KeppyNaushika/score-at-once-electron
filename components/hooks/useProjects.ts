"use client"

import { useAuth } from "@/contexts/AuthContext"
import type { ProjectWithDetails } from "@/types/electron"
import { useCallback, useEffect, useState } from "react"

export const useProjects = () => {
  const { user } = useAuth()
  const [projects, setProjects] = useState<ProjectWithDetails[]>([])

  const loadProjects = useCallback(async () => {
    if (!user) {
      setProjects([])
      return
    }
    try {
      const fetchedProjects = await window.electronAPI.fetchProjects(user.id)
      if (fetchedProjects) {
        setProjects(fetchedProjects)
      } else {
        setProjects([])
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error)
    }
  }, [user])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadProjects()
    })

    return () => cancelAnimationFrame(frame)
  }, [loadProjects])

  const createProject = async (createProjectArgs: {
    examName: string
    examDate?: Date | null
    description?: string
    subject?: string
  }) => {
    if (!user) {
      throw new Error("ユーザーがログインしていません")
    }

    try {
      const createdProject = await window.electronAPI.createProject(
        createProjectArgs,
        user.id
      )
      return createdProject
    } catch (error) {
      console.error("Failed to create project:", error)
      throw error
    }
  }

  return {
    projects,
    loadProjects,
    createProject,
  }
}
