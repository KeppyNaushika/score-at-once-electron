"use client"

// CreateProjectArgs型をelectron.d.tsから使用
import { useAuth } from "@/contexts/AuthContext"
import { useEffect, useState } from "react"

export const useProjects = () => {
  const { user } = useAuth()
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProject, setSelectedProject] = useState<any | null>(null)

  const loadProjects = async () => {
    try {
      const fetchedProjects = await window.electronAPI.fetchProjects()
      if (fetchedProjects) {
        setProjects(fetchedProjects)
      } else {
        setProjects([])
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [])

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
        user.id,
      )
      return createdProject
    } catch (error) {
      console.error("Failed to create project:", error)
      throw error
    }
  }

  const updateProject = async (project: any) => {
    try {
      const updatedProject = await window.electronAPI.updateProject(
        project.id,
        project,
      )
      if (updatedProject) {
        // プロジェクトリストを再読み込みして最新の状態を取得
        await loadProjects()
      }
    } catch (error) {
      console.error("Failed to update project:", error)
    }
  }

  const deleteProject = async (projectToDelete: any) => {
    if (!projectToDelete) return
    try {
      const deletedProject = await window.electronAPI.deleteProject(
        projectToDelete.id,
      )
      if (deletedProject) {
        // プロジェクトリストを再読み込み
        await loadProjects()
        // 削除されたプロジェクトが選択中だった場合は選択を解除
        if (selectedProject && selectedProject.id === projectToDelete.id) {
          setSelectedProject(null)
        }
      }
    } catch (error) {
      console.error("Failed to delete project:", error)
    }
  }

  return {
    projects,
    selectedProject,
    setSelectedProject,
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
  }
}
