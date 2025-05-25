import { CreateProjectProps } from "@/electron-src/prisma"
import { Prisma, type Project } from "@prisma/client"
import { useEffect, useState } from "react"

export const useProjects = () => {
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

  const createProject = async (createProjectArgs: CreateProjectProps) => {
    try {
      const createdProject =
        await window.electronAPI.createProject(createProjectArgs)
      createdProject && setProjects((prev) => [...prev, createdProject])
    } catch (error) {
      console.error("Failed to create project:", error)
    }
  }

  const updateProject = async (project: Project) => {
    try {
      const updatedProject = await window.electronAPI.updateProject(project)

      updatedProject &&
        setProjects((prev) =>
          prev.map(
            (
              p, // project 変数名を p に変更して、引数の project との衝突を回避
            ) =>
              p.projectId === updatedProject.projectId ? updatedProject : p,
          ),
        )
    } catch (error) {
      console.error("Failed to update project:", error)
    }
  }

  const deleteProject = async (projectToDelete: Project) => {
    if (!projectToDelete) return
    try {
      const deletedProject =
        await window.electronAPI.deleteProject(projectToDelete)
      if (deletedProject) {
        setProjects((prev) =>
          prev.filter((p) => p.projectId !== deletedProject.projectId),
        )
        if (selectedProject === deletedProject.project) {
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
