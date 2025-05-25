import { useState } from "react"
import { type Project } from "@prisma/client"

type CreateProjectModal = {
  isOpen: boolean
  open: () => void
  close: () => void
}

type EditProjectModal = {
  isOpen: boolean
  projectId: string | null
  open: (projectId: string) => void
  close: () => void
}

type DeleteProjectModal = {
  isOpen: boolean
  project: Project | null
  open: (project: Project) => void
  close: () => void
}

export const useFileActions = () => {
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] =
    useState(false)
  const [editProjectModalState, setEditProjectModalState] = useState<{
    isOpen: boolean
    projectId: string | null
  }>({ isOpen: false, projectId: null })
  const [deleteProjectModalState, setDeleteProjectModalState] = useState<{
    isOpen: boolean
    project: Project | null
  }>({ isOpen: false, project: null })

  const createProjectModal: CreateProjectModal = {
    isOpen: isCreateProjectModalOpen,
    open: () => setIsCreateProjectModalOpen(true),
    close: () => setIsCreateProjectModalOpen(false),
  }

  const editProjectModal: EditProjectModal = {
    isOpen: editProjectModalState.isOpen,
    projectId: editProjectModalState.projectId,
    open: (projectId: string) =>
      setEditProjectModalState({ isOpen: true, projectId }),
    close: () => setEditProjectModalState({ isOpen: false, projectId: null }),
  }

  const deleteProjectModal: DeleteProjectModal = {
    isOpen: deleteProjectModalState.isOpen,
    project: deleteProjectModalState.project,
    open: (project: Project) =>
      setDeleteProjectModalState({ isOpen: true, project }),
    close: () => setDeleteProjectModalState({ isOpen: false, project: null }),
  }

  return {
    createProjectModal,
    editProjectModal,
    deleteProjectModal,
  }
}
