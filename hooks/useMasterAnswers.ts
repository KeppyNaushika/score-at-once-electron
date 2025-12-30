"use client"

import { useState, useCallback, useEffect } from "react"
import { Prisma } from "@prisma/client"
import { toast } from "sonner"
import { convertPdfToImages, ConvertedImage } from "@/lib/pdfConverter"

type MasterAnswer = Prisma.PageImageGetPayload<{ include: { projectPage: true } }>

export interface MasterAnswersState {
  answers: MasterAnswer[]
  imageUrls: Record<string, string>
  isUploading: boolean
  isDeleting: Record<string, boolean>
  isMoving: boolean
  passwordDialog: {
    isOpen: boolean
    fileName?: string
    attempts: number
    hasError: boolean
    isLoading: boolean
  }
}

export function useMasterAnswers(
  projectId: string,
  initialAnswers: MasterAnswer[],
  onAnswersChange: (answers: MasterAnswer[]) => void
) {
  const [state, setState] = useState<MasterAnswersState>({
    answers: [],
    imageUrls: {},
    isUploading: false,
    isDeleting: {},
    isMoving: false,
    passwordDialog: {
      isOpen: false,
      fileName: undefined,
      attempts: 0,
      hasError: false,
      isLoading: false
    }
  })


  // Initialize answers and fetch URLs
  useEffect(() => {
    const sortedAnswers = [...initialAnswers].sort((a, b) => a.projectPage.pageNumber - b.projectPage.pageNumber)
    setState(prev => ({ ...prev, answers: sortedAnswers }))

    const fetchUrls = async () => {
      const urls: Record<string, string> = {}
      for (const answer of sortedAnswers) {
        try {
          const resolvedUrl = await window.electronAPI.resolveFileProtocolPath(answer.imagePath)
          urls[answer.id] = resolvedUrl
        } catch (error) {
          console.error(`Failed to resolve path for answer ${answer.id} (${answer.imagePath}):`, error)
          urls[answer.id] = ""
        }
      }
      setState(prev => ({ ...prev, imageUrls: urls }))
    }

    if (sortedAnswers.length > 0) {
      fetchUrls()
    } else {
      setState(prev => ({ ...prev, imageUrls: {} }))
    }
  }, [initialAnswers])

  // パスワード処理用の状態
  const [_pendingFiles, setPendingFiles] = useState<File[]>([])
  const [_currentFileIndex, setCurrentFileIndex] = useState(0)
  const [_currentPassword, setCurrentPassword] = useState<string>("")

  const convertPdfToImagesWithPassword = useCallback(async (file: File): Promise<ConvertedImage[]> => {
    try {
      // まずパスワードなしで試行
      const pdfImages = await convertPdfToImages(file)
      return pdfImages
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage === 'password-required' || errorMessage === 'invalid-password') {
        // パスワードが必要な場合、ダイアログを表示してPromiseを返す
        return new Promise((resolve, reject) => {
          const isInvalidPassword = errorMessage === 'invalid-password'
          setState(prev => ({
            ...prev,
            passwordDialog: {
              isOpen: true,
              fileName: file.name,
              attempts: isInvalidPassword ? prev.passwordDialog.attempts + 1 : 0,
              hasError: isInvalidPassword,
              isLoading: false
            }
          }))
          
          // グローバルスコープで解決関数を保存
          window.__masterAnswerPasswordResolve = resolve
          window.__masterAnswerPasswordReject = reject
          window.__masterAnswerPasswordFile = file
        })
      } else {
        // その他のエラーはそのまま投げる
        throw error
      }
    }
  }, [])

  const uploadAnswers = useCallback(async (files: File[]) => {
    if (!projectId) {
      toast.error("プロジェクトIDが指定されていません。")
      return
    }
    
    // クライアントサイドチェック
    if (typeof window === 'undefined') {
      toast.error("この機能はクライアントサイドでのみ利用可能です。")
      return
    }
    
    setState(prev => ({ ...prev, isUploading: true }))
    setPendingFiles(files)
    setCurrentFileIndex(0)
    
    try {
      const allFilesData: ConvertedImage[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setCurrentFileIndex(i)
        
        if (file.type === 'application/pdf') {
          try {
            // Convert PDF to individual page images with password handling
            const pdfImages = await convertPdfToImagesWithPassword(file)
            allFilesData.push(...pdfImages)
          } catch (error) {
            if (error instanceof Error && error.message === 'Password input cancelled') {
              // ユーザーがパスワード入力をキャンセルした場合
              return // アップロード処理を中断
            } else {
              throw error // その他のエラーは再投げ
            }
          }
        } else {
          // Handle regular image files
          const buffer = await file.arrayBuffer()
          allFilesData.push({
            name: file.name,
            type: file.type,
            buffer: buffer,
          })
        }
      }

      const result = await window.electronAPI.uploadMasterAnswers(projectId, allFilesData)
      
      if (result) {
        const totalPages = allFilesData.length
        const pdfCount = files.filter(f => f.type === 'application/pdf').length
        const imageCount = files.length - pdfCount
        
        let message = `${totalPages}枚の模範解答をアップロードしました`
        if (pdfCount > 0 && imageCount > 0) {
          message += ` (PDF ${pdfCount}ファイル, 画像 ${imageCount}ファイル)`
        } else if (pdfCount > 0) {
          message += ` (PDF ${pdfCount}ファイル)`
        }
        
        toast.success(message)
        
        // Get updated project data
        const updatedProject = await window.electronAPI.fetchProjectById(projectId)
        if (updatedProject && updatedProject.projectPages) {
          // Extract master answers from project pages
          const masterAnswers = updatedProject.projectPages
            .flatMap(page => page.pageImages.filter(img => img.imageType === "MODEL_ANSWER")
            .map(img => ({ ...img, projectPage: page })))
          
          const sortedUpdatedAnswers = [...masterAnswers].sort(
            (a, b) => a.projectPage.pageNumber - b.projectPage.pageNumber
          )
          
          setState(prev => ({ ...prev, answers: sortedUpdatedAnswers }))
          onAnswersChange(sortedUpdatedAnswers)
          
          // Update answer URLs
          const newUrls: Record<string, string> = {}
          for (const answer of sortedUpdatedAnswers) {
            try {
              const resolvedUrl = await window.electronAPI.resolveFileProtocolPath(answer.imagePath)
              newUrls[answer.id] = resolvedUrl
            } catch (error) {
              console.error(`Failed to resolve path for answer ${answer.id} (${answer.imagePath}):`, error)
              newUrls[answer.id] = ""
            }
          }
          setState(prev => ({ ...prev, imageUrls: newUrls }))
        }
      }
    } catch (error) {
      console.error("Upload failed:", error)
      toast.error("ファイルのアップロードに失敗しました。")
    } finally {
      setState(prev => ({ ...prev, isUploading: false }))
      setPendingFiles([])
      setCurrentFileIndex(0)
      setCurrentPassword("")
    }
  }, [projectId, onAnswersChange, convertPdfToImagesWithPassword])

  // パスワード送信処理
  const handlePasswordSubmit = useCallback(async (password: string) => {
    const file = window.__masterAnswerPasswordFile
    const resolve = window.__masterAnswerPasswordResolve
    const reject = window.__masterAnswerPasswordReject
    
    if (!file || !resolve || !reject) {
      return
    }
    
    setState(prev => ({
      ...prev,
      passwordDialog: {
        ...prev.passwordDialog,
        isLoading: true,
        hasError: false
      }
    }))
    
    try {
      const pdfImages = await convertPdfToImages(file, password)
      
      // パスワード成功時の処理
      setState(prev => ({
        ...prev,
        passwordDialog: {
          isOpen: false,
          fileName: undefined,
          attempts: 0,
          hasError: false,
          isLoading: false
        }
      }))
      
      // グローバル変数をクリア
      window.__masterAnswerPasswordResolve = null
      window.__masterAnswerPasswordReject = null
      window.__masterAnswerPasswordFile = null

      resolve(pdfImages)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage === 'invalid-password') {
        setState(prev => ({
          ...prev,
          passwordDialog: {
            ...prev.passwordDialog,
            isLoading: false,
            hasError: true,
            attempts: prev.passwordDialog.attempts + 1
          }
        }))
      } else {
        setState(prev => ({
          ...prev,
          passwordDialog: {
            isOpen: false,
            fileName: undefined,
            attempts: 0,
            hasError: false,
            isLoading: false
          }
        }))
        
        // グローバル変数をクリア
        window.__masterAnswerPasswordResolve = null
        window.__masterAnswerPasswordReject = null
        window.__masterAnswerPasswordFile = null

        reject(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }, [])

  // パスワードダイアログを閉じる
  const handlePasswordCancel = useCallback(() => {
    const reject = window.__masterAnswerPasswordReject
    
    setState(prev => ({
      ...prev,
      passwordDialog: {
        isOpen: false,
        fileName: undefined,
        attempts: 0,
        hasError: false,
        isLoading: false
      },
      isUploading: false
    }))
    
    // グローバル変数をクリア
    window.__masterAnswerPasswordResolve = null
    window.__masterAnswerPasswordReject = null
    window.__masterAnswerPasswordFile = null

    // Promise を拒否
    if (reject) {
      reject(new Error('Password input cancelled'))
    }
    
    setPendingFiles([])
    setCurrentFileIndex(0)
    setCurrentPassword("")
  }, [])

  const deleteAnswer = useCallback(async (answerId: string) => {
    setState(prev => ({
      ...prev,
      isDeleting: { ...prev.isDeleting, [answerId]: true }
    }))

    try {
      const result = await window.electronAPI.deleteMasterAnswer(answerId)
      const updatedAnswers = result.projectPages
        .flatMap(page =>
          page.pageImages
            .filter(img => img.imageType === "MODEL_ANSWER")
            .map(img => ({ ...img, projectPage: page })),
        )
        .sort((a, b) => a.projectPage.pageNumber - b.projectPage.pageNumber)

      const newUrls: Record<string, string> = {}
      for (const answer of updatedAnswers) {
        try {
          const resolvedUrl = await window.electronAPI.resolveFileProtocolPath(answer.imagePath)
          newUrls[answer.id] = resolvedUrl
        } catch (error) {
          console.error(`Failed to resolve path for answer ${answer.id} (${answer.imagePath}):`, error)
          newUrls[answer.id] = ""
        }
      }

      setState(prev => ({
        ...prev,
        answers: updatedAnswers,
        isDeleting: { ...prev.isDeleting, [answerId]: false },
        imageUrls: newUrls
      }))
      
      onAnswersChange(updatedAnswers)
      toast.success("画像を削除しました。")
    } catch (error) {
      console.error("Failed to delete image:", error)
      toast.error("画像の削除に失敗しました。")
      setState(prev => ({
        ...prev,
        isDeleting: { ...prev.isDeleting, [answerId]: false }
      }))
    }
  }, [onAnswersChange])

  const moveAnswer = useCallback(async (fromIndex: number, direction: "left" | "right") => {
    const toIndex = direction === "left" ? fromIndex - 1 : fromIndex + 1
    if (toIndex < 0 || toIndex >= state.answers.length) return

    setState(prev => ({ ...prev, isMoving: true }))

    try {
      const newAnswers = [...state.answers]
      const [movedAnswer] = newAnswers.splice(fromIndex, 1)
      newAnswers.splice(toIndex, 0, movedAnswer)

      const updateRequests = newAnswers.map((answer, index) => ({
        id: answer.id,
        pageNumber: index + 1,
      }))

      await window.electronAPI.updateMasterAnswersOrder(updateRequests)

      setState(prev => ({ ...prev, answers: newAnswers }))
      onAnswersChange(newAnswers)
    } catch (error) {
      console.error("Failed to move image:", error)
      toast.error("画像の移動に失敗しました。")
    } finally {
      setState(prev => ({ ...prev, isMoving: false }))
    }
  }, [state.answers, onAnswersChange])

  return {
    ...state,
    uploadAnswers,
    deleteAnswer,
    moveAnswer,
    handlePasswordSubmit,
    handlePasswordCancel
  }
}
