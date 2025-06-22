"use client"

// CreateProjectArgs型をelectron.d.tsから使用
import { Prisma, type Project } from "@prisma/client"
import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"

export const useProjects = () => {
  const { user } = useAuth()
  const [projects, setProjects] = useState<
    Prisma.ProjectGetPayload<{ include: { tags: true } }>[]
  >([])
  const [selectedProject, setSelectedProject] =
    useState<Prisma.ProjectGetPayload<{ include: { tags: true } }> | null>(null)

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
      const createdProject =
        await window.electronAPI.createProject(createProjectArgs, user.id)
      return createdProject
    } catch (error) {
      console.error("Failed to create project:", error)
      throw error
    }
  }

  const updateProject = async (
    project: Prisma.ProjectGetPayload<{
      include: {
        tags: true
      }
    }>,
  ) => {
    try {
      const updatedProject = await window.electronAPI.updateProject(project)
      if (updatedProject) {
        // プロジェクトリストを再読み込みして最新の状態を取得
        await loadProjects()
      }
    } catch (error) {
      console.error("Failed to update project:", error)
    }
  }

  const deleteProject = async (
    projectToDelete: Prisma.ProjectGetPayload<{
      include: {
        tags: true
      }
    }>,
  ) => {
    if (!projectToDelete) return
    try {
      const deletedProject =
        await window.electronAPI.deleteProject(projectToDelete.id)
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
