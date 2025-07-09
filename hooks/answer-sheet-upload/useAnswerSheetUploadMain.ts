"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { arrayMove } from '@dnd-kit/sortable'
import { DragEndEvent } from '@dnd-kit/core'
import type { UploadAnswerSheetFileData } from "@/types/electron"
import { UseAnswerSheetUploadProps, LayoutRegion, MasterImage, ConvertedFile } from "./types"
import { useFileProcessing } from "./useFileProcessing"
import { useStudentManagement } from "./useStudentManagement"

export function useAnswerSheetUploadMain({
  projectId,
  students,
  onUploadComplete,
}: UseAnswerSheetUploadProps) {
  // 子フックの利用
  const fileProcessing = useFileProcessing()
  const studentManagement = useStudentManagement({ students })

  // UI状態
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedTab, setSelectedTab] = useState("upload")
  const [maxPages, setMaxPages] = useState(1)
  const [pageRange, setPageRange] = useState<'all' | 'specific'>('all')
  const [specificPages, setSpecificPages] = useState<string>('1')
  const [fileOrder, setFileOrder] = useState<'page-then-student' | 'student-then-page'>('page-then-student')
  const [assignmentMode, setAssignmentMode] = useState<'auto' | 'manual'>('auto')
  const [sortMode, setSortMode] = useState<'natural' | 'alphabetical' | 'upload-order'>('natural')

  // データ
  const [layoutRegions, setLayoutRegions] = useState<LayoutRegion[]>([])
  const [masterImages, setMasterImages] = useState<MasterImage[]>([])
  const [isClient, setIsClient] = useState(false)

  // クライアントサイド判定
  useEffect(() => {
    setIsClient(true)
  }, [])

  // アップロード処理
  const uploadAnswerSheets = useCallback(async () => {
    setIsUploading(true)
    setUploadProgress(0)

    try {
      const selectedFiles = fileProcessing.files.filter(f => f.isSelected)
      const selectedStudents = studentManagement.studentsWithAnswers.filter(s => s.isSelected)

      if (selectedFiles.length === 0) {
        toast.error("アップロードするファイルを選択してください")
        return
      }

      if (selectedStudents.length === 0) {
        toast.error("答案を関連付ける学生を選択してください")
        return
      }

      const uploadData: UploadAnswerSheetFileData[] = []

      // ファイルと学生の関連付け処理
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        const studentIndex = i % selectedStudents.length
        const student = selectedStudents[studentIndex]

        uploadData.push({
          name: file.name,
          fileName: file.name,
          originalFileName: file.originalFileName,
          type: file.type,
          buffer: file.buffer,
          studentId: student.id,
          pageNumber: file.pageNumber,
          overwrite: student.overwrite,
        })
      }

      // ElectronAPI呼び出し
      const result = await window.electronAPI.uploadAnswerSheets(
        projectId,
        uploadData
      )

      if (result.success) {
        toast.success(`${uploadData.length}件の答案をアップロードしました`)
        onUploadComplete?.()
      } else {
        toast.error(result.error || "アップロードに失敗しました")
      }
    } catch (error) {
      console.error("アップロードエラー:", error)
      toast.error("アップロードに失敗しました")
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [fileProcessing.files, studentManagement.studentsWithAnswers, projectId, onUploadComplete])

  // ドラッグ&ドロップハンドラ
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      fileProcessing.setFiles(prev => {
        const oldIndex = prev.findIndex(item => item.id === active.id)
        const newIndex = prev.findIndex(item => item.id === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }, [fileProcessing.setFiles])

  // ヘルパー関数
  const onDrop = useCallback((acceptedFiles: File[]) => {
    fileProcessing.processFiles(acceptedFiles)
  }, [fileProcessing])

  const removeFile = useCallback((fileId: string) => {
    fileProcessing.setFiles(prev => prev.filter(f => f.id !== fileId))
  }, [fileProcessing.setFiles])

  const toggleFileSelection = useCallback((fileId: string) => {
    fileProcessing.setFiles(prev => 
      prev.map(f => f.id === fileId ? { ...f, isSelected: !f.isSelected } : f)
    )
  }, [fileProcessing.setFiles])

  const moveFile = useCallback((dragIndex: number, hoverIndex: number) => {
    fileProcessing.setFiles(prev => {
      const dragFile = prev[dragIndex]
      const newFiles = [...prev]
      newFiles.splice(dragIndex, 1)
      newFiles.splice(hoverIndex, 0, dragFile)
      return newFiles
    })
  }, [fileProcessing.setFiles])

  const handleUpload = uploadAnswerSheets

  const handlePasswordSubmit = useCallback(async (password: string) => {
    if (!fileProcessing.currentPdfFile) return
    
    fileProcessing.setIsPasswordProcessing(true)
    try {
      const newFiles = await fileProcessing.convertFilesToImages([fileProcessing.currentPdfFile], password)
      fileProcessing.setFiles(prev => [...prev, ...newFiles])
      
      const remainingFiles = fileProcessing.pendingFiles
      if (remainingFiles.length > 0) {
        // 次のパスワード保護ファイルを処理
        fileProcessing.setCurrentPdfFile(remainingFiles[0])
        fileProcessing.setPendingFiles(remainingFiles.slice(1))
        fileProcessing.setPasswordError('')
        // ダイアログは開いたまま
      } else {
        fileProcessing.setShowPasswordDialog(false)
        fileProcessing.setCurrentPdfFile(null)
        fileProcessing.setPasswordError('')
        toast.success('すべてのパスワード保護ファイルの処理が完了しました')
      }
    } catch (error: any) {
      if (error.message === 'invalid-password') {
        fileProcessing.setPasswordError('パスワードが正しくありません')
      } else {
        // パスワード関連以外の予期しないエラーのみログ出力
        console.error('パスワード処理エラー:', error)
        fileProcessing.setPasswordError('ファイル処理に失敗しました')
      }
    } finally {
      fileProcessing.setIsPasswordProcessing(false)
    }
  }, [fileProcessing])

  const selectedFilesCount = fileProcessing.files.filter(f => f.isSelected).length
  const selectedStudentsCount = studentManagement.studentsWithAnswers.filter(s => s.isSelected).length

  return {
    // File processing
    ...fileProcessing,
    
    // Student management
    ...studentManagement,
    
    // UI state
    isUploading,
    uploadProgress,
    selectedTab,
    setSelectedTab,
    maxPages,
    setMaxPages,
    pageRange,
    setPageRange,
    specificPages,
    setSpecificPages,
    fileOrder,
    setFileOrder,
    assignmentMode,
    setAssignmentMode,
    sortMode,
    setSortMode,
    
    // Data
    layoutRegions,
    setLayoutRegions,
    masterImages,
    setMasterImages,
    isClient,
    
    // Actions
    uploadAnswerSheets,
    handleDragEnd,
    onDrop,
    removeFile,
    toggleFileSelection,
    moveFile,
    handleUpload,
    handlePasswordSubmit,
    selectedFilesCount,
    selectedStudentsCount,
    
    // Student management helpers
    toggleStudentOverwrite: studentManagement.toggleOverwrite,
    selectAllStudents: () => studentManagement.toggleAllStudents(true),
    deselectAllStudents: () => studentManagement.toggleAllStudents(false),
    getStudentName: useCallback((studentId: string) => {
      const student = studentManagement.studentsWithAnswers.find(s => s.id === studentId)
      return student ? `${student.lastName} ${student.firstName}` : ''
    }, [studentManagement.studentsWithAnswers]),
  }
}