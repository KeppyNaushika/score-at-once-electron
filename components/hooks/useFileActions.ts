"use client"

import { useState } from "react"

type CreateProjectModal = {
  isOpen: boolean
  open: () => void
  close: () => void
}

export const useFileActions = () => {
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] =
    useState(false)

  const createProjectModal: CreateProjectModal = {
    isOpen: isCreateProjectModalOpen,
    open: () => setIsCreateProjectModalOpen(true),
    close: () => setIsCreateProjectModalOpen(false),
  }

  return {
    createProjectModal,
  }
}
