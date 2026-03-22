"use client"

import { useState } from "react"

type CreateExamModal = {
  isOpen: boolean
  open: () => void
  close: () => void
}

export const useFileActions = () => {
  const [isCreateExamModalOpen, setIsCreateExamModalOpen] = useState(false)

  const createExamModal: CreateExamModal = {
    isOpen: isCreateExamModalOpen,
    open: () => setIsCreateExamModalOpen(true),
    close: () => setIsCreateExamModalOpen(false),
  }

  return {
    createExamModal,
  }
}
