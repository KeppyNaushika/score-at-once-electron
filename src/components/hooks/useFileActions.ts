"use client"

import { useState } from "react"

type CreateExamModal = {
  isOpen: boolean
  open: () => void
  close: () => void
}

/** 試験作成モーダルの開閉状態を管理するフック */
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
